"use strict";


/** Default configuration in case config.yaml is not available. 
 * These values are written over once config.yaml is read. */
const default_config = {
    /** Change the default name to yours */
    query : 'authIdHal_s:damien-rohmer OR authFullName_t:"Guillaume Cordonnier"', 
    filter : 'publicationDateY_i:[2020 TO *]',
    menu: true,
    menu_year_increment: 1,
    default_thumbnail_path: 'assets/thumbnail_default.jpg',
    external_data_path: 'URL_to_set',
    html_root_id : '#listing-publication',
    html_root_menu_id : '#listing-publication-menu',
    yaml_modifier_path : '',
    local_path : '',
    additional_yaml: 'skip',
    try_cache: false,
    cache_dir: 'cache/'
};

const global_hal_listing = {
    config_file_path: 'config.yaml', // Default path to fetch a configuration file
    config : default_config,         // Configuration data loaded from the external file
    html_root_element : null, // Html element corresponding where the publications are added
    data : null,        // the data as a Dict of hal-id
    data_sorted : null, // the data sorted by years and timestamps
    data_sorted_type : null, // the data sorted by years and timestamps / Journal type
    has_cache : false,    // is the data loaded from cache
    sorting_type : 'default', // Sorting the publication: 'default' (per year), 'type' (journal/conf/etc)
};


// Extensions considered as image
const image_extension = ['jpg', 'jpeg', 'jfif', 'webp', 'svg', 'png', 'gif'];
// Extensions considered as video
const video_extension = ['mp4', 'webm'];



const is_any_equal = function(array, value) { return array.some( (x) => x===value); }
const is_image = function(filepath) {
    const filename = filepath.split('/').pop();
    const token = filename.split('.');
    const ext = token[1];

    return is_any_equal(image_extension, ext);
}
const is_video = function(filepath) {
    const filename = filepath.split('/').pop();
    const token = filename.split('.');
    const ext = token[1];

    return is_any_equal(video_extension, ext);
}

function convertJSON(response){
    return response.json();
}
function convertText(response){
    return response.text();
}
function error_fetch_from_hal(error) {
    global_hal_listing.html_root_element.innerHtml = 'Failed to fetch data from HAL';
    console.log('Failed to fetch data from HAL');
    console.log(error);
}

function error_fetch_from_yaml(error) {
    global_hal_listing.html_root_element.innerHtml = 'Failed to fetch data from YAML';
    console.log('Failed to fetch data from YAML');
    console.log(error);
}
function error_fetch_from_cache(error) {
    global_hal_listing.html_root_element.innerHtml = 'Failed to fetch data from Cache';
    console.log('Failed to fetch data from Cache');
    console.log(error);
}

function error_fetch_config_from_yaml(error) {
    console.log('Failed to fetch configuration file');
    console.log(error);
}

function existsFile(url) {
    var http = new XMLHttpRequest();
    http.open('HEAD', url, false);
    http.send();
    return http.status!=404;
 }

async function query_hal(query) {
    await fetch(query)
    .then(convertJSON)
    .then(load_data_from_hal)
    .catch(error_fetch_from_hal);
}

async function fetch_yaml(yaml_url) {
    await fetch(yaml_url)
    .then(convertText)
    .then(load_data_from_yaml)
    .catch(error_fetch_from_yaml);
}

async function fetch_cache(url_cache) {

    if(existsFile(url_cache)) {
        await fetch(url_cache)
        .then(convertJSON)
        .then(load_data_from_cache)
        .catch(error_fetch_from_cache);
    }
    else {
        global_hal_listing['has_cache'] = false;
    }
}

async function fetch_config(config_url) {
    await fetch(config_url)
    .then(convertText)
    .then(load_config_from_yaml)
    .catch(error_fetch_config_from_yaml);
}

function load_config_from_yaml(data_config_txt) {
    const data_config = jsyaml.load(data_config_txt);
    global_hal_listing.config = data_config;
}

function safe_read(label_in, data_in, label_out, data_out) {
    const value = data_in[label_in];
    if(value!=undefined) {
        data_out[label_out] = value;
    }
}

