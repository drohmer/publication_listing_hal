"use strict";

// cache and custom are optional globals from cache/cache.js and publication_customize.js.
// They may not be loaded (e.g. in the minimal example) — handled with fallbacks in main().

const global_hal_listing = {
    data : null,             // All publications indexed by HAL id
    data_sorted : null,      // Publications grouped by year
    data_sorted_type : null, // Publications grouped by year then type (journal/conference/other)
    sorting_type : 'default',
    html_root_element: null,
    html_root_menu_element: null,
};

const image_extension = ['jpg', 'jpeg', 'jfif', 'webp', 'svg', 'png', 'gif'];
const video_extension = ['mp4', 'webm'];


// ============================================================
//  Utility helpers
// ============================================================

function initialize_global() {
    global_hal_listing.html_root_element = document.querySelector(publication_config.html_tag_publication);
    global_hal_listing.html_root_menu_element = document.querySelector(publication_config.html_tag_publication_menu);
    global_hal_listing.data = new Object();
    global_hal_listing.data_sorted = new Object();
}

/** Extract file extension from a URL or filepath (handles multiple dots). */
const get_extension = function(filepath) {
    const filename = filepath.split('/').pop();
    const token = filename.split('.');
    return token[token.length - 1];
}
const is_image = function(filepath) {
    return image_extension.includes(get_extension(filepath));
}
const is_video = function(filepath) {
    return video_extension.includes(get_extension(filepath));
}

/** Extract filename without extension from a URL. */
function get_filename_base(url) {
    const filename = url.split('/').pop();
    const dot_index = filename.lastIndexOf('.');
    return dot_index > 0 ? filename.substring(0, dot_index) : filename;
}

/** Check if a filename base starts or ends with "thumbnail". */
const is_thumbnail_name = (name) => name.startsWith('thumbnail') || name.endsWith('thumbnail');


// ============================================================
//  HTML generation helpers
// ============================================================

function html_tag_image(source, alt="illustration", css_class="", css_id="") {
    const id_attr = css_id ? ` id="${css_id}"` : '';
    const class_attr = css_class ? ` class="${css_class}"` : '';
    return `<img loading="lazy"${id_attr}${class_attr} src="${source}" alt="${alt}" />`;
}

function html_tag_video(source, extra="muted autoplay loop") {
    let mime='';
    if(source.endsWith('.mp4')) {
        mime = 'type="video/mp4"';
    }
    else if(source.endsWith('.webm')) {
        mime = 'type="video/webm"';
    }

    let html = '<video class="video_thumbnail" preload="metadata" ';
    html += extra;
    html += ' poster="'+publication_config.default_thumbnail_path+'"';
    html += '>'
    html += `<source src="${source}" ${mime}>`
    html += '</video>';
    return html;
}

/**
 * Return the HTML for the thumbnail of a publication entry.
 * Priority: custom thumbnail > HAL annex thumbnail > HAL thumb API > default image.
 */
function export_html_thumbnail(entry) {

    let thumbnail_url = entry['thumbnail'];

    if(thumbnail_url !== undefined) {
        if(is_video(thumbnail_url)) {
            return html_tag_video(thumbnail_url,'');
        }
        else if(is_image(thumbnail_url)) {
            return html_tag_image(thumbnail_url, 'thumbnail');
        }
    }

    // Fallback: HAL thumbnail via thumb API
    if(entry.url_thumbnail_hal!=undefined) {
        const hal_thumbnail = 'https://thumb.ccsd.cnrs.fr/'+entry.url_thumbnail_hal+'/thumb/medium';
        return html_tag_image(hal_thumbnail, 'thumbnail');
    }

    return html_tag_image(publication_config.default_thumbnail_path, 'thumbnail');
}

/** Format a short/long name pair (e.g. conference or journal) as HTML. */
function format_name_pair(short_name, long_name) {
    if(short_name != undefined && long_name != undefined) {
        return `<strong>${short_name}</strong> (${long_name})`;
    }
    if(short_name != undefined) return `<strong>${short_name}</strong>`;
    if(long_name != undefined) return `<strong>${long_name}</strong>`;
    return '';
}

