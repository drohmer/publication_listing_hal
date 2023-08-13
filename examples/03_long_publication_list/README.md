This example shows a long publication list.

# Simple usage

Open index.html in any browser to see the example.
The configuration file is provided at config.yaml with default values.

To run the page locally, you may start a server in order to read the configuration file
```
python3 -m http.server
Then open the browser at http://localhost:8000/
```


# Adding cache

A cache file can be generated such that the publications appears faster than with querying HAL.

The cache can be generated using the python call

```
python3 generate_cache.py
```

This fill download and resize thumbnail images if available, and prepare a file cache/cache.json with pre-downloaded HAL information, and the thumbnails are in cache/thumbnails/.

The cache data are loaded automatically if available (see config.yaml for further setup). HAL is still queried after displaying the cached data. HAL do not replaced the one that are already cached, it only adds new entry that are not yet cached.
