"use strict";

const args = {
    // The query on HAL to be adapted to your case
    //   ex. authFullName_t:"First Last"
    //   ex. authFullName_t:"First1 Last1" OR authFullName_t:"First2 Last2"
    //   ex. authFullName_t:"First Last" OR authIdHal_s:id-hal
    query : 'authIdHal_s:damien-rohmer OR authFullName_t:"Damien Rohmer" OR authFullName_t:"Vicky Kalogeiton" OR authFullName_t:"Marie-Paule Cani"',

    // The filter on the HAL result. Change the begin/end date to your application
    filter : 'publicationDateY_i:[2019 TO *]',

    // The element ID in the html file where the publication should be inserted
    //   ex. Your html should have something like 
    //       <div id="listing_publication"></div>
    html_root_id : '#listing-publication',

    // The optional Yaml file allowing to tune the displayed publication list
    //  If you don't have any modifier, set it to the empty string
    //     yaml_modifier_path : 'someURL', // will try to fetch the given URL, display a warning on the console if it cannot be found.
    //     yaml_modifier_path : '',        // no yaml modifier, don't try to fetch it.
    yaml_modifier_path : 'modifier.yaml',

    // Local path where local files are looked for ({{local}} variable in yaml file)
    local_path : '',

    // The path to a default thumbnail image in case none if found
    default_thumbnail_path: 'assets/thumbnail_default.jpg',

    // The element ID in the html file where the publication should be inserted

    // An optionnal path that can be indicated in yaml file as {{pathToData}} to point to a specific external link
    external_data_path: 'https://www.lix.polytechnique.fr/vista/vista-web-data/',

    // How the script should deal with Yaml elements that are not in the Hal data
    //  additional_yaml == 'skip'    : Skip the additional yaml element silently
    //  additional_yaml == 'skip-warning' : Skip the additional yaml element, but display a warning on the console
    //  additional_yaml == 'add'     : Add the new yaml element in the display (for instance, allows to add publications that are not on Hal)
    additional_yaml: 'skip',
};


