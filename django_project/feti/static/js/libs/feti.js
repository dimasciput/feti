/**
 * Created by christian@    kartoza on 03/15.
 */
/*global $, jQuery, L, window, console*/
var map;
var campus_lookup = [];
var campus_features = [];
var campus_layer;
var highlighted_feature;
var fit_bounds_options = {
    maxZoom: 10
};
var markerIcon = L.ExtraMarkers.icon({
    icon: 'fa-graduation-cap',
    markerColor: 'blue',
    iconColor: 'white',
    shape: 'circle',
    prefix: 'fa'
});
var highlightMarkerIcon = L.ExtraMarkers.icon({
    icon: 'fa-graduation-cap',
    markerColor: 'white',
    iconColor: 'blue',
    shape: 'circle',
    prefix: 'fa'
});
var markerPrivateInstitutionIcon = L.ExtraMarkers.icon({
    icon: 'fa-graduation-cap',
    markerColor: 'red',
    iconColor: 'white',
    shape: 'circle',
    prefix: 'fa'
});
var highlightMarkerPrivateInstitutionIcon = L.ExtraMarkers.icon({
    icon: 'fa-graduation-cap',
    markerColor: 'white',
    iconColor: 'red',
    shape: 'circle',
    prefix: 'fa'
});

jQuery.download = function (url, data, method) {
    /* Taken from http://www.filamentgroup.com/lab/jquery-plugin-for-requesting-ajax-like-file-downloads.html*/
    'use strict';
    //url and data options required
    if (url && data) {
        //data can be string of parameters or array/object
        data = typeof data === 'string' ? data : jQuery.param(data);
        //split params into form inputs
        var inputs = '';
        jQuery.each(data.split('&'), function () {
            var pair = this.split('=');
            inputs += '<input type="hidden" name="' + pair[0] + '" value="' + pair[1] + '" />';
        });
        //send request
        jQuery('<form action="' + url + '" method="' + (method || 'post') + '">' + inputs + '</form>')
            .appendTo('body').submit().remove();
    }
};

function toggle_side_panel() {
    'use strict';
    var map_div = $('#map'),
        side_panel = $('#side_panel'),
        show_hide_div = $('#show_hide');
    /* hide */
    if (side_panel.is(":visible")) {
        show_hide_div.removeClass('glyphicon-chevron-right');
        show_hide_div.addClass('glyphicon-chevron-left');
        side_panel.removeClass('col-lg-4');
        side_panel.hide();
        map_div.removeClass('col-lg-8');
        map_div.addClass('col-lg-12');
        map.invalidateSize();
    } else { /* show */
        show_hide_div.addClass('glyphicon-chevron-right');
        show_hide_div.removeClass('glyphicon-chevron-left');
        side_panel.addClass('col-lg-4');
        side_panel.show();
        map_div.removeClass('col-lg-12');
        map_div.addClass('col-lg-8');
        map.invalidateSize();
    }
}

function show_map() {
    'use strict';
    $('#navigationbar').css('height', window.innerHeight * 0.1);
    $('#map').css('height', window.innerHeight * 0.9);
    map = L.map('map').setView([-33.9200, 18.8600], 8);
    L.tileLayer('http://otile{s}.mqcdn.com/tiles/1.0.0/map/{z}/{x}/{y}.jpeg', {
        attribution: 'Tiles by <a href="http://www.mapquest.com/">MapQuest</a> &mdash; Map data &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors, <a href="http://creativecommons.org/licenses/by-sa/2.0/">CC-BY-SA</a>',
        subdomains: '1234'
    }).addTo(map);

    // make popup center on open
    map.on('popupopen', function (e) {
        var px = map.project(e.popup._latlng); // find the pixel location on the map where the popup anchor is
        px.y -= e.popup._container.clientHeight / 2; // find the height of
        // the popup container, divide by 2, subtract from the Y axis of marker location
        map.panTo(map.unproject(px), {animate: true}); // pan to new center
        var icon;
        var marker = e.popup._source;
        if (marker._public_institute) {
            icon = highlightMarkerIcon;
        } else {
            icon = highlightMarkerPrivateInstitutionIcon;
        }
        marker.setIcon(icon);
    });
    map.on('popupclose', function(e) {
        var icon;
        var marker = e.popup._source;
        if (marker._public_institute) {
            icon = markerIcon;
        } else {
            icon = markerPrivateInstitutionIcon;
        }
        marker.setIcon(icon);
    });

    // create geoJson Layer
    campus_layer = L.geoJson(null, {
        pointToLayer: function (feature, latlng) {
            var icon;
            if (feature.properties.public_institute) {
                icon = markerIcon;
            } else {
                icon = markerPrivateInstitutionIcon;
            }
            var marker = L.marker(latlng, {
                icon: icon
            });
            marker._public_institute = feature.properties.public_institute;
            return L.featureGroup([marker]);
        },
        style: style,
        onEachFeature: onEachFeature
    }).addTo(map);

    // Add share control
    map.addControl(new L.Control.Share());
    var legend = L.control({position: 'bottomleft'});
    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'info legend');
            var public_marker = markerIcon.createIcon();
            public_marker.style.transform = "translate(15px, 0px)";
            var private_marker = markerPrivateInstitutionIcon.createIcon();
            private_marker.style.transform = "translate(60px, 0px)";
            div.innerHTML += (
                "<div class='legend leaflet-control info'>" +
                "<div class='legend-title'>Public - Private" +
                "</div>" +
                "<br>" +
                "<br>" +
                public_marker.outerHTML +
                private_marker.outerHTML +
                "</div>");

        return div;
        };
    legend.addTo(map);
}

