# Publication Listing

Script to display HAL publications in an HTML page with:
* Robust thumbnail handling (image and video)
* Cache system for faster loading
* Customization via YAML annotations (links to code, project page, refined conference/journal names, awards, etc.)
* CSS themes (standard and compact)
* Sorting by year or by publication type (journal/conference)
* Optional offline HTML export (embeddable fragment or complete static page)

## Project Structure

```
publication_listing/
  src/                                  # Frontend assets (loaded by browser)
    publication_listing.js              # Main JS script
    style-base.css                      # Shared CSS base (layout, typography)
    style-standard.css                  # Standard CSS theme
    style-compact.css                   # Compact CSS theme
    thumbnail_default.jpg               # Default thumbnail image
  scripts/                              # Python CLI tools
    generate_cache.py                   # Cache generator (queries HAL, downloads thumbnails)
    update_publication_customize.py     # Converts YAML customization to JS
  examples/
    01_minimal/                         # Minimal example (no customization)
    02_full_featured/                   # Full example with cache and customization
```

## Quick Start

### 1. Minimal usage

Open `examples/01_minimal/index.html` via a local HTTP server. It queries HAL directly and displays publications.

### 2. Full-featured usage

The `examples/02_full_featured/` example demonstrates cache and customization:

1. **Generate the cache** (downloads thumbnails for faster loading):
   ```bash
   cd examples/02_full_featured
   python ../../scripts/generate_cache.py publication_config.js
   ```

2. **Edit customizations** in `publication_customize/publication_customize.yaml`, then regenerate:
   ```bash
   python ../../scripts/update_publication_customize.py publication_customize/publication_customize.yaml
   ```

3. **Open** `index.html` via a local HTTP server.

## Creating Your Own Publication List

1. Create a new directory with:
   - `index.html` — load CSS from `../../src/style-standard.css`, config, and script from `../../src/publication_listing.js`
   - `publication_config.js` — configure your HAL query, paths, and options

2. In `publication_config.js`, set:
   - `query`: array of HAL API query URLs
   - `default_thumbnail_path`: path to default thumbnail (e.g., `'../../src/thumbnail_default.jpg'`)
   - `css_path`: path prefix for CSS switching (e.g., `'../../src/'`)

3. Optionally add a `publication_customize/` directory with YAML customizations (see below).

## Customization (publication_customize.yaml)

The YAML customization file lets you override or enrich HAL metadata for individual publications. Each entry is keyed by its HAL id.

Run `update_publication_customize.py` after editing to regenerate the JS file:
```bash
python scripts/update_publication_customize.py path/to/publication_customize.yaml
```

### Available fields

| Field | Description | Example |
|---|---|---|
| `title` | Override the publication title | `title: "My Custom Title"` |
| `authors` | Override the author list | `authors: "Alice, Bob, Charlie"` |
| `year` | Override the publication year | `year: 2023` |
| `timestamp` | Override sorting order (format `YYYY-YYYY-MM-DD`) | `timestamp: '2023-2023-06-15'` |
| `conference` | Full conference name | `conference: Symposium on Computer Animation` |
| `conference_short` | Abbreviated conference name (shown in bold) | `conference_short: SCA` |
| `journal` | Full journal name | `journal: "Computer Graphics Forum"` |
| `journal_short` | Abbreviated journal name (shown in bold) | `journal_short: PACM CGIT` |
| `volume` | Journal volume | `volume: 38` |
| `issue` | Journal issue number | `issue: 4` |
| `pages` | Page range | `pages: "1-12"` |
| `article_number` | Article number | `article_number: 16` |
| `doi` | DOI identifier | `doi: 10.1145/3306346.3323010` |
| `award` | Award text (displayed in red/bold) | `award: "Best Paper Award"` |
| `thumbnail` | Custom thumbnail image or video | `thumbnail: "{{local}}assets/thumb.jpg"` |
| `article` | Link to the PDF/article | `article: "https://..."` |
| `video` | Link to a video | `video: "https://..."` |
| `video_presentation` | Link to a presentation video | `video_presentation: "https://..."` |
| `code` | Link to source code | `code: "https://github.com/..."` |
| `project_page` | Link to a project page | `project_page: "https://..."` |