const global = {
    html_root_element : null, // Html element corresponding to args.html_root_id
    data : null,       // the data as a Dict of hal-id
    data_sorted : null // the data sorted by years and timestamps
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
    global.html_root_element.innerHtml = 'Failed to fetch data from HAL';
    console.log('Failed to fetch data from HAL');
    console.log(error);
}
function error_fetch_from_yaml(error) {
    global.html_root_element.innerHtml = 'Failed to fetch data from YAML';
    console.log('Failed to fetch data from YAML');
    console.log(error);
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

            // 2nd priority: image thumbnail
            if( is_any_equal(image_extension, ext) && contain_thumbnail(name) ) {
                data['thumbnail'] = url;
                return ;
            }

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
    const data = global['data'];

    for(const element of data_hal) {
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

function initialize_global() {
    global.html_root_element = document.querySelector(args.html_root_id);
    global.data = new Object();
    global.data_sorted = new Object();
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

    // Source
    html += `<source src="${source}" ${mime}>`

    html += '>'

    html += '</video>';
    return html;

}

function export_html_thumbnail(entry) {

    let thumbnail_url = entry['thumbnail'];

    if(thumbnail_url!=undefined) {

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

    return html_tag_image(args.default_thumbnail_path, 'thumbnail');
    
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

function display_data() {
    const parent = global.html_root_element;
    parent.innerHTML = "";

    let html_txt = '';
    const all_years = Object.keys(global.data_sorted).sort().reverse();
    html_txt += `Quick access: `;
    for(const year of all_years) {
        html_txt += `[<a href="#year-${year}">${year}</a>] `;
    }

    for(const year of all_years) {
        html_txt += `<h2 class="publication-year" id="year-${year}">${year}</h2>`;

        const N_entry = global.data_sorted[year].length;
        let counter_entry = 0;
        for(const entry of global.data_sorted[year]) {
            let id = entry.id;
            let thumbnail_html = export_html_thumbnail(entry);
            let journal_html = export_html_journal(entry);
            let authors = export_html_authors(entry);
    
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
    
            counter_entry = counter_entry+1;
            if(counter_entry<N_entry) {
                html_txt += '<div class="publication-entry-separator"></div>';
            }
        }
    }
    parent.innerHTML += html_txt;
    
}

function sort_data() {

    for(const [id,entry] of Object.entries(global.data) ) {
        const year = entry.year;

        if(global.data_sorted[year] == undefined) {
            global.data_sorted[year] = [];
        }
        global.data_sorted[year].push(entry);
    }
 
    const all_years = Object.keys(global.data_sorted).sort();
    for(const year of all_years){
        global.data_sorted[year].sort((a,b)=> b.timestamp.localeCompare(a.timestamp));
    }
}

function convert_arguments_to_query(args) {

    let query_txt = `https://api.archives-ouvertes.fr/search/?q=${args.query}&fl=publicationDateY_i,submittedDateY_i,submittedDateM_i,submittedDateD_i,title_s,authFullName_s,doiId_s,journalTitle_s,conferenceTitle_s,files_s,docType_s,fileAnnexes_s,halId_s,thumbId_i,issue_s,volume_s,linkExtUrl_s,bookTitle_s&rows=500&fq=${args.filter}`;

    return query_txt;
}

function load_data_from_yaml(data_txt) {
    data_txt = data_txt.replaceAll('{{pathToData}}',args.external_data_path);
    data_txt = data_txt.replaceAll('{{local}}',args.local_path);
    
    const data_yaml = jsyaml.load(data_txt);

    for(const [id,entry] of Object.entries(data_yaml) ) {

        if( global.data[id] != undefined ) {
            // write the manual field on top of the previous one
            for(const [field,value] of Object.entries(data_yaml[id]) ) {
                global.data[id][field] = value;
            }
        }
        else { // Case where the data doesn't exists yet

            if(args.additional_yaml === 'skip-warning') {  // option to skip it but display a warning
                console.log("Warning: an element defined in the Yaml file was not in Hal elements",id,data_yaml[id]);
            }
            if(args.additional_yaml === 'add') { // option to add it as a new entry

                // Check essential component:
                global.data[id] = data_yaml[id];
            }
        }
    }
}

function remove_incorrect_data() {
    for(const [id,entry] of Object.entries(global.data) ) {
        if(entry.timestamp == undefined) {
            console.log('Warning: remove entry from data as timestamp is not defined ',entry);
            delete global.data[id];
        }
    }
}

function get_parameters_scroll() {

    // get parameter https://url?id-hal=...

    const queryString = window.location.search;
    const urlParams = new URLSearchParams(queryString);
    const id_hal_query = urlParams.get('id-hal');
    if(id_hal_query!=null) {
        const element_to_scroll = document.querySelector(`#${id_hal_query}`);
        if(element_to_scroll!=null){
            element_to_scroll.scrollIntoView(true);
            window.scrollBy(0,-100); // replace the scroll a bit more up to center the publication
            element_to_scroll.classList.add('highlighted');
        }
        else {
             console.log('Cannot find element with id-hal: '+id_hal_query);
        }
    }
    else{
        console.log('Cannot query id-hal: '+id_hal_query);
    }
}

async function main() {

    const query = convert_arguments_to_query(args);

    initialize_global(query);

    global.html_root_element.innerHTML = 'Querying HAL server ... <div class="spinning-loader"></div>';
    await query_hal(query);
    global.html_root_element.innerHTML = "Data received from HAL.";
    if(args.yaml_modifier_path!='') {
        global.html_root_element.innerHTML += "Fetching data from YAML file ...";
        await fetch_yaml(args.yaml_modifier_path);
    }
    global.html_root_element.innerHTML = "All data are received.";
    remove_incorrect_data();
    sort_data();
    display_data();
    get_parameters_scroll();
}


main();