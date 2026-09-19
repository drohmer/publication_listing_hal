import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { spawnSync } from 'node:child_process';
import { exportHTML } from '../scripts/export_html.mjs';

const renderer = fs.readFileSync(new URL('../src/publication_listing.js', import.meta.url), 'utf8');
const cli = new URL('../scripts/export_html.mjs', import.meta.url);

function fixture(t) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'hal-export-test-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    fs.mkdirSync(path.join(dir, 'cache'));
    fs.mkdirSync(path.join(dir, 'custom'));
    const config = { cache_dir: 'cache/', path_to_local: 'custom/', path_to_data: './',
        css_path: 'src/', default_thumbnail_path: 'src/default.jpg', query: [],
        html_tag_publication: '#listing-publication', html_menu: false };
    const record = (id, year, type) => ({ halId_s: id, publicationDateY_i: year,
        submittedDateY_i: year, submittedDateM_i: 2, submittedDateD_i: 1,
        title_s: ['HAL title'], authFullName_s: ['Alice', 'Bob'], docType_s: type,
        cache_thumbnail: 'cache/thumb.jpg', cache_pdf: 'cache/article.pdf',
        ...(type === 'ART' ? { journalTitle_s: 'A journal' } : {}) });
    const data = [record('hal-old', 2022, 'ART'), record('hal-new', 2025, 'COMM'), record('hal-preprint', 2024, 'UNDEFINED')];
    const custom = { 'hal-new': { title: 'Custom <title> & "quote"', award: 'Best paper',
        conference_short: 'CONF', code: '{{local}}code.zip', project_page: '{{pathToData}}project.html' } };
    const configPath = path.join(dir, 'publication_config.js');
    fs.writeFileSync(configPath, `const publication_config = ${JSON.stringify(config)};`);
    fs.writeFileSync(path.join(dir, 'cache/cache.json'), JSON.stringify(data));
    fs.writeFileSync(path.join(dir, 'custom/publication_customize.js'), `const custom = ${JSON.stringify(custom)};`);
    return { dir, configPath, config, data, custom };
}

test('fragment matches the browser renderer and preserves customization, cached assets and ordering', t => {
    const f = fixture(t);
    const { html } = exportHTML(f.configPath);
    assert.ok(html.indexOf('id="hal-new"') < html.indexOf('id="hal-old"'));
    assert.match(html, /Custom &lt;title&gt; &amp; &quot;quote&quot;/);
    assert.match(html, /href="custom\/code.zip"/);
    assert.match(html, /href="\.\/project.html"/);
    assert.match(html, /href="cache\/article.pdf"/);
    assert.match(html, /src="cache\/thumb.jpg"/);
    assert.match(html, /Alice, Bob/);
    assert.match(html, /Best paper/);
    assert.doesNotMatch(html, /id="hal-preprint"|<script|<html|id="listing-publication"/);

    const root = { innerHTML: '' };
    const context = vm.createContext({ document: { querySelector: () => root, querySelectorAll: () => [] } });
    vm.runInContext(`const publication_config=${JSON.stringify(f.config)}; const cache=${JSON.stringify(f.data)}; const custom=${JSON.stringify(f.custom)};`, context);
    vm.runInContext(renderer, context);
    assert.equal(root.innerHTML + '\n', html);
    vm.runInContext('main()', context);
    assert.equal(root.innerHTML + '\n', html, 're-rendering must not duplicate entries');
});

test('complete page escapes metadata and rebases relative URLs for nested outputs', t => {
    const f = fixture(t);
    const { html } = exportHTML(f.configPath, { format: 'page', output: path.join(f.dir, 'out/index.html'), title: 'R&D <Publications>', lang: 'fr' });
    assert.match(html, /<!DOCTYPE html>/);
    assert.match(html, /<html lang="fr">/);
    assert.match(html, /<title>R&amp;D &lt;Publications&gt;<\/title>/);
    assert.match(html, /href="\.\.\/src\/style-standard.css"/);
    assert.match(html, /href="\.\.\/cache\/article.pdf"/);
    assert.match(html, /href="https:\/\/hal.archives-ouvertes.fr\/hal-new"/);
    assert.doesNotMatch(html, /<script|&amp;lt;/);
});