/** Build the journal/conference line with optional volume, issue, pages. */
function export_html_journal(entry) {

    let html_issue_volume = '';
    if(entry.volume != undefined) {
        html_issue_volume += ', Vol. '+entry.volume;
    }
    if(entry.issue != undefined) {
        html_issue_volume += ', Issue '+entry.issue;
    }
    if(entry.article_number != undefined) {
        html_issue_volume += ', Art. No. '+entry.article_number;
    }
    if(entry.pages != undefined) {
        html_issue_volume += ', p.'+entry.pages;
    }

    // Build journal name from custom conference/journal fields, or fall back to HAL auto
    const conf_part = format_name_pair(entry.conference_short, entry.conference);
    const journal_part = format_name_pair(entry.journal_short, entry.journal);

    let html_journal_name = '';
    if(conf_part === '' && journal_part === '') {
        html_journal_name = `<strong>${entry.journal_auto}</strong>`;
    }
    else {
        html_journal_name = [conf_part, journal_part].filter(s => s !== '').join('<br>');
    }

    let html = '';
    if(entry.journal_auto != '') {
        html += `${html_journal_name}${html_issue_volume}, ${entry.year}`;
    }
    else {
        html += entry.year;
    }
    return html;
}

function export_html_authors(entry){
    return Array.isArray(entry.authors) ? entry.authors.join(', ') : entry.authors;
}


// ============================================================
//  UI controls: CSS theme switch and sorting toggle
// ============================================================

/** Switch stylesheet. Uses css_path from config to resolve theme files in src/. */
function change_css(event) {
    const css_path = publication_config.css_path || '';
    const lookup_css_file = {'css-standard': css_path+'style-standard.css', 'css-min': css_path+'style-compact.css'};
    const css_hal = document.querySelector("#css-hal");
    css_hal.href = lookup_css_file[event.currentTarget.id];
}

function change_sorting(event) {
    const lookup = {'sorting-default':'default', 'sorting-type':'type'};
    global_hal_listing.sorting_type = lookup[event.currentTarget.id];
    display_data();
}


// ============================================================
//  Display: menu, entries, and full listing
// ============================================================

/** Generate the navigation menu with year quick-links, CSS switch, and sorting toggle. */
function display_menu() {

    const all_years = Object.keys(global_hal_listing.data_sorted).sort().reverse();

    let html_txt = '';
    html_txt += `Quick access: `;
    let counter_year = 0;
    for(const year of all_years) {
        if( counter_year%publication_config.menu_year_increment === 0 ){
            html_txt += `[<a href="#year-${year}">${year}</a>] `;
        }
        counter_year = counter_year + 1;
    }
    html_txt += '<br>';
    html_txt += 'CSS: <input type="radio" name="css-select" id="css-standard" value="Standard" checked ><label for="css-standard">Standard</label> <input type="radio" id="css-min" name="css-select" value="Minimalist"><label for="css-min">Min</label>';

    html_txt += '<br>';
    html_txt += 'Sorting: <input type="radio" name="sort-type" id="sorting-default" value="Default" checked ><label for="sorting-default">All</label> <input type="radio" id="sorting-type" name="sort-type" value="Type"><label for="sorting-type">Journal/Conference</label>'

    global_hal_listing.html_root_menu_element.innerHTML = html_txt;

    document.querySelector('#css-standard').addEventListener('click',change_css);
    document.querySelector('#css-min').addEventListener('click',change_css);
    document.querySelector('#sorting-default').addEventListener('click',change_sorting);
    document.querySelector('#sorting-type').addEventListener('click',change_sorting);
}

