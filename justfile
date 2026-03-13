# Default example directory (override with: just --set example examples/02_full_featured)
example := "examples/02_full_featured"

# Show available recipes
default:
    @just --list

# Run all update steps: customize then cache
update: update-customize update-cache

# Convert publication_customize.yaml → .js
update-customize:
    python scripts/update_publication_customize.py {{example}}/publication_customize/publication_customize.yaml

# Query HAL API, download thumbnails, generate cache.js
update-cache:
    python scripts/generate_cache.py {{example}}/publication_config.js

# Delete generated cache files (thumbnails, cache.js, cache.json)
clean:
    rm -rf {{example}}/cache/thumbnails
    rm -f {{example}}/cache/cache.js {{example}}/cache/cache.json

# Serve the example via a local HTTP server
serve port="8000":
    python -m http.server {{port}}
