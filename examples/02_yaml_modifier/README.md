# Modifier

This example shows the use of an additional YAML modifier file to update the displayed content.

Modifiers allows to rewrite on top of HAL information (e.g. to correct/refine HAL metadata), and can also add additional data that are not provided by HAL (e.g. code, project page).
Modifiers are parameterized in the file modifier.yaml.


The example should be run using a local server in order to serve the local files
```
e.g. 
python3 -m http.server
Then open the browser at http://localhost:8000/
```