/** Generate the HTML for a single publication entry. */
function display_entry(entry) {

    let id = entry.id;
    let thumbnail_html = export_html_thumbnail(entry);
    let journal_html = export_html_journal(entry);
    let authors = export_html_authors(entry);

    let html_txt = '';
    html_txt += `<div class="publication-entry" id="${id}">`;

    html_txt += `  <div class="thumbnail">`;
    html_txt += thumbnail_html;
    html_txt += `  </div>`;

    html_txt += `  <div class="description">`;
    html_txt += `     <div class="title">${entry.title}</div>`;
    html_txt += `     <div class="authors">${authors}.</div>`;
    html_txt += `     <div class="journal">${journal_html}</div>`;

    if(entry.award != undefined) {
        html_txt += `<div class="award">${entry.award}</div>`;
    }
    if(entry.doi != undefined) {
        html_txt += `     <div class="doi"><a href="https://doi.org/${entry.doi}">${entry.doi}</a></div>`;
    }

    // Links row — each optional link is defined as [field, css_class, label]
    const optional_links = [
        ['article',            'article',      'Article'],
        ['video',              'video',        'Video'],
        ['video_presentation', 'presentation', 'Presentation'],
        ['code',               'code',         'Code'],
        ['project_page',       'project',      'Project'],
    ];
    html_txt += `     <div class="links">`;
    html_txt += `       <a class="hal" href="https://hal.archives-ouvertes.fr/${id}">Hal</a>`;
    for(const [field, css, label] of optional_links) {
        if(entry[field] != undefined) {
            html_txt += `       <a class="${css}" href="${entry[field]}">${label}</a>`;
        }
    }
    html_txt += `     </div>`;

    html_txt += `<div class="hal-id">${id}</div>`;
    html_txt += `  </div>`;
    html_txt += `</div>`;

    return html_txt;
}

/** Render all publications, grouped by year. Supports 'default' and 'type' sorting modes. */
function display_data() {
    const parent = global_hal_listing.html_root_element;
    parent.innerHTML = "";

    let html_txt = '';
    const all_years = Object.keys(global_hal_listing.data_sorted).sort().reverse();

    for(const year of all_years) {
        html_txt += `<h2 class="publication-year" id="year-${year}">${year}</h2>`;

        if(global_hal_listing.sorting_type==='default') {
            const N_entry = global_hal_listing.data_sorted[year].length;
            let counter_entry = 0;
            for(const entry of global_hal_listing.data_sorted[year]) {
                if(entry.journal_auto === "Preprint")
                    continue;

                html_txt += display_entry(entry);
                counter_entry = counter_entry+1;
                if(counter_entry<N_entry) {
                    html_txt += '<div class="publication-entry-separator"></div>';
                }
            }
        }
        else if(global_hal_listing.sorting_type==='type') {

            const type_order=[{'key':'journal','title':'Journal publications'},
            {'key':'conference','title':'Conference publications'},
            {'key':'other','title':'Others publications'}];

            for(const type of type_order) {
                const entries = global_hal_listing.data_sorted_type[year][type['key']];
                const N_entry = entries.length;
                if(N_entry>0) {
                    html_txt += `<h3 class="publication-type">${type['title']}</h3>`;
                    for(const entry of entries) {
                        html_txt += display_entry(entry);
                    }
                }
            }
        }
    }
    parent.innerHTML = html_txt;
}


// ============================================================
//  Data processing: sorting, merging, HAL field mapping
// ============================================================

/** Group publications by year, then sort within each year by timestamp (most recent first). */
function sort_data() {

    // Group by year
    global_hal_listing.data_sorted = {};
    for(const [id,entry] of Object.entries(global_hal_listing.data) ) {
        const year = entry.year;
        if(global_hal_listing.data_sorted[year] == undefined) {
            global_hal_listing.data_sorted[year] = [];
        }
        global_hal_listing.data_sorted[year].push(entry);
    }

    const all_years = Object.keys(global_hal_listing.data_sorted).sort();
    for(const year of all_years){
        global_hal_listing.data_sorted[year].sort((a,b)=> b.timestamp.localeCompare(a.timestamp));
    }

    // Group by year then publication type (ART → journal, COMM → conference, rest → other)
    global_hal_listing.data_sorted_type = {};
    for(const year of all_years) {
        global_hal_listing.data_sorted_type[year] = {'journal':[], 'conference':[], 'other':[]};

        for(const [id,entry] of Object.entries(global_hal_listing.data_sorted[year])) {
            const type = entry['type'];
            if(type==="ART") {
                global_hal_listing.data_sorted_type[year]['journal'].push(entry);
            }
            else if(type==="COMM") {
                global_hal_listing.data_sorted_type[year]['conference'].push(entry);
            }
            else {
                global_hal_listing.data_sorted_type[year]['other'].push(entry);
            }
        }
    }
}