function load_thumbnail_from_hal(data, data_hal) {


    const contain_thumbnail = (x) => x.startsWith('thumbnail') || x.endsWith('thumbnail');

    const annexes = data_hal.fileAnnexes_s;
    if(annexes!=undefined) {

        // first look for thumbnail_xx or xx_thumbnail image or video
        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // 1st priority: video thumbnail
            if( is_any_equal(video_extension, ext) && contain_thumbnail(name) ) {
                data['thumbnail'] = url;
                return ;
            }
        }

        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // 2nd priority: image thumbnail
            if( is_any_equal(image_extension, ext) && contain_thumbnail(name) ) {
                data['thumbnail'] = url;
                return ;
            }
        }

        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // 3rd choice: first image
            if( is_any_equal(image_extension, ext) ) {
                data['thumbnail'] = url;
                return ;
            }

        }
    }
}

function load_timestamp_from_hal(data, data_hal) {
    const y = String(data_hal.publicationDateY_i);
    const sy = String(data_hal.submittedDateY_i);
    const sm = String(data_hal.submittedDateM_i).padStart(2,'0');
    const sd = String(data_hal.submittedDateD_i).padStart(2,'0');
    
    data['timestamp'] = `${y}-${sy}-${sm}-${sd}`;
}

function load_video_from_hal(data, data_hal) {

    const contain_thumbnail = (x) => x.startsWith('thumbnail') || x.endsWith('thumbnail');

    const annexes = data_hal.fileAnnexes_s;
    if(annexes!=undefined) {

        // first look for thumbnail_xx or xx_thumbnail image or video
        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // return first video without thumbnail keyword
            if( is_any_equal(video_extension, ext) && !contain_thumbnail(name) ) {
                data['video'] = url;
                return ;
            }

        }
    }
}

function generate_type_from_other_report(data, data_hal) {
    if(data_hal['docType_s']=="REPORT") {
        data['journal_auto'] = 'Technical Report';
        return ;
    }
    if(data_hal['docType_s']=="HDR") {
        data['journal_auto'] = 'HDR';
        return ;
    }
    if(data_hal['docType_s']=="PROCEEDINGS") {
        data['journal_auto'] = 'Proceedings';
        return ;
    }
    if(data_hal['docType_s']=="PATENT") {
        data['journal_auto'] = 'Patent';
        return ;
    }
    if(data_hal['docType_s']=="THESE") {
        data['journal_auto'] = 'PhD';
        return ;
    }
    if(data_hal['docType_s']=="MEM") {
        data['journal_auto'] = 'Master';
        return ;
    }
    if(data_hal['docType_s']=="COUV") {
        data['journal_auto'] = 'Book Chapter in '+data_hal['bookTitle_s'];
        return ;
    }
    if(data_hal['docType_s']=="OUV") {
        data['journal_auto'] = 'Book';
        return ;
    }
    if(data_hal['docType_s']=="OTHER") {
        data['journal_auto'] = '';
        return ;
    }
    if(data_hal['docType_s']=="UNDEFINED") {
        data['journal_auto'] = 'Preprint';
        return ;
    }
}

function load_data_from_hal(data_hal_json) {
    const data_hal = data_hal_json.response.docs;
    const data = global_hal_listing['data'];

    for(const element of data_hal) {
        const id = element['halId_s'];

        // Check if id does not exists yet (can be already filled by cache)
        if(data[id]===undefined) {
            data[id]= new Object();
            data[id].id = id;
            data[id].title = element['title_s'][0];
            data[id].authors = element['authFullName_s'];
            data[id].type = element['docType_s'];
            data[id].year = element['publicationDateY_i'];
            data[id].url_thumbnail_hal = element['thumbId_i'];

            safe_read('journalTitle_s',element, 'journal_auto', data[id]);
            safe_read('conferenceTitle_s',element, 'journal_auto', data[id]);
            safe_read('issue_s',element, 'issue', data[id]);
            safe_read('volume_s',element, 'volume', data[id]);
            safe_read('files_s',element, 'article', data[id]);
            safe_read('doiId_s', element, 'doi', data[id]);
            load_thumbnail_from_hal(data[id], element);
            load_video_from_hal(data[id], element);
            load_timestamp_from_hal(data[id], element);

            if(data[id].article == undefined) {
                safe_read('linkExtUrl_s',element, 'article', data[id]);
            }
            if(data[id]['journal_auto'] === undefined) {
                generate_type_from_other_report(data[id], element);
            }

            if(data[id]['journal_auto'] === undefined) {
                console.log("Warning, could not find journal for the following entry");
                console.log(element);
            }
        }
    }
}

