"use strict;"


const publication_config = {
    query : ["https://api.archives-ouvertes.fr/search/?q=authIdHal_s:damien-rohmer OR authFullName_t:\"Damien Rohmer\"&fl=publicationDateY_i,submittedDateY_i,submittedDateM_i,submittedDateD_i,title_s,authFullName_s,doiId_s,journalTitle_s,conferenceTitle_s,files_s,docType_s,fileAnnexes_s,halId_s,thumbId_i,issue_s,volume_s,linkExtUrl_s,bookTitle_s&rows=500&fq=publicationDateY_i:[2016 TO *]"] ,

    custom : 'example_customization/publication_customize/publication_customize.js',
    cache_dir : 'cache/' ,
    path_to_data : './',
    path_to_local: 'publication_customize/',

    default_thumbnail_path : 'thumbnail_default.jpg',
    html_tag_publication : '#listing-publication',
    html_tag_publication_menu : '#listing-publication-menu',
    html_menu : true,
    menu_year_increment : 3,
}