/*jslint unparam: true*/
function style(feature) {
    'use strict';
    return {
        weight: 2,
        opacity: 1,
        color: 'blue',
        dashArray: '',
        fillOpacity: 0.5,
        fillColor: 'blue'
    };
}
/*jslint unparam: false*/

function highlightFeature(e) {
    'use strict';
    var layer = e.target;
    if (!L.Browser.ie && !L.Browser.opera) {
        layer.bringToFront();
    }
}

function resetHighlight(e) {
    'use strict';
    //var marker = e.target;
    //marker.setIcon(markerIcon);
    var layer = e.target;
}

function zoomToFeature(e) {
    'use strict';
    var layer = e.target;
    map.fitBounds(layer.getBounds(), fit_bounds_options);
}

/*jslint unparam: true*/
function onEachFeature(feature, layer) {
    'use strict';
    layer.bindPopup(feature.properties.popup_content);
    layer.on({
        mouseover: highlightFeature,
        mouseout: resetHighlight,
        dblclick: zoomToFeature
    });
    campus_features[feature.properties.id] = layer;
}
/*jslint unparam: false*/

function set_offset() {
    'use strict';
    var navbar, navbar_height, map, content, map_offset, content_offset;
    navbar = $('.navbar');
    navbar_height = navbar.height();
    map = $('#map');
    content = $('#content');

    if (map.length) {
        map_offset = map.offset();
        map.offset({top: navbar_height, left: map_offset.left});
    }
    if (content.length) {
        content_offset = content.offset();
        content.offset({top: navbar_height, left: content_offset.left});
    }

}


function add_campus(campus_json, campus_id, public_institute) {
    'use strict';
    campus_json.features[0].properties.id = campus_id;
    campus_json.features[0].properties.public_institute = public_institute;
    campus_layer.addData(campus_json);
    campus_lookup[campus_id] = campus_json;
}


function SelectFeature(campus_id) {
    try {
        var feature = campus_lookup[campus_id].features[0];
        var coordinate = feature.geometry.coordinates;
        feature.properties.selected = true;
        var e = {
            target: campus_features[feature.properties.id]
        };
        if (highlighted_feature) {
            resetHighlight(highlighted_feature);
        }
        highlightFeature(e);
        highlighted_feature = e;
        zoomToFeature(e);
        openCampusPopup(campus_id);
    }
    catch (e) {
        console.log(e);
    }
}

function CampusItemToggle(el) {
    var panel = $(el).closest('.panel-primary').find('.panel-collapse');
    panel.toggleClass('collapse');
    var icon = $(el).find("i");
    if (panel.hasClass('collapse')) {
        icon.removeClass('mdi-navigation-expand-less');
        icon.addClass('mdi-navigation-expand-more');
    }
    else {
        icon.removeClass('mdi-navigation-expand-more');
        icon.addClass('mdi-navigation-expand-less');
    }
}

function openCampusPopup(campus_id) {
    var feature = campus_features[campus_id];
    feature.openPopup();
}

/* Search bar logic */
function initSearchTermChanged() {
    var terms = $("#search-terms").val();
    var search_clear = $("#search-clear");
    var search_terms = $("#search-terms");
    if (search_terms.val().length == 0) {
        search_clear.hide();
    }
    search_terms.keyup(function (e) {
        var terms = search_terms.val()
        if (terms.length == 0) {
            search_clear.hide();
        }
        else {
            search_clear.show();
        }
    });
    search_clear.click(function (e) {
        e.preventDefault();
        search_terms.val("");
        search_clear.hide();
    });
}