function load_data_from_cache(data_hal_json) {

    const data = global_hal_listing['data'];

    for(const element of data_hal_json) {
        const id = element['halId_s'];
        data[id]= new Object();
        data[id].id = id;
        data[id].title = element['title_s'][0];
        data[id].authors = element['authFullName_s'];
        data[id].type = element['docType_s'];
        data[id].year = element['publicationDateY_i'];
        data[id].url_thumbnail_hal = element['thumbId_i'];

        safe_read('journalTitle_s',element, 'journal_auto', data[id]);
        safe_read('conferenceTitle_s',element, 'journal_auto', data[id]);
        safe_read('issue_s',element, 'issue', data[id]);
        safe_read('volume_s',element, 'volume', data[id]);
        safe_read('files_s',element, 'article', data[id]);
        safe_read('doiId_s', element, 'doi', data[id]);
        safe_read('cache_thumbnail', element, 'thumbnail', data[id]);
        //load_thumbnail_from_hal(data[id], element);
        load_video_from_hal(data[id], element);
        load_timestamp_from_hal(data[id], element);

        if(data[id].article == undefined) {
            safe_read('linkExtUrl_s',element, 'article', data[id]);
        }
        if(data[id]['journal_auto'] === undefined) {
            generate_type_from_other_report(data[id], element);
        }

        if(data[id]['journal_auto'] === undefined) {
            console.log("Warning, could not find journal for the following entry");
            console.log(element);
        }
    }

    global_hal_listing['has_cache'] = true;
}


function initialize_global() {
    global_hal_listing.html_root_element = document.querySelector(global_hal_listing.config.html_root_id);
    global_hal_listing.data = new Object();
    global_hal_listing.data_sorted = new Object();
}

function html_tag_image(source, alt="illustration", css_class="", css_id="") {
    let html = '<img ';
    if(css_id!=='') {
        html += `id="${css_id}" `;
    }
    if(css_class!=='') {
        html += `class="${css_class}" `;
    }
    html += `src="${source}" `;
    html += `alt="${alt}" `;
    html += '/>';
    return html;
}
function html_tag_video(source, extra="muted autoplay loop") {

    let mime='';
    if(source.endsWith('.mp4')) {
        mime = 'type="video/mp4"';
    }
    else if(source.endsWith('.webm')) {
        mime = 'type="video/webm"';
    }

    let html = '<video ';
    html += extra;
    html += '>'

    // Source
    html += `<source src="${source}" ${mime}>`


    html += '</video>';
    return html;

}

