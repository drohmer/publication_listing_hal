"""
generate_cache.py — Query HAL API, download and resize thumbnails, produce cache.js/cache.json.

Usage:
    python generate_cache.py [path/to/publication_config.js]

If no config path is given, looks for publication_config.js in the current directory.
Paths (cache_dir, default_thumbnail_path) are resolved relative to the config file location.
"""

import os
import sys
import re
import urllib.request
import ssl
import json
import shutil
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from PIL import Image


image_extension = ['.jpg', '.jpeg', '.jfif', '.webp', '.svg', '.png', '.gif']
video_extension = ['.mp4', '.webm']

# Max parallel downloads
MAX_WORKERS = 8


# ============================================================
#  Pretty output (cargo-style)
# ============================================================

GREEN = '\033[1;32m'
CYAN = '\033[1;36m'
RED = '\033[1;31m'
YELLOW = '\033[1;33m'
DIM = '\033[2m'
RESET = '\033[0m'

def status(verb, message):
    """Print a cargo-style status line: green verb + message."""
    print(f'{GREEN}{verb:>12}{RESET} {message}')

def warn(verb, message):
    print(f'{YELLOW}{verb:>12}{RESET} {message}')

def error(verb, message):
    print(f'{RED}{verb:>12}{RESET} {message}')

def dim(text):
    return f'{DIM}{text}{RESET}'


# ============================================================
#  Thumbnail selection from HAL annexes
# ============================================================

def contain_thumbnail(url):
    """Check if the filename (without extension) starts or ends with 'thumbnail'."""
    filename = url.split('/').pop()
    filename_raw = os.path.splitext(filename)[0]
    return filename_raw.startswith('thumbnail') or filename_raw.endswith('thumbnail')

def fill_thumbnail_url_data(url):
   filename = url.split('/').pop()
   file_rawname, file_ext = os.path.splitext(filename)
   return {'valid': True, 'url': url, 'name': file_rawname, 'ext': file_ext}

def get_thumbnail_url(data_hal):
    """
    Pick the best thumbnail URL from a HAL entry's annexes.
    Priority: video thumbnail > image thumbnail > first image > HAL thumb API > None.
    """
    is_video = lambda url: os.path.splitext(url)[1] in video_extension
    is_image = lambda url: os.path.splitext(url)[1] in image_extension

    if 'fileAnnexes_s' in data_hal:
        annexes = data_hal['fileAnnexes_s']

        for url in annexes:
            if is_video(url) and contain_thumbnail(url):
                return fill_thumbnail_url_data(url)

        for url in annexes:
            if is_image(url) and contain_thumbnail(url):
                return fill_thumbnail_url_data(url)

        for url in annexes:
            if is_image(url):
                return fill_thumbnail_url_data(url)

    if 'thumbId_i' in data_hal:
        url = 'https://thumb.ccsd.cnrs.fr/'+str(data_hal['thumbId_i'])+'/thumb/medium'
        return {'valid': True, 'url': url, 'name': "default_thumbnail", 'ext': '.jpg'}

    return {'valid': False, 'url': None, 'name': None, 'ext': None}


# ============================================================
#  Image conversion (resize + convert to JPG)
# ============================================================

def convert_image(dir_in, filename_in):
    """Resize image to max 300px and convert to JPG. Returns the (possibly new) filename."""
    filename_raw, filename_ext = os.path.splitext(filename_in)
    if filename_ext in image_extension:
        filepath_in = os.path.join(dir_in, filename_in)
        with Image.open(filepath_in) as image:
            xres, yres = image.size
            if xres > 300 or yres > 300 or filename_ext != '.jpg':

                filename_out = filename_raw + '.jpg'
                filepath_out = os.path.join(dir_in, filename_out)

                ratio = min(300/xres, 300/yres)
                new_x = int(ratio * xres)
                new_y = int(ratio * yres)
                image = image.resize((new_x, new_y))
                image = image.convert('RGB')
                image.save(filepath_out)

                if filename_in != filename_out:
                    os.remove(filepath_in)

                return filename_out
    return filename_in


def create_dirs(dir):
    if len(dir) > 0 and not dir.endswith('/'):
        dir = dir + '/'
    os.makedirs(os.path.join(dir, 'thumbnails'), exist_ok=True)


# ============================================================
#  JS config parser (parse publication_config.js without js2py)
# ============================================================

def strip_js_comments(text):
    """Remove single-line // comments, but not those inside quoted strings."""
    lines = text.split('\n')
    stripped = []
    for line in lines:
        in_single = False
        in_double = False
        result = line
        for i in range(len(line) - 1):
            c = line[i]
            if c == '"' and not in_single:
                in_double = not in_double
            elif c == "'" and not in_double:
                in_single = not in_single
            elif c == '/' and line[i+1] == '/' and not in_single and not in_double:
                result = line[:i]
                break
        stripped.append(result)
    return '\n'.join(stripped)

def parse_js_config(config_path):
    """
    Extract the publication_config object from a JS file and return it as a dict.
    Handles trailing commas, unquoted keys, single quotes, and // comments.
    """
    with open(config_path) as fid:
        js_content = fid.read()

    js_content = strip_js_comments(js_content)

    match = re.search(r'const\s+publication_config\s*=\s*\{', js_content)
    if not match:
        raise ValueError("Could not find publication_config in " + config_path)

    # Find matching closing brace
    brace_start = js_content.index('{', match.start())
    depth = 0
    end = brace_start
    for i in range(brace_start, len(js_content)):
        if js_content[i] == '{':
            depth += 1
        elif js_content[i] == '}':
            depth -= 1
            if depth == 0:
                end = i + 1
                break

    obj_str = js_content[brace_start:end]

    # Convert JS object literal to valid JSON
    obj_str = re.sub(r',\s*}', '}', obj_str)         # trailing commas before }
    obj_str = re.sub(r',\s*]', ']', obj_str)         # trailing commas before ]
    obj_str = re.sub(r'(\{|,)\s*(\w+)\s*:', r'\1 "\2":', obj_str)  # quote keys
    obj_str = re.sub(r"'([^']*)'", r'"\1"', obj_str) # single → double quotes

    return json.loads(obj_str)


