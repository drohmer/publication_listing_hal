import os
import urllib.request
import json
import ssl
import shutil
import yaml
from PIL import Image

config_path = 'config.yaml'



def generate_query_txt(query, query_filter):

    query_txt = f'https://api.archives-ouvertes.fr/search/?q={query}&fl=publicationDateY_i,submittedDateY_i,submittedDateM_i,submittedDateD_i,title_s,authFullName_s,doiId_s,journalTitle_s,conferenceTitle_s,files_s,docType_s,fileAnnexes_s,halId_s,thumbId_i,issue_s,volume_s,linkExtUrl_s,bookTitle_s&rows=500&fq={query_filter}';

    return query_txt


# Extensions considered as image
image_extension = ['.jpg', '.jpeg', '.jfif', '.webp', '.svg', '.png', '.gif'];
# Extensions considered as video
video_extension = ['.mp4', '.webm'];

def contain_thumbnail(url):
    filename = url.split('/').pop()
    filename_raw = os.path.splitext(url)[0]
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

def convert_image(filename_in):

    filename_raw, filename_ext = os.path.splitext(filename_in)
    if filename_ext in image_extension:
        with Image.open(filename_in) as image:
            xres, yres = image.size
            if xres>300 or yres>300 or filename_ext!='.jpg':

                filename_out = filename_raw+'.jpg'

                ratio = min(300/xres, 300/yres)
                new_x = int(ratio * xres)
                new_y = int(ratio * yres)
                image.resize((new_x, new_y))
                image = image.convert('RGB')

                image.save(filename_out)

                if filename_in != filename_out:
                    os.remove(filename_in)

                return filename_out
    return filename_in


def create_dirs(config):
    if len(config['cache_dir'])>0 and not config['cache_dir'].endswith('/'):
        config['cache_dir'] = config['cache_dir']+'/'

    if not os.path.isdir(config['cache_dir']):
        os.mkdir(config['cache_dir'])
    if not os.path.isdir(config['cache_dir']+'thumbnails'):
        os.mkdir(config['cache_dir']+'thumbnails')

def main():

    with open(config_path) as fid:
        config = yaml.load(fid, Loader=yaml.loader.SafeLoader)

    create_dirs(config)

    ssl._create_default_https_context = ssl._create_unverified_context

    query_txt = generate_query_txt(config['query'],config['filter']).replace(' ','%20')
    req = urllib.request.Request(query_txt)
    print("[ Query HAL ] ...")
    with urllib.request.urlopen(req) as response:
        html = response.read()
        data = json.loads(html)['response']['docs']
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
            filename = config['cache_dir']+'thumbnails/'+hal_id+thumbnail_url['ext']
            urllib.request.urlretrieve(thumbnail_url['url'], filename)
            thumbnail_cache[hal_id] = filename
        else:
            filename_in = config['default_thumbnail_path']
            filename_out = config['cache_dir']+'thumbnails/'+hal_id+'.jpg'
            shutil.copy(filename_in, filename_out)
            thumbnail_cache[hal_id] = filename_out
    
    # Convert cache thumbnails
    print("[ Convert thumbnails ]")
    for hal_id in thumbnail_cache:
        filename_in = thumbnail_cache[hal_id]
        filename_out = convert_image(filename_in)
        thumbnail_cache[hal_id] = filename_out

    # Update JSON with cache
    for k,entry in enumerate(data):
        hal_id=entry['halId_s']
        data[k]['cache_thumbnail'] = thumbnail_cache[hal_id]

    with open(config['cache_dir']+'cache.json','w') as fid:
        fid.write( json.dumps(data,indent=2) )

    print("[ Cache file ] writen in "+config['cache_dir']+'cache.json')    

main()