function export_html_thumbnail(entry) {

    let thumbnail_url = entry['thumbnail'];

    if(thumbnail_url !== undefined) {

        if(is_video(thumbnail_url)) {
            return html_tag_video(thumbnail_url);
        }
        else if(is_image(thumbnail_url)) {
            return html_tag_image(thumbnail_url, 'thumbnail');
        }

    }
    // otherwise, default hal thumbnail image
    if(entry.url_thumbnail_hal!=undefined) {
        const hal_thumbnail = 'https://thumb.ccsd.cnrs.fr/'+entry.url_thumbnail_hal+'/thumb/medium';
        return html_tag_image(hal_thumbnail, 'thumbnail');
    }

    return html_tag_image(global_hal_listing.config.default_thumbnail_path, 'thumbnail');
    
}

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


    let html_journal_name = '';
    const conf_short = entry.conference_short;
    const conf = entry.conference;
    const journal_short = entry.journal_short;
    const journal = entry.journal;

    // Nothing is provided - use the default HAL journal
    if( conf_short==undefined && conf==undefined && journal_short==undefined && journal==undefined ) {
        html_journal_name = `<strong>${entry.journal_auto}</strong>`;
    }
    
    else {
        // Conf name first
        if(conf_short!=undefined || conf!=undefined) {
            if(conf_short!=undefined && conf!=undefined) {
                html_journal_name = `<strong>${conf_short}</strong> (${conf})`;
            }
            else if(conf_short!=undefined) {
                html_journal_name = `<strong>${conf_short}</strong>`;
            }
            else if(conf!=undefined) {
                html_journal_name = `<strong>${conf}</strong>`;
            }
        }

        // Then journal
        if(journal_short!=undefined || journal!=undefined) {
            // add separator if needed
            if(html_journal_name!=='') {
                html_journal_name += '<br>';
            }

            if(journal_short!=undefined && journal!=undefined) {
                html_journal_name += `<strong>${journal_short}</strong> (${journal})`;
            }
            else if(journal_short!=undefined) {
                html_journal_name += `<strong>${journal_short}</strong>`;
            }
            else if(journal!=undefined) {
                html_journal_name += `<strong>${journal}</strong>`;
            }

        }

    } 
    
    if(conf_short!=undefined && conf!=undefined && journal_short!=undefined && journal!=undefined) {
        html_journal_name = `<strong>${conf_short}</strong> (${conf})<br><strong>${journal_short}</strong> (${journal})`;
    }
    // Conf only with short and long name
    else if(conf_short!=undefined && conf!=undefined && journal_short==undefined && journal==undefined) {
        html_journal_name = `<strong>${conf_short}</strong> (${conf})`;
    }
    // Journal only with short and long name
    else if(conf_short==undefined && conf==undefined && journal_short!=undefined && journal!=undefined) {
        html_journal_name = `<strong>${journal_short}</strong> (${journal})`;
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
    if(Array.isArray(entry.authors)==true) {
        return entry.authors.join(', ');
    }
    else {
        return entry.authors;
    }
}

function change_css(event) {
    const lookup_css_file = {'css-standard':'style.css', 'css-min':'style-condensated.css'};
    const css_hal = document.querySelector("#css-hal");
    css_hal.href = lookup_css_file[event.currentTarget.id];
}


function change_sorting(event) {
    const lookup = {'sorting-default':'default', 'sorting-type':'type'};
    global_hal_listing.sorting_type = lookup[event.currentTarget.id];
    display_data(); 
}


function display_menu() {
    

    const all_years = Object.keys(global_hal_listing.data_sorted).sort().reverse();

    let html_txt = '';
    html_txt += `Quick access: `;
    let counter_year = 0;
    for(const year of all_years) {
        if( counter_year%global_hal_listing.config.menu_year_increment === 0 ){
            html_txt += `[<a href="#year-${year}">${year}</a>] `;
        }
        counter_year = counter_year + 1;
    }
    html_txt += '<br>';
    html_txt += 'CSS: <input type="radio" name="css-select" id="css-standard" value="Standard" checked ><label for="css-standard">Standard</label> <input type="radio" id="css-min" name="css-select" value="Min"><label for="css-min">Min</label>';

    

    html_txt += '<br>';
    html_txt += 'Sorting: <input type="radio" name="sort-type" id="sorting-default" value="Default" checked ><label for="sorting-default">Default</label> <input type="radio" id="sorting-type" name="sort-type" value="Type"><label for="sorting-type">Type</label>'


    document.querySelector(global_hal_listing.config.html_root_menu_id).innerHTML = html_txt;
    document.querySelector('#css-standard').addEventListener('click',change_css);
    document.querySelector('#css-min').addEventListener('click',change_css);

    document.querySelector('#sorting-default').addEventListener('click',change_sorting);
    document.querySelector('#sorting-type').addEventListener('click',change_sorting);
}


function display_entry(entry) {
    let id = entry.id;
    let thumbnail_html = export_html_thumbnail(entry);
    let journal_html = export_html_journal(entry);
    let authors = export_html_authors(entry);

    let html_txt = '';
    html_txt += `<div class="publication-entry" id="${id}">`;

    html_txt += `  <div class="thumbnail">`;
    html_txt += thumbnail_html;
    html_txt += `  </div>`; // thumbnail

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
    html_txt += `     <div class="links">`;
    html_txt += `       <a class="hal" href="https://hal.archives-ouvertes.fr/${id}">Hal</a>`;
    if(entry.article != undefined) {
        html_txt += `       <a class="article" href="${entry.article}">Article</a>`;
    }
    if(entry.video != undefined) {
        html_txt += `       <a class="video" href="${entry.video}">Video</a>`;
    }
    if(entry.video_presentation != undefined) {
        html_txt += `       <a class="presentation" href="${entry.video_presentation}">Presentation</a>`;
    }
    if(entry.code != undefined) {
        html_txt += `       <a class="code" href="${entry.code}">Code</a>`;
    }
    if(entry.project_page != undefined) {
        html_txt += `       <a class="project" href="${entry.project_page}">Project</a>`;
    }
    html_txt += `     </div>`;

    html_txt += `  </div>`; //description

    html_txt += `</div>`; // publication-entry

    return html_txt;
}

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
    parent.innerHTML += html_txt;
    
}

