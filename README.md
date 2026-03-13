# Publication Listing

Script to display HAL publications in an HTML page with:
* Robust thumbnail handling (image and video)
* Cache system for faster loading
* Customization via YAML annotations (links to code, project page, refined conference/journal names, awards, etc.)
* CSS themes (standard and compact)
* Sorting by year or by publication type (journal/conference)

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
