#!/usr/bin/env node
/** Offline HTML export using the exact same renderer as the browser. */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';

const help = `Usage: node scripts/export_html.mjs [publication_config.js] [options]

Generate HTML offline from cache.json and optional customization JS.
Requires Node.js 18.3+; no npm packages or browser installation.

  --output FILE       Destination (default: publications.html beside config)
  --format FORMAT     fragment (default) or page
  --cache FILE        Override cache.json path
  --custom FILE       Override publication_customize.js path
  --no-custom         Ignore customization
  --sort SORT         default (by year) or type (year then publication type)
  --title TEXT        Page title and H1 (default: Publications)
  --lang CODE         Page language (default: en)
  --help              Show this help

Explicit file arguments are relative to the current working directory.
Asset URLs stay relative to the config directory: include fragments in a page
in that directory. Complete pages rebase asset URLs for their output location.
Configuration and customization JS must be trusted project files.
`;

export function exportHTML(configFile, options = {}) {
    const configPath = path.resolve(configFile);
    const configDir = path.dirname(configPath);
    const format = options.format ?? 'fragment';
    const sorting = options.sort ?? 'default';
    if (!['fragment', 'page'].includes(format)) throw new Error('Invalid --format: use fragment or page');
    if (!['default', 'type'].includes(sorting)) throw new Error('Invalid --sort: use default or type');
    if (options.custom && options['no-custom']) throw new Error('--custom and --no-custom are mutually exclusive');

    // These are existing project JS configuration files, not arbitrary input.
    // No DOM, fetch, Node process, or require is provided to their context.
    const context = vm.createContext({ console: { log: (...args) => console.error(...args) } });
    const run = (source, filename) => vm.runInContext(source, context, { filename, timeout: 5000 });
    run(fs.readFileSync(configPath, 'utf8'), configPath);
    const config = run('publication_config', configPath);
    const cachePath = options.cache ? path.resolve(options.cache)
        : path.resolve(configDir, config.cache_dir || 'cache/', 'cache.json');
    if (!fs.existsSync(cachePath)) throw new Error(`Missing cache: ${cachePath}. Run scripts/generate_cache.py first.`);
    const cache = JSON.parse(fs.readFileSync(cachePath, 'utf8'));
    if (!cache || typeof cache !== 'object') throw new Error('Cache must be an array or an object of HAL records');
    context.exportCache = cache;

    const customPath = options.custom ? path.resolve(options.custom)
        : path.resolve(configDir, config.path_to_local || 'publication_customize/', 'publication_customize.js');
    if (!options['no-custom'] && (options.custom || fs.existsSync(customPath))) {
        run(fs.readFileSync(customPath, 'utf8'), customPath);
    }

    const renderer = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../src/publication_listing.js');
    run(fs.readFileSync(renderer, 'utf8'), renderer);
    context.exportSorting = sorting;
    const html = run(`
        global_hal_listing.data = {};
        merge_data(global_hal_listing.data, exportCache, true, true);
        merge_data(global_hal_listing.data, typeof custom !== 'undefined' ? custom : {}, true, false);
        remove_incorrect_data();
        sort_data();
        global_hal_listing.sorting_type = exportSorting;
        render_listing();
    `, renderer);

    const output = path.resolve(options.output || path.join(configDir, 'publications.html'));
    // A fragment intentionally contains only the entries, for inclusion INSIDE
    // the existing listing container; it cannot duplicate container IDs.
    if (format === 'fragment') return { output, html: html + '\n' };

    const escape = value => String(value).replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
    const rebase = url => {
        if (/^(?:[a-z][a-z0-9+.-]*:|\/|#)/i.test(url)) return url;
        const prefix = path.relative(path.dirname(output), configDir).split(path.sep).join('/');
        return prefix ? `${prefix}/${url}` : url;
    };
    const body = html.replace(/\b(href|src|poster)="([^"]*)"/g,
        (_, attribute, url) => `${attribute}="${escape(rebase(url.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>')))}"`);
    const css = rebase((config.css_path || '') + 'style-standard.css');
    if (/^[a-z][a-z0-9+.-]*:/i.test(css) && !/^https?:/i.test(css)) throw new Error('Unsupported stylesheet URL scheme');
    const title = escape(options.title || 'Publications');
    return { output, html: `<!DOCTYPE html>
<html lang="${escape(options.lang || 'en')}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="${escape(css)}" id="css-hal">
</head>
<body>
<main>
  <h1>${title}</h1>
  <div id="listing-publication">${body}</div>
</main>
</body>
</html>
` };
}

function main() {
    const { values, positionals } = parseArgs({
        allowPositionals: true,
        options: Object.fromEntries([
            ...['output', 'format', 'cache', 'custom', 'sort', 'title', 'lang'].map(key => [key, { type: 'string' }]),
            ...['help', 'no-custom'].map(key => [key, { type: 'boolean' }]),
        ]),
    });
    if (values.help) { console.log(help); return; }
    if (positionals.length > 1) throw new Error('Expected at most one configuration file');
    const result = exportHTML(positionals[0] || 'publication_config.js', values);
    fs.mkdirSync(path.dirname(result.output), { recursive: true });
    fs.writeFileSync(result.output, result.html, 'utf8');
    console.log(`Exported ${values.format || 'fragment'}: ${result.output}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    try { main(); }
    catch (error) { console.error(`HTML export failed: ${error.message}`); process.exitCode = 1; }
}
