import json
import yaml

filename = 'publication_customize.yaml'


if __name__ == '__main__':

    # Export custom as js
    print("[ Export custom js ]" )
    with open(filename) as fid:
        content = fid.read()
        #content = content.replace('{{local}}',config['custom_local'])
        #content = content.replace('{{pathToData}}',config['path_to_data'])
        
        custom = yaml.load(content, Loader=yaml.loader.SafeLoader)
    with open('publication_customize.js','w') as fid:
        custom_js = 'const custom = '+json.dumps(custom,indent=2)#+'\n\nexport { custom }'
        fid.write( custom_js )

    print("[ Custom file ] writen in publication_customize.js")
