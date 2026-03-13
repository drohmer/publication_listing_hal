import json
import os
import sys
import yaml


if __name__ == '__main__':

    # Accept optional YAML path as CLI argument
    if len(sys.argv) > 1:
        filename = sys.argv[1]
    else:
        filename = 'publication_customize.yaml'

    # Output JS file next to the YAML file
    output_dir = os.path.dirname(os.path.abspath(filename))
    output_file = os.path.join(output_dir, 'publication_customize.js')

    # Export custom as js
    print("[ Export custom js ]" )
    with open(filename) as fid:
        content = fid.read()
        custom = yaml.load(content, Loader=yaml.loader.SafeLoader)
    with open(output_file,'w') as fid:
        custom_js = 'const custom = '+json.dumps(custom,indent=2)
        fid.write( custom_js )

    print("[ Custom file ] writen in "+output_file)