# ============================================================
#  Thumbnail download (single entry)
# ============================================================

def download_one_thumbnail(entry, cache_dir, default_thumbnail):
    """Download/copy thumbnail for one entry. Returns (hal_id, relative_filename, log_lines)."""
    hal_id = entry['halId_s']
    title = entry['title_s'][0]
    thumbnail_url = get_thumbnail_url(entry)

    if thumbnail_url['valid']:
        filename = 'thumbnails/' + hal_id + thumbnail_url['ext']
        try:
            urllib.request.urlretrieve(thumbnail_url['url'], cache_dir + filename)
            return (hal_id, filename, 'ok', title)
        except Exception:
            filename_out = 'thumbnails/' + hal_id + '.jpg'
            shutil.copy(default_thumbnail, cache_dir + filename_out)
            return (hal_id, filename_out, 'fallback', title)
    else:
        filename_out = 'thumbnails/' + hal_id + '.jpg'
        shutil.copy(default_thumbnail, cache_dir + filename_out)
        return (hal_id, filename_out, 'default', title)


# ============================================================
#  Main
# ============================================================

def main():

    t_start = time.time()

    # Accept optional config path as CLI argument
    if len(sys.argv) > 1:
        config_path = sys.argv[1]
    else:
        config_path = 'publication_config.js'

    status('Reading', config_path)
    config_dir = os.path.dirname(os.path.abspath(config_path))
    config = parse_js_config(config_path)

    # cache_dir_relative is kept for writing browser-relative paths in cache.js
    cache_dir_relative = config['cache_dir']
    if not cache_dir_relative.endswith('/'):
        cache_dir_relative = cache_dir_relative + '/'

    # Absolute cache dir for file I/O
    cache_dir = cache_dir_relative
    if not os.path.isabs(cache_dir):
        cache_dir = os.path.join(config_dir, cache_dir)
    if not cache_dir.endswith('/'):
        cache_dir = cache_dir + '/'

    create_dirs(cache_dir)

    # Required for some CNRS/HAL thumbnail servers
    ssl._create_default_https_context = ssl._create_unverified_context

    # ------ Query HAL ------
    data = []
    for q in config['query']:
        query = q.replace(' ', '%20')
        req = urllib.request.Request(query)
        status('Querying', 'HAL API ...')
        with urllib.request.urlopen(req) as response:
            html = response.read()
            docs = json.loads(html)['response']['docs']
            data = data + docs
        status('Fetched', f'{len(docs)} publications')

    status('Found', f'{len(data)} publications total')

    # ------ Download thumbnails (parallel) ------
    default_thumbnail = config['default_thumbnail_path']
    if not os.path.isabs(default_thumbnail):
        default_thumbnail = os.path.join(config_dir, default_thumbnail)

    thumbnail_cache = {}
    count_ok = 0
    count_fallback = 0
    count_default = 0

    status('Downloading', f'thumbnails ({MAX_WORKERS} threads) ...')

    with ThreadPoolExecutor(max_workers=MAX_WORKERS) as pool:
        futures = {
            pool.submit(download_one_thumbnail, entry, cache_dir, default_thumbnail): entry
            for entry in data
        }
        for i, future in enumerate(as_completed(futures), 1):
            hal_id, filename, result_type, title = future.result()
            thumbnail_cache[hal_id] = filename

            short_title = title if len(title) <= 60 else title[:57] + '...'
            progress = dim(f'[{i}/{len(data)}]')

            if result_type == 'ok':
                count_ok += 1
                print(f'{"":>12} {progress} {hal_id} {dim(short_title)}')
            elif result_type == 'fallback':
                count_fallback += 1
                warn('Warning', f'{progress} {hal_id} download failed, using default')
            else:
                count_default += 1
                print(f'{"":>12} {progress} {hal_id} {dim("(default)")}')

    status('Downloaded', f'{count_ok} ok, {count_default} default, {count_fallback} failed')

    # ------ Resize thumbnails ------
    status('Converting', 'thumbnails to JPG (max 300px) ...')
    for hal_id in thumbnail_cache:
        filename_in = thumbnail_cache[hal_id]
        filename_out = convert_image(cache_dir, filename_in)
        thumbnail_cache[hal_id] = filename_out
    status('Converted', f'{len(thumbnail_cache)} thumbnails')

    # ------ Write cache files ------
    # Paths in cache_thumbnail are relative to the HTML file (= config directory)
    for k, entry in enumerate(data):
        hal_id = entry['halId_s']
        data[k]['cache_thumbnail'] = cache_dir_relative + thumbnail_cache[hal_id]

    cache_js = 'const cache = '+json.dumps(data, indent=2)
    with open(cache_dir+'cache.js', 'w') as fid:
        fid.write(cache_js)
    with open(cache_dir+'cache.json', 'w') as fid:
        fid.write(json.dumps(data, indent=2))

    elapsed = time.time() - t_start
    status('Finished', f'cache written to {cache_dir} in {elapsed:.1f}s')


if __name__ == '__main__':
    main()
