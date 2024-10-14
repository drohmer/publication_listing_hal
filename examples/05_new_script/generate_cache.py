import os
import urllib.request
import ssl
import json
import shutil
import js2py #pip install js2py
from PIL import Image

cache_dir = 'cache/'
config_path = 'publication_config.js'



# Extensions considered as image
image_extension = ['.jpg', '.jpeg', '.jfif', '.webp', '.svg', '.png', '.gif']
# Extensions considered as video
video_extension = ['.mp4', '.webm']




def contain_thumbnail(url):
    filename = url.split('/').pop()
    filename_raw = os.path.splitext(filename)[0]
    if filename_raw.startswith('thumbnail') or filename_raw.endswith('thumbnail'):
        return True
    return False

def fill_thumbnail_url_data(url):
   filename = url.split('/').pop()
   file_rawname,file_ext = os.path.splitext(filename)
   return {'valid':True, 'url':url, 'name':file_rawname, 'ext':file_ext}

def get_thumbnail_url(data_hal) :

    is_video = lambda url : os.path.splitext(url)[1] in video_extension
    is_image = lambda url : os.path.splitext(url)[1] in image_extension
    

    if 'fileAnnexes_s' in data_hal:

        annexes = data_hal['fileAnnexes_s'];

        # 1st priority: video thumbnail
        for url in annexes:
            if is_video(url) and contain_thumbnail(url):
                return fill_thumbnail_url_data(url)

        # 2nd priority: image thumbnail
        for url in annexes:
            if is_image(url) and contain_thumbnail(url):
                return fill_thumbnail_url_data(url)

        # 3rd priority: first image found
        for url in annexes:
            if is_image(url):
                return fill_thumbnail_url_data(url)

    # Otherwise go to default HAL thumbnail
    if 'thumbId_i' in data_hal:
        url = 'https://thumb.ccsd.cnrs.fr/'+str(data_hal['thumbId_i'])+'/thumb/medium'
        return {'valid':True, 'url':url, 'name':"default_thumbnail", 'ext':'.jpg'}

    #print('No thumbnail for entry ',data_hal)
    return {'valid':False, 'url':None, 'name':None, 'ext':None}

def convert_image(dir_in,filename_in):

    filename_raw, filename_ext = os.path.splitext(filename_in)
    if filename_ext in image_extension:
        with Image.open(dir_in+filename_in) as image:
            xres, yres = image.size
            if xres>300 or yres>300 or filename_ext!='.jpg':

                filename_out = filename_raw+'.jpg'

                ratio = min(300/xres, 300/yres)
                new_x = int(ratio * xres)
                new_y = int(ratio * yres)
                image.resize((new_x, new_y))
                image = image.convert('RGB')

                image.save(dir_in+filename_out)

                if filename_in != filename_out:
                    os.remove(dir_in+filename_in)

                return dir_in+filename_out
    return dir_in+filename_in


def create_dirs(dir):

    if len(dir)>0 and not dir.endswith('/'):
        dir = dir+'/'

    if not os.path.isdir(dir):
        os.mkdir(dir)
    if not os.path.isdir(dir+'thumbnails'):
        os.mkdir(dir+'thumbnails')


def main():

    with open(config_path) as fid:
        
        js_content = fid.read()
        js_content = js_content.replace('export','// ')
        js_content = js_content + "\n function export_config(){return publication_config }; export_config()"
        
        config = js2py.eval_js(js_content)

    create_dirs(cache_dir)

    ssl._create_default_https_context = ssl._create_unverified_context

    data = []
    for q in config['query']:
        query = q.replace(' ','%20')

        req = urllib.request.Request(query)
        print("[ Query HAL ] ...")
        with urllib.request.urlopen(req) as response:
            html = response.read()
            data = data + json.loads(html)['response']['docs']
        print("[ Query HAL ] OK")
    


    # Download cache thumbnails
    print("[ Download thumbnails ]", len(data),"publications")
    thumbnail_cache = {}
    for k,entry in enumerate(data):
        
        hal_id=entry['halId_s']
        print('\t ['+str(k)+'/'+str(len(data))+'] ',hal_id,'-',entry['title_s'][0])

        thumbnail_url = get_thumbnail_url(entry)

        if thumbnail_url['valid']:
            print('\t    Found thumbnail: ',thumbnail_url['url'])
            filename = 'thumbnails/'+hal_id+thumbnail_url['ext']
            try:
                urllib.request.urlretrieve(thumbnail_url['url'], cache_dir+filename)
                thumbnail_cache[hal_id] = filename
            except:
                print('\t    Error: thumbnail not found')
                thumbnail_cache[hal_id] = config['default_thumbnail_path']
        else:
            filename_in = config['default_thumbnail_path']
            filename_out = 'thumbnails/'+hal_id+'.jpg'
            shutil.copy(filename_in, cache_dir+filename_out)
            thumbnail_cache[hal_id] = filename_out
    
    # Convert cache thumbnails
    print("[ Convert thumbnails ]")
    for hal_id in thumbnail_cache:
        filename_in = thumbnail_cache[hal_id]
        filename_out = convert_image(cache_dir,filename_in)
        thumbnail_cache[hal_id] = filename_out

    # Update JSON with cache
    for k,entry in enumerate(data):
        hal_id=entry['halId_s']
        data[k]['cache_thumbnail'] = thumbnail_cache[hal_id]

    cache_js = 'const cache = '+json.dumps(data,indent=2)#+'\n\nexport { cache }'
    with open(cache_dir+'cache.js','w') as fid:
        fid.write( cache_js )
    with open(cache_dir+'cache.json','w') as fid:
        fid.write( json.dumps(data,indent=2) )

    print("[ Cache file ] writen in "+cache_dir+'cache.js')




if __name__ == '__main__':
    main()