function remove_incorrect_data() {
    for(const [id,entry] of Object.entries(global_hal_listing.data) ) {
        if(entry.timestamp == undefined) {
            console.log('Warning: remove entry from data as timestamp is not defined ',entry);
            delete global_hal_listing.data[id];
        }
    }
}

/** Clean, sort, and re-render all publication data. */
function update_data_and_display() {
    global_hal_listing.html_root_element.innerHTML = "";
    remove_incorrect_data();
    sort_data();

    if(publication_config.html_menu === true){
        display_menu();
    }
    display_data();

    // Auto-play video thumbnails once loaded
    for(const vid of document.querySelectorAll('.video_thumbnail')) {
        vid.removeEventListener('canplay', video_loaded_action);
        vid.addEventListener('canplay', video_loaded_action);
    }
}

function video_loaded_action(event) {
    event.currentTarget.muted = true;
    event.currentTarget.loop = true;
    event.currentTarget.autoplay = true;
    event.currentTarget.play();
}

/** Build a sortable timestamp string from HAL date fields (publication year + submission date). */
function generate_timestamp(data_hal) {
    const y = String(data_hal.publicationDateY_i);
    const sy = String(data_hal.submittedDateY_i);
    const sm = String(data_hal.submittedDateM_i).padStart(2,'0');
    const sd = String(data_hal.submittedDateD_i).padStart(2,'0');
    return `${y}-${sy}-${sm}-${sd}`;
}

/** Set target[key_out] = value if defined and allowed by priority. */
function safe_set(target, key_out, value, priority_update) {
    if(value != undefined && (target[key_out] == undefined || priority_update === true)) {
        target[key_out] = value;
    }
}

/** Map HAL docType_s to a human-readable journal_auto label. */
const doctype_labels = {
    'REPORT': 'Technical Report',
    'HDR': 'HDR',
    'PROCEEDINGS': 'Proceedings',
    'PATENT': 'Patent',
    'THESE': 'PhD',
    'MEM': 'Master',
    'OUV': 'Book',
    'OTHER': '',
    'UNDEFINED': 'Preprint',
};

function generate_type_from_other_report(data, data_hal) {
    const doc_type = data_hal['docType_s'];
    if(doc_type === 'COUV') {
        data['journal_auto'] = 'Book Chapter in '+data_hal['bookTitle_s'];
    }
    else if(doc_type in doctype_labels) {
        data['journal_auto'] = doctype_labels[doc_type];
    }
}

/**
 * Find the best thumbnail URL from HAL annexes.
 * Priority: cache > video named "thumbnail" > image named "thumbnail" > first image.
 */
function find_thumbnail(entry) {

    if(entry.cache_thumbnail != undefined) {
        return entry.cache_thumbnail;
    }

    const annexes = entry.fileAnnexes_s;
    if(annexes == undefined) return;

    let first_image = undefined;
    for(const url of annexes) {
        const name = get_filename_base(url);
        if(is_video(url) && is_thumbnail_name(name)) return url;
        if(is_image(url) && is_thumbnail_name(name)) return url;
        if(is_image(url) && first_image == undefined) first_image = url;
    }
    return first_image;
}

/** Find the first non-thumbnail video in HAL annexes. */
function find_video(entry) {
    const annexes = entry.fileAnnexes_s;
    if(annexes!=undefined) {
        for(const url of annexes){
            if( is_video(url) && !is_thumbnail_name(get_filename_base(url)) ) {
                return url;
            }
        }
    }
}