### Path placeholders

Use these placeholders in string values — they are resolved at runtime from `publication_config.js`:

- **`{{local}}`** — replaced by `path_to_local` (typically `publication_customize/`), for assets bundled alongside the YAML file
- **`{{pathToData}}`** — replaced by `path_to_data` (typically `./`), for assets relative to the example directory

### Example

```yaml
hal-04665242:
  conference_short: SCA
  conference: Symposium on Computer Animation
  journal: "Computer Graphics Forum"
  award: "Best Paper Award"
  code: https://github.com/example/repo
  thumbnail: "{{local}}assets/thumbnail.jpg"
```

## Dependencies (for cache generation)

- Python 3
- `Pillow` (`pip install Pillow`)
- `PyYAML` (`pip install PyYAML`) — for `update_publication_customize.py`


## Static HTML export

The browser-only mode remains the default. To make the publication content
available in the initial HTML (including without JavaScript), optionally export
it at build time with **Node.js 18.3+**. No npm packages, browser, or network
access are needed for this step. The exporter uses the same normalization,
customization, ordering, thumbnail selection and HTML renderer as the browser.

First generate `cache/cache.json` with `generate_cache.py`. If you use YAML
customizations, regenerate `publication_customize.js` with
`update_publication_customize.py` before exporting.

```bash
# Fragment: only year headings and entries, ready for a template include
node scripts/export_html.mjs examples/02_full_featured/publication_config.js \
  --output examples/02_full_featured/cache/publications.html

# Complete HTML page: title, stylesheet and content; works without JavaScript
node scripts/export_html.mjs examples/02_full_featured/publication_config.js \
  --format page --title "Research publications" --lang en \
  --output examples/02_full_featured/publications.html

# Alternative grouping: year, then journal/conference/other
node scripts/export_html.mjs examples/02_full_featured/publication_config.js \
  --sort type --output examples/02_full_featured/cache/publications.html
```

Or use `just export-html` / `just export-page` with the existing `example`
variable. Export is opt-in: cache generation does not change existing pages.
Run `node scripts/export_html.mjs --help` for all options.

`cache_dir` and `path_to_local` are read from the configuration, relative to its
file. The default customization file is
`<path_to_local>/publication_customize.js`; it is optional. Override inputs with
`--cache FILE`, `--custom FILE`, or `--no-custom`. Explicit input/output file
arguments are relative to your working directory. Missing caches, malformed
JSON, and invalid options fail with a nonzero exit status before writing output.
Config/customization JavaScript must be trusted project code. Publication text
is HTML-escaped; inline HTML in title/author/award fields is not interpreted.

### Embed in a static site and keep interactivity

Include the fragment **at build time**, inside your existing listing container:

```html
<div id="listing-publication-menu"></div>
<div id="listing-publication">
  <!-- Insert the contents of cache/publications.html here during the build. -->
</div>
```

For example with Jinja: `{% include "publications/cache/publications.html" %}`
inside the container (adapt to your template loader root). Do not fetch the
fragment with JavaScript or place it only in `<noscript>`: its purpose is to
be part of the normal HTML response.

Keep your existing stylesheet, configuration, cache, customization and
`publication_listing.js` script tags if you want the menu, sorting and live HAL
updates. The script replaces the listing in the same container, so entries
are not duplicated. If the cache script is unavailable, exported content stays
visible while the HAL query is pending or fails. With JavaScript disabled,
the static list and article links remain usable; interactive controls are not
included in the fragment.

Fragment URLs retain their configured paths: the **containing page** must be
served from the same directory as the configuration, just like existing
examples. The fragment file itself may live in `cache/`. Complete-page exports
rebase relative asset/link URLs for the output directory; they reference existing
assets rather than copying or embedding them. Publish those assets alongside
the page. Regenerate the export whenever the cache or customizations change.

The default grouping retains the existing browser behavior of omitting
preprints; `--sort type` retains its grouping behavior, including other types.

### Tests

```bash
node --test tests/*.test.mjs
```

Tests use small local fixtures and do not query HAL or download media.
