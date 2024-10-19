"use strict;"


const global_hal_listing = {
    data : null,        // the data as a Dict of hal-id
    data_sorted : null, // the data sorted by years and timestamps
    data_sorted_type : null, // the data sorted by years and timestamps / Journal type
    has_cache : false,    // is the data loaded from cache
    sorting_type : 'default', // Sorting the publication: 'default' (per year), 'type' (journal/conf/etc)
    html_root_element: null,
    html_root_menu_element: null,
};

// Extensions considered as image
const image_extension = ['jpg', 'jpeg', 'jfif', 'webp', 'svg', 'png', 'gif'];
// Extensions considered as video
const video_extension = ['mp4', 'webm'];



function initialize_global() {
    global_hal_listing.html_root_element = document.querySelector(publication_config.html_tag_publication);
    global_hal_listing.html_root_menu_element = document.querySelector(publication_config.html_tag_publication_menu);
    global_hal_listing.data = new Object();
    global_hal_listing.data_sorted = new Object();
}

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

function safe_read(label_in, data_in, label_out, data_out) {
    const value = data_in[label_in];
    if(value!=undefined) {
        data_out[label_out] = value;
    }
}



function html_tag_image(source, alt="illustration", css_class="", css_id="") {
    let html = '<img loading="lazy" ';
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

    let html = '<video class="video_thumbnail" preload="metadata" ';
    html += extra;
    html += ' poster="'+publication_config.default_thumbnail_path+'"';
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
            return html_tag_video(thumbnail_url,'');
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

    return html_tag_image(publication_config.default_thumbnail_path, 'thumbnail');
    
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
    html_txt += `<div class="hal-id">${id}</div>`;
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
                
                // Do not display preprint
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

    if(publication_config.html_menu === true){
        display_menu();
    }
    display_data();

    for(const vid of document.querySelectorAll('.video_thumbnail')) {
        vid.addEventListener('canplay', video_loaded_action );
    }

}

function video_loaded_action(event) {
    event.currentTarget.muted = true;
    event.currentTarget.loop = true;
    event.currentTarget.autoplay = true;
    event.currentTarget.play();
}

function generate_timestamp(data_hal) {
    const y = String(data_hal.publicationDateY_i);
    const sy = String(data_hal.submittedDateY_i);
    const sm = String(data_hal.submittedDateM_i).padStart(2,'0');
    const sd = String(data_hal.submittedDateD_i).padStart(2,'0');
    
    return `${y}-${sy}-${sm}-${sd}`;
}

function safe_set_value(label_in, data_in, label_out, data_out, priority_update) {
    const value_in = data_in[label_in]
    const value_out = data_out[label_out]
    if(value_in!=undefined) {
        if(value_out==undefined || priority_update===true) {
            data_out[label_out] = value_in;
        }
    }
}
function safe_set_value_string(string_in, label_out, data_out, priority_update) {
    const value_out = data_out[label_out]
    if(string_in!=undefined) {
        if(value_out==undefined || priority_update===true) {
        data_out[label_out] = string_in;
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

function find_thumbnail(entry) {

    const contain_thumbnail = (x) => x.startsWith('thumbnail') || x.endsWith('thumbnail');

    // Look in cache
    if(entry.cache_thumbnail!=undefined) {
        return entry.cache_thumbnail;
    }

    // Look in annexes
    const annexes = entry.fileAnnexes_s;
    if(annexes!=undefined) {

        // first look for thumbnail_xx or xx_thumbnail image or video
        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // 1st priority: video thumbnail
            if( is_any_equal(video_extension, ext) && contain_thumbnail(name) ) {
                return url;
            }
        }

        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // 2nd priority: image thumbnail
            if( is_any_equal(image_extension, ext) && contain_thumbnail(name) ) {
                return url;
            }
        }

        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // 3rd choice: first image
            if( is_any_equal(image_extension, ext) ) {
                return url;
            }

        }
    }
}

function find_video(entry) {
    const contain_thumbnail = (x) => x.startsWith('thumbnail') || x.endsWith('thumbnail');

    const annexes = entry.fileAnnexes_s;
    if(annexes!=undefined) {

        for(const url of annexes){
            const filename = url.split('/').pop();
            const token = filename.split('.');
            const name = token[0];
            const ext = token[1];

            // return first video without thumbnail keyword
            if( is_any_equal(video_extension, ext) && !contain_thumbnail(name) ) {
                return url;
            }

        }
    }

}

function update_value(data, priority_update) {    
    for(const [id,entry] of Object.entries(data) ) {

        safe_set_value('halId_s',entry, 'id', entry, priority_update);
        safe_set_value('publicationDateY_i',entry, 'year', entry, priority_update);
        safe_set_value_string(entry['title_s'][0], 'title', entry, priority_update);
        safe_set_value('authFullName_s',entry, 'authors', entry, priority_update);
        safe_set_value('docType_s',entry, 'type', entry, priority_update);
        safe_set_value_string(generate_timestamp(entry), 'timestamp', entry, priority_update);
        safe_set_value('thumbId_i',entry, 'url_thumbnail_hal', entry, priority_update);


        safe_set_value('journalTitle_s',entry, 'journal_auto', entry, priority_update)
        safe_set_value('conferenceTitle_s',entry, 'journal_auto', entry, priority_update)
        safe_set_value('issue_s',entry, 'issue', entry, priority_update)
        safe_set_value('volume_s',entry, 'volume', entry, priority_update)
        safe_set_value('files_s',entry, 'article', entry, priority_update)
        safe_set_value('doiId_s',entry, 'doi', entry, priority_update)
        if(entry['thumbnail']===undefined) {
            safe_set_value_string(find_thumbnail(entry), 'thumbnail', entry, priority_update)
        }
        if(entry['video']===undefined) {
            safe_set_value_string(find_video(entry), 'video', entry, priority_update)
        }

        if(data[id]['journal_auto'] === undefined) {
            generate_type_from_other_report(entry, entry);
        }
        

    }
}

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


function main() {

    initialize_global();
    merge_data(global_hal_listing['data'], cache, true, true);
    merge_data(global_hal_listing['data'], custom, true, false);
    update_data_and_display();

    

    for(const query of publication_config.query) {
        query_hal(query);
    }

}


main();