// Declarative mapping from HAL field names to normalized entry fields
const hal_field_map = [
    ['halId_s',              'id'],
    ['publicationDateY_i',   'year'],
    ['authFullName_s',       'authors'],
    ['docType_s',            'type'],
    ['thumbId_i',            'url_thumbnail_hal'],
    ['journalTitle_s',       'journal_auto'],
    ['conferenceTitle_s',    'journal_auto'],
    ['issue_s',              'issue'],
    ['volume_s',             'volume'],
    ['files_s',              'article'],
    ['doiId_s',              'doi'],
];

/** Map raw HAL fields to normalized entry fields (id, title, authors, thumbnail, etc.). */
function update_value(data, priority_update) {
    for(const entry of Object.values(data)) {

        for(const [hal_key, out_key] of hal_field_map) {
            safe_set(entry, out_key, entry[hal_key], priority_update);
        }

        // Fields that need transformation
        if(entry['title_s']) {
            safe_set(entry, 'title', entry['title_s'][0], priority_update);
        }
        safe_set(entry, 'timestamp', generate_timestamp(entry), priority_update);

        // Thumbnail and video from annexes (only if not already set)
        if(entry['thumbnail'] === undefined) {
            safe_set(entry, 'thumbnail', find_thumbnail(entry), priority_update);
        }
        if(entry['video'] === undefined) {
            safe_set(entry, 'video', find_video(entry), priority_update);
        }

        if(entry['journal_auto'] === undefined) {
            generate_type_from_other_report(entry, entry);
        }
    }
}

/**
 * Merge new_data into current_data.
 * - priority_update: if true, new values overwrite existing ones
 * - create_new_entry: if true, entries not yet in current_data are added
 * Template placeholders {{local}} and {{pathToData}} are resolved from publication_config.
 */
function merge_data(current_data, new_data, priority_update, create_new_entry) {

    for(const [k,entry] of Object.entries(new_data) ) {
        let id = undefined;
        if(entry['id']!=undefined) {
            id = entry['id'];
        }
        else if (entry['halId_s']!=undefined) {
            id = entry['halId_s'];
        }
        else {
            id = k;
        }

        if(current_data[id] == undefined ) {
            if(create_new_entry === true) {
                current_data[id] = entry;
            }
        }
        else {
            for (let [key,value] of Object.entries(entry) ) {
                if(current_data[id][key] == undefined || priority_update === true) {
                    if(typeof value === 'string'){
                        value = value.replace('{{local}}',publication_config.path_to_local);
                        value = value.replace('{{pathToData}}',publication_config.path_to_data);
                    }
                    current_data[id][key] = value;
                }
            }
        }
    }

    update_value(current_data, priority_update);
}


// ============================================================
//  HAL API query
// ============================================================

function query_hal(query) {
    fetch(query)
    .then(convertJSON)
    .then(load_data_from_hal)
    .catch(error_fetch_from_hal);
}
function convertJSON(response) {return response.json();}
function error_fetch_from_hal(error) {
    console.log('Failed to fetch data from HAL');
    console.log(error);
}
function load_data_from_hal(data_hal_json) {
    const data_hal = data_hal_json.response.docs;
    merge_data(global_hal_listing['data'], data_hal, false, true);
    update_data_and_display();
}


// ============================================================
//  Entry point
// ============================================================

/**
 * 1. Load cached data (if any) and custom overrides — these are available immediately via <script> tags
 * 2. Render an initial display from cache+custom
 * 3. Query HAL API to fetch/update live data (async, re-renders on completion)
 */
function main() {

    initialize_global();
    merge_data(global_hal_listing['data'], typeof cache !== 'undefined' ? cache : [], true, true);
    merge_data(global_hal_listing['data'], typeof custom !== 'undefined' ? custom : {}, true, false);
    update_data_and_display();

    for(const query of publication_config.query) {
        query_hal(query);
    }
}

main();