function sort_data() {

    // sort by year
    global_hal_listing.data_sorted = [];
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

    // sort by year and publication type
    global_hal_listing.data_sorted_type = [];
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

function convert_arguments_to_query(args) {

    let query_txt = `https://api.archives-ouvertes.fr/search/?q=${args.query}&fl=publicationDateY_i,submittedDateY_i,submittedDateM_i,submittedDateD_i,title_s,authFullName_s,doiId_s,journalTitle_s,conferenceTitle_s,files_s,docType_s,fileAnnexes_s,halId_s,thumbId_i,issue_s,volume_s,linkExtUrl_s,bookTitle_s&rows=500&fq=${args.filter}`;

    return query_txt;
}

function load_data_from_yaml(data_txt) {
    data_txt = data_txt.replaceAll('{{pathToData}}',global_hal_listing.config.external_data_path);
    data_txt = data_txt.replaceAll('{{local}}',global_hal_listing.config.local_path);
    
    const data_yaml = jsyaml.load(data_txt);

    for(const [id,entry] of Object.entries(data_yaml) ) {

        if( global_hal_listing.data[id] != undefined ) {
            // write the manual field on top of the previous one
            for(const [field,value] of Object.entries(data_yaml[id]) ) {
                global_hal_listing.data[id][field] = value;
            }
        }
        else { // Case where the data doesn't exists yet

            if(global_hal_listing.config.additional_yaml === 'skip-warning') {  // option to skip it but display a warning
                console.log("Warning: an element defined in the Yaml file was not in Hal elements",id,data_yaml[id]);
            }
            if(global_hal_listing.config.additional_yaml === 'add') { // option to add it as a new entry

                // Check essential component:
                global_hal_listing.data[id] = data_yaml[id];
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


function update_data_and_display() {
    global_hal_listing.html_root_element.innerHTML = "";
    remove_incorrect_data();
    sort_data();
    if(global_hal_listing.config.menu === true){
        display_menu();
    }
    display_data();

}


async function main() {

    // First get the configuration file data
    await fetch_config(global_hal_listing.config_file_path);


    // Generate the Hal Query
    const query = convert_arguments_to_query(global_hal_listing.config);
    initialize_global(query);

    global_hal_listing.html_root_element.innerHTML = '[ Querying Cache server ... ]<br> <div class="spinning-loader"></div>';
    if(global_hal_listing.config.try_cache === true){
        if(global_hal_listing.config.cache_dir!=="" && global_hal_listing.config.cache_dir.endsWith('/')!=true) {
            global_hal_listing.config.cache_dir = global_hal_listing.config.cache_dir+'/'
        }
        await fetch_cache(global_hal_listing.config.cache_dir+'cache.json');
    }

    // Query HAL if there is no cache
    if(global_hal_listing['has_cache'] === false){
        global_hal_listing.html_root_element.innerHTML = '[ Querying HAL server ... ]<br> <div class="spinning-loader"></div>';
        await query_hal(query);
    }

    if(global_hal_listing.config.yaml_modifier_path!='') {
        global_hal_listing.html_root_element.innerHTML = "[ Fetching data from YAML file ... ]";
        await fetch_yaml(global_hal_listing.config.yaml_modifier_path);
    }
    update_data_and_display();


    // now update a new hal query to collect optional new data if we used cache
    if(global_hal_listing['has_cache'] ===true ) {
        global_hal_listing.html_root_element.innerHTML = '[ Update from HAL server ... ]<br>'+global_hal_listing.html_root_element.innerHTML;
        await query_hal(query);

        update_data_and_display();
    }
}


main();