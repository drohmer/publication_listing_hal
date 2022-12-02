import shutil

src = 'src/listing.js'
shutil.copyfile(src, 'examples/01_simple_hal_query/listing.js')
shutil.copyfile(src, 'examples/02_yaml_modifier/listing.js')

print('Examples updated')