test('type sorting, optional customization and empty caches are supported', t => {
    const f = fixture(t);
    const typed = exportHTML(f.configPath, { sort: 'type', 'no-custom': true }).html;
    assert.match(typed, /Journal publications/);
    assert.match(typed, /Conference publications/);
    assert.match(typed, /id="hal-preprint"/);
    assert.doesNotMatch(typed, /Best paper/);
    fs.unlinkSync(path.join(f.dir, 'custom/publication_customize.js'));
    assert.match(exportHTML(f.configPath).html, /HAL title/);
    fs.writeFileSync(path.join(f.dir, 'cache/cache.json'), '[]');
    assert.equal(exportHTML(f.configPath).html.trim(), '');
});

test('explicit cache and custom overrides work from another working directory', t => {
    const f = fixture(t);
    const cache = path.join(f.dir, 'other.json');
    fs.writeFileSync(cache, JSON.stringify(f.data.slice(0, 1)));
    const custom = path.join(f.dir, 'other.js');
    fs.writeFileSync(custom, 'const custom = {"hal-old": {title: "Override"}}');
    const html = exportHTML(f.configPath, { cache, custom }).html;
    assert.match(html, /Override/);
    assert.doesNotMatch(html, /id="hal-new"/);
});

test('CLI fails before overwriting output on missing cache or bad arguments', t => {
    const f = fixture(t);
    const output = path.join(f.dir, 'existing.html');
    fs.writeFileSync(output, 'keep me');
    for (const args of [['--cache', 'missing.json'], ['--format', 'bad'], ['--custom', 'missing.js'], ['--sort', 'bad']]) {
        const result = spawnSync(process.execPath, [cli.pathname, f.configPath, '--output', output, ...args], { encoding: 'utf8', cwd: f.dir });
        assert.notEqual(result.status, 0);
        assert.match(result.stderr, /HTML export failed/);
        assert.equal(fs.readFileSync(output, 'utf8'), 'keep me');
    }
    fs.writeFileSync(path.join(f.dir, 'cache/cache.json'), '{invalid');
    assert.throws(() => exportHTML(f.configPath));
});

test('browser retains static content when cache is missing and HAL is unavailable', () => {
    const root = { innerHTML: '<div>Existing static publication</div>' };
    const context = vm.createContext({ document: { querySelector: () => root, querySelectorAll: () => [] } });
    vm.runInContext('const publication_config={query:[], html_tag_publication:"#listing-publication"};', context);
    vm.runInContext(renderer, context);
    assert.equal(root.innerHTML, '<div>Existing static publication</div>');
});

test('untrusted metadata cannot introduce markup or executable links', t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.dir, 'custom/publication_customize.js'), 'const custom = {"hal-new": {title: "<script>alert(1)</script>", code: "javascript:alert(1)"}};');
    const html = exportHTML(f.configPath).html;
    assert.doesNotMatch(html, /<script|href="javascript:/);
    assert.match(html, /&lt;script&gt;/);
});


test('HAL entities remain readable and custom article/year/author overrides survive normalization', t => {
    const f = fixture(t);
    fs.writeFileSync(path.join(f.dir, 'custom/publication_customize.js'), `const custom = ${JSON.stringify({
        'hal-new': { title: '2D &amp; 3D', authors: 'Custom author', year: 2026, timestamp: '2026-2026-01-01', article: 'https://example.org/custom.pdf' }
    })};`);
    const html = exportHTML(f.configPath).html;
    assert.match(html, /2D &amp; 3D/);
    assert.doesNotMatch(html, /&amp;amp;/);
    assert.match(html, /id="year-2026"/);
    assert.match(html, /Custom author/);
    assert.match(html, /href="https:\/\/example.org\/custom.pdf"/);
});
