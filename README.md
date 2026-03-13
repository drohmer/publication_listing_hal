# Publication Listing

Script to display HAL publications in an HTML page with:
* Robust thumbnail handling (image and video)
* Cache system for faster loading
* Customization via YAML annotations (links to code, project page, refined conference/journal names, awards, etc.)
* CSS themes (standard and condensed)
* Sorting by year or by publication type (journal/conference)

## Project Structure

```
publication_listing/
  src/
    publication_listing.js          # Main JS script
    style.css                       # Standard CSS theme
    style-condensated.css           # Condensed CSS theme
    generate_cache.py               # Cache generator (queries HAL, downloads thumbnails)
    update_publication_customize.py # Converts YAML customization to JS
    thumbnail_default.jpg           # Default thumbnail image
  examples/
    01_minimal/                     # Minimal example (no customization)
    02_full_featured/               # Full example with cache and customization
```

## Quick Start

### 1. Minimal usage

Open `examples/01_minimal/index.html` via a local HTTP server. It queries HAL directly and displays publications.

### 2. Full-featured usage

The `examples/02_full_featured/` example demonstrates cache and customization:

1. **Generate the cache** (downloads thumbnails for faster loading):
   ```bash
   cd examples/02_full_featured
   python ../../src/generate_cache.py publication_config.js
   ```

2. **Edit customizations** in `publication_customize/publication_customize.yaml`, then regenerate:
   ```bash
   python ../../src/update_publication_customize.py publication_customize/publication_customize.yaml
   ```

3. **Open** `index.html` via a local HTTP server.

## Creating Your Own Publication List

1. Create a new directory with:
   - `index.html` — load CSS from `../../src/style.css`, config, and script from `../../src/publication_listing.js`
   - `publication_config.js` — configure your HAL query, paths, and options

2. In `publication_config.js`, set:
   - `query`: array of HAL API query URLs
   - `default_thumbnail_path`: path to default thumbnail (e.g., `'../../src/thumbnail_default.jpg'`)
   - `css_path`: path prefix for CSS switching (e.g., `'../../src/'`)

3. Optionally add a `publication_customize/` directory with YAML customizations.

## Dependencies (for cache generation)

- Python 3
- `js2py` (`pip install js2py`)
- `Pillow` (`pip install Pillow`)
- `PyYAML` (`pip install PyYAML`) — for `update_publication_customize.py`
