"""
update_publication_customize.py — Convert a YAML customization file to a JS file.

Usage:
    python update_publication_customize.py [path/to/publication_customize.yaml]

If no path is given, looks for publication_customize.yaml in the current directory.
The output JS file is written next to the YAML file as publication_customize.js.
"""

import json
import os
import sys
import yaml


def main():
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = 'publication_customize.yaml'

    # Output publication_customize.js next to the YAML source
    output_dir = os.path.dirname(os.path.abspath(filename))
    output_file = os.path.join(output_dir, 'publication_customize.js')

    print("[ Export custom js ]")
    with open(filename) as fid:
        content = fid.read()
        custom = yaml.load(content, Loader=yaml.loader.SafeLoader)

    with open(output_file, 'w') as fid:
        custom_js = 'const custom = '+json.dumps(custom, indent=2)
        fid.write(custom_js)

    print("[ Custom file ] writen in "+output_file)


if __name__ == '__main__':
    main()
