define([
    'text!/static/feti/js/scripts/templates/searchbar.html',
    'common',
    '/static/feti/js/scripts/collections/occupation.js',
    '/static/feti/js/scripts/collections/campus.js',
    '/static/feti/js/scripts/collections/course.js',
    '/static/feti/js/scripts/collections/favorites.js'
], function (searchbarTemplate, Common, occupationCollection, campusCollection, courseCollection, favoritesCollection) {
    var SearchBarView = Backbone.View.extend({
        tagName: 'div',
        container: '#map-search',
        template: _.template(searchbarTemplate),
        events: {
            'click #where-to-study': '_categoryClicked',
            'click #what-to-study': '_categoryClicked',
            'click #choose-occupation': '_categoryClicked',
            'click #favorites': '_categoryClicked',
            'click #result-toogle': 'toogleResult',
            'click #search-clear': 'clearSearch',
            'click #show-filter-button': 'showFilterPanel',
            'click #hide-filter-button': 'hideFilterPanel',
            'change #field-of-study-select': 'filterChanged',
            'change #qualification-type-select': 'filterChanged',
            'change #subfield-of-study-select': 'filterChanged',
            'change #nqf-level-select': 'filterChanged',
            'click #search-icon': 'searchIconClicked',
            'click #search-with-filter': 'searchIconClicked'
        },
        initialize: function (options) {
            this.render();
            this.$result_toggle = $('#result-toogle');
            this.$search_bar = $(".search-bar");
            this.$search_bar_input = $("#search-bar-input");
            this.$search_form = $("#search-form");
            this.$provider_button = $("#where-to-study");
            this.$course_button = $("#what-to-study");
            this.$occupation_button = $("#choose-occupation");
            this.$favorites_button = $("#favorites");
            this.$clear_draw = $("#clear-draw");
            this.$search_clear = $("#search-clear");

            this.$search_clear.hide();

            this.search_bar_hidden = true;
            this.$result_toggle.hide();
            this.parent = options.parent;
            this.initAutocomplete();
            Common.Dispatcher.on('toogle:result', this.toogleResult, this);
            Common.Dispatcher.on('search:finish', this.onFinishedSearch, this);
            Common.Dispatcher.on('occupation:clicked', this.occupationClicked, this);
            Common.Dispatcher.on('favorites:added', this._favoriteAdded, this);
            Common.Dispatcher.on('favorites:deleted', this._favoriteDeleted, this);
            Common.Dispatcher.on('search:updateRouter', this.updateSearchRoute, this);

            this._drawer = {
                polygon: this._initializeDrawPolygon,
                circle: this._initializeDrawCircle
            };
            this._addResponsiveTab($('.nav.nav-tabs'));
            this._search_query = {};
            this._search_filter = {};
            this._search_results = {};
            this._search_need_update = {
                'provider': false,
                'course': false,
                'favorite': false
            };

            var that = this;

            // Flag to show search is initiated through search form
            this.isSearchFromInput = false;

            this.$search_form.submit(function (e) {
                e.preventDefault(); // avoid to execute the actual submit of the form.
                that.isSearchFromInput = true;
                that.updateSearchRoute();
            });
            this.$search_bar_input.keyup(function(e){
                if(e.keyCode == 13)
                {
                    if(that.$search_bar_input.val()) {
                        that.isSearchFromInput = true;
                        that.updateSearchRoute();
                    }
                }
            });

            this.loadFilters();
        },
        searchIconClicked: function (e) {
            this.isSearchFromInput = true;
            this.updateSearchRoute();
        },
        render: function () {
            this.$el.empty();
            var attributes = {
                'is_logged_in': Common.IsLoggedIn
            };
            this.$el.html(this.template(attributes));
            $(this.container).append(this.$el);
        },
        initAutocomplete: function () {
            var that = this;
            this.$search_bar_input.autocomplete({
                source: function (request, response) {
                    that.$search_bar_input.css("cursor", "wait");
                    var url = "/api/autocomplete/" + Common.CurrentSearchMode;
                    $.ajax({
                        url: url,
                        data: {
                            q: request.term
                        },
                        success: function (data) {
                            that.$search_bar_input.css("cursor", "");
                            response(data);
                        },
                        error: function (request, error) {
                            that.$search_bar_input.css("cursor", "");
                        }
                    });
                },
                minLength: 3,
                select: function (event, ui) {
                    $(this).val(ui.item.value);
                    $("#search-form").submit()
                },
                open: function () {
                    //$(this).removeClass("ui-corner-all").addClass("ui-corner-top");
                },
                close: function () {
                    //$(this).removeClass("ui-corner-top").addClass("ui-corner-all");
                }
            });
            var width = this.$search_bar_input.css('width');
            $('.ui-autocomplete').css('width', width);
        },
        getSearchRoute: function (filter) {
            var that = this;
            var new_url = ['map'];
            var mode = this.$el.find('.search-category').find('.search-option.active').data('mode');
            Common.CurrentSearchMode = mode;
            var query = '';

            if(this.isSearchFromInput) {
                query = that.$search_bar_input.val();
                if(mode != 'occupation' && mode != 'favorites')
                    query += that.getAdvancedFilters();
                this.isSearchFromInput = false;
            } else {
                query = that._search_query[mode];
            }

            if (!query && mode in this._search_query) {
                query = this._search_query[mode];
            }
            if (query == "" && mode != 'favorites') {
                this.parent.closeResultContainer($('#result-toogle'));
            }
            new_url.push(mode);
            new_url.push(query);

            if (filter) {
                new_url.push(filter);
            } else {
                // Get coordinates query from map
                var coordinates = this.parent.getCoordinatesQuery();
                if (coordinates) {
                    new_url.push(coordinates);
                }
            }

            if (mode == 'favorites') {
                // Remove empty strings from array if there is filter
                new_url.clean("");
            }

            return new_url;
        },
        updateSearchRoute: function (filter) {
            // update route based on query and filter
            var new_url = this.getSearchRoute(filter);
            Backbone.history.navigate(new_url.join("/"), true);
        },
        _categoryClicked: function (event) {
            event.preventDefault();
            if (!$(event.target).parent().hasClass('active')) {

                var mode = $(event.target).parent().data("mode");

                // Change active button
                this.changeCategoryButton(mode);

                // Trigger category click event
                Common.Dispatcher.trigger('sidebar:categoryClicked', mode, Common.CurrentSearchMode);

                // Update current search mode
                Common.CurrentSearchMode = mode;

                this.$search_bar_input.val('');

                // Update url
                this.updateSearchRoute();

                if (mode != 'favorites') {
                    // Hide search bar if in favorite mode
                    $('.search-row').show();
                }

                if (mode != 'occupation') {
                    if ($('#result-detail').is(":visible")) {
                        $('#result-detail').hide("slide", {direction: "right"}, 500);
                    }
                }

                if (mode == 'occupation' || mode == 'favorites') {
                    $('.filter-button').hide();
                } else {
                    $('.filter-button').show();
                }
            }
        },
        _favoriteAdded: function (mode) {
            for (var key in this._search_need_update) {
                if (this._search_need_update.hasOwnProperty(key)) {
                    if (key != mode) {
                        this._search_need_update[key] = true;
                    }
                }
            }
        },
        _favoriteDeleted: function (mode) {
            for (var key in this._search_need_update) {
                if (this._search_need_update.hasOwnProperty(key)) {
                    if (key != mode) {
                        this._search_need_update[key] = true;
                    }
                }
            }
            if (mode == 'favorites') {
                this._getFavorites();
            }
        },
        _openFavorites: function (filter) {
            $('.search-row').hide();
            this.showResult();
            var mode = 'favorites';
            if (!(mode in this._search_query) ||
                this._search_need_update[mode] ||
                this._search_filter[mode] != filter
            ) {
                Common.CurrentSearchMode = mode;
                this._getFavorites(filter);
            }
        },
        _getFavorites: function (filter) {
            var mode = Common.CurrentSearchMode;
            favoritesCollection.search(filter);
            this._search_query[mode] = '';
            this._search_filter[mode] = filter ? filter : '';
            Common.Dispatcher.trigger('sidebar:show_loading', mode);
            this._search_need_update[mode] = false;
        },
        occupationClicked: function (id, pathway) {
            Common.Router.inOccupation = true;
            var new_url = this.getSearchRoute();
            new_url.push(id);
            if (pathway) {
                new_url.push(pathway);
            }
            Backbone.history.navigate(new_url.join("/"), false);
        },
        updateSearchBarInput: function (query) {
            // Remove all filters from searchbar
            // filters are fos, qt, nqf, sos, mc
            query = query.replace(query.match(/&fos=\d+/g), '');
            query = query.replace(query.match(/&qt=\d+/g), '');
            query = query.replace(query.match(/&nqf=\d+/g), '');
            query = query.replace(query.match(/&sos=\d+/g), '');
            query = query.replace(query.match(/&mc=\d+/g), '');
            this.$search_bar_input.val(query);
        },
        search: function (mode, query, filter) {
            if (query && mode != 'favorites') {

                // Put query to search input
                this.updateSearchBarInput(query);

                // Update filters
                this.parseFilters(query);

                if(!this.$search_bar_input.val()) {
                    return;
                }

                // search
                if (query == this._search_query[mode] && filter == this._search_filter[mode] && !this._search_need_update[mode]) {
                    // no need to search
                    if (query != "") {
                        this.showResult(mode);
                    }
                } else {
                    switch (mode) {
                        case 'provider':
                            campusCollection.search(query, filter);
                            break;
                        case 'course':
                            courseCollection.search(query, filter);
                            break;
                        case 'occupation':
                            occupationCollection.search(query);
                            break;
                        default:
                            return;
                    }
                    this._search_query[mode] = query;
                    this._search_filter[mode] = filter;
                    this._search_need_update[mode] = false;
                    Common.Dispatcher.trigger('sidebar:show_loading', mode);
                    this.showResult(mode);
                }
            } else if (mode == 'favorites') {
                if (query) {
                    filter = query;
                }
                this._openFavorites(query);
            }
            // redraw filter
            if (!filter) {
                this.clearAllDraw();
            } else {
                var filters = filter.split('&');
                if (filters[0].split('=').pop() == 'polygon') { // if polygon
                    var coordinates_json = JSON.parse(filters[1].split('=').pop());
                    var coordinates = [];
                    _.each(coordinates_json, function (coordinate) {
                        coordinates.push([coordinate.lat, coordinate.lng]);
                    });
                    this.parent.createPolygon(coordinates);
                } else if (filters[0].split('=').pop() == 'circle') { // if circle
                    var coords = JSON.parse(filters[1].split('=').pop());
                    var radius = filters[2].split('=').pop();
                    this.parent.createCircle(coords, radius);
                }
            }
            if (mode == 'occupation' || mode == 'favorites') {
                this.hideFilterPanel();
                $('.filter-button').hide();
            } else {
                $('.filter-button').show();
            }
        },
        onFinishedSearch: function (is_not_empty, mode, num) {

            Common.Dispatcher.trigger('sidebar:hide_loading', mode);
            Common.Dispatcher.trigger('map:repositionMap', mode);

            $('#result-title').find('[id*="result-title-"]').hide();
            $('#result-title').find('#result-title-' + Common.CurrentSearchMode).show();
            if (mode) {
                this._search_results[mode] = num;
                this.$search_clear.show();
            }

            this.hideFilterPanel();
            if (num > 0 && mode != 'occupation') {
                // Show share bar
                Common.Dispatcher.trigger('map:showShareBar');
            } else {
                Common.Dispatcher.trigger('map:hideShareBar');
            }

            if (Common.Router.selected_occupation) {
                Common.Dispatcher.trigger('occupation-' + Common.Router.selected_occupation + ':routed');
            }
        },
        showResult: function (mode) {
            if (!Common.EmbedVersion) {
                if (this.map_in_fullscreen) {
                    var $toggle = $('#result-toogle');
                    this.parent.openResultContainer($toggle);
                }
            }
        },
        toogleResult: function (event) {
            if ($(event.target).hasClass('fa-caret-left') || $(event.target).find('.fa-caret-left').length > 0) {
                this.parent.openResultContainer($(event.target));
            } else {
                this.parent.closeResultContainer($(event.target));
            }
        },
        _initializeDrawPolygon: function () {
            $('#draw-polygon').hide();
            $('#cancel-draw-polygon').show();
            // enable polygon drawer
            this.parent.enablePolygonDrawer();
        },
        _initializeDrawCircle: function () {
            $('#draw-circle').hide();
            $('#cancel-draw-circle').show();
            // enable circle drawer
            this.parent.enableCircleDrawer();
        },
        clearAllDraw: function () {
            this.parent.clearAllDrawnLayer();
            this.updateSearchRoute();
        },
        changeCategoryButton: function (mode) {
            // Shows relevant search result container
            this.parent.showResultContainer(mode);

            this.$el.find('.search-category').find('.search-option').removeClass('active');
            var $button = null;
            var highlight = "";
            if (mode == "provider") {
                $button = this.$provider_button;
                highlight = 'Search for provider';
            } else if (mode == "course") {
                $button = this.$course_button;
                highlight = 'Search for courses';
            } else if (mode == "occupation") {
                $button = this.$occupation_button;
                highlight = 'Search for occuption';
            } else if (mode == "favorites") {
                $button = this.$favorites_button;
                highlight = '';
            }

            // change placeholder of input
            this.$search_bar_input.attr("placeholder", highlight);
            this.showSearchBar(0);
            if ($button) {
                $button.addClass('active');
            }
        },
        mapResize: function (is_resizing) {
            this.map_in_fullscreen = is_resizing;
            if (is_resizing) { // To fullscreen
                this.$('#back-home').show();
                this.$('#result-toogle').show();
                this.parent.closeResultContainer($('#result-toogle'));
                var mode = Common.CurrentSearchMode;
                if(mode in this._search_results) {
                    if(this._search_results[mode] > 0)
                        this.parent.openResultContainer($('#result-toogle'));
                }
            } else { // Exit fullscreen
                this.$('#back-home').hide();
                this.$('#result-toogle').hide();
            }
        },
        showSearchBar: function (speed) {
            if (this.search_bar_hidden) {
                this.$search_bar.slideToggle(speed);
                // zoom control animation
                var $zoom_control = $('.leaflet-control-zoom');
                $zoom_control.animate({
                    marginTop: '+=55px'
                }, speed);
                var $result = $('#result');
                $result.animate({
                    paddingTop: '+=55px'
                }, speed);

                // now it is shown
                this.search_bar_hidden = false;
            }
        },
        hideSearchBar: function (e) {
            if (!this.search_bar_hidden) {
                this.$search_bar.slideToggle(500, function () {
                });
                // zoom control animation
                var $zoom_control = $('.leaflet-control-zoom');
                $zoom_control.animate({
                    marginTop: '-=55px'
                }, 500);

                // now it is shown
                this.search_bar_hidden = true;
            }
        },
        exitOccupation: function () {
            var that = this;
            var $cover = $('#shadow-map');
            if ($cover.is(":visible")) {
                $cover.fadeOut(500);
                $('#result-detail').hide("slide", {direction: "right"}, 500, function () {
                    that.exitResult();
                });
            } else {
                that.exitResult();
            }
        },
        exitResult: function () {
            if ($('#result').is(":visible")) {
                $('#result-toogle').removeClass('fa-caret-right');
                $('#result-toogle').addClass('fa-caret-left');
                $('#result').hide("slide", {direction: "right"}, 500, function () {
                    Common.Dispatcher.trigger('map:exitFullScreen');
                });
            } else {
                Common.Dispatcher.trigger('map:exitFullScreen');
            }
        },
        _addResponsiveTab: function (div) {
            div.addClass('responsive-tabs');

            div.on('click', 'li.active > a, span.glyphicon', function () {
                div.toggleClass('open');
            }.bind(div));

            div.on('click', 'li:not(.active) > a', function () {
                div.removeClass('open');
            }.bind(div));
        },
        clearSearch: function (e) {
            e.preventDefault();

            // Clear search input
            this.$search_bar_input.val('');

            // Clear saved query
            this._search_query[Common.CurrentSearchMode] = '';

            // Clear saved marker
            this.parent.clearLayerMode(Common.CurrentSearchMode);

            // Hide clear button
            this.$search_clear.hide();

            // Update search
            this.updateSearchRoute();

            // Update sidebar
            Common.Dispatcher.trigger('sidebar:clear_search', Common.CurrentSearchMode);
        },
        /*--------------------*/
        /* Advanced filter    */
        /*--------------------*/
        isFilterPanelOpened : false,
        fosFilter: 0,
        qtFilter: 0,
        filters: {
            'field-of-study-select': null,
            'qualification-type-select': null,
            'nqf-level-select': null,
            'subfield-of-study-select': null
        },
        minimumCreditsSlider: null,
        showFilterPanel: function (e) {
            $('#show-filter-button').hide();
            $('#hide-filter-button').show();

            // Hide side panel
            var resultToggle = $('#result-toogle');
            this.parent.closeResultContainer(resultToggle);
            resultToggle.removeClass('fa-caret-right');
            resultToggle.addClass('fa-caret-left');

            var $filterPanel = $('.filter-panel');

            if ($filterPanel.css('display') == 'none'){
                $filterPanel.animate({
                    height: "toggle"
                }, 500)
            }
        },
        filterChanged: function (e) {
            var id =  $('#'+e.target.id+ ' option:selected').val();
            if(id != '-') {
                this.filters[e.target.id] = id;
            } else {
                this.filters[e.target.id] = null;
            }
        },
        hideFilterPanel: function (e) {
            $('#hide-filter-button').hide();
            $('#show-filter-button').show();

            // Show side panel
            var resultToggle = $('#result-toogle');
            if(typeof e != 'undefined' && typeof this._search_query[Common.CurrentSearchMode] != 'undefined') {
                this.parent.openResultContainer(resultToggle);
                resultToggle.removeClass('fa-caret-left');
                resultToggle.addClass('fa-caret-right');
            }

            var $filterPanel = $('.filter-panel');

            if ($filterPanel.css('display') != 'none'){
                $filterPanel.animate({
                    height: "toggle"
                }, 500)
            }
        },
        getAdvancedFilters: function () {
            var filter = '';
            if(this.filters['field-of-study-select']) {
                filter += '&fos=' + this.filters['field-of-study-select'];
            }
            if(this.filters['qualification-type-select']) {
                filter += '&qt=' + this.filters['qualification-type-select'];
            }
            if(this.filters['nqf-level-select']) {
                filter += '&nqf=' + this.filters['nqf-level-select'];
            }
            if(this.filters['subfield-of-study-select']) {
                filter += '&sos=' + this.filters['subfield-of-study-select'];
            }
            if(this.minimumCreditsSlider) {
                var mcValue = this.minimumCreditsSlider.bootstrapSlider('getValue');
                if(mcValue > 0) {
                    filter += '&mc=' + mcValue;
                }
            }
            return filter;
        },
        parseFilters: function (query) {
            var fosId = query.match(/&fos=\d+/g);
            var qtId = query.match(/&qt=\d+/g);
            var nqfId = query.match(/&nqf=\d+/g);
            var sosId = query.match(/&sos=\d+/g);
            var mcValue = query.match(/&mc=\d+/g);

            if(fosId) {
                fosId = fosId[0].split('=')[1];
                this.filters['field-of-study-select'] = fosId;
            }
            if(qtId) {
                qtId = qtId[0].split('=')[1];
                this.filters['qualification-type-select'] = qtId;
            }
            if(nqfId) {
                nqfId = nqfId[0].split('=')[1];
                this.filters['nqf-level-select'] = nqfId;
            }
            if(sosId) {
                sosId = sosId[0].split('=')[1];
                this.filters['subfield-of-study-select'] = sosId;
            }
            if(mcValue) {
                mcValue = mcValue[0].split('=')[1];
                this.minimumCreditsSlider.bootstrapSlider('setValue', mcValue);
            }
        },
        loadFilters: function () {
            var that = this;
            this.minimumCreditsSlider = $('#minimum-credits').bootstrapSlider({
	            formatter: function(value) {
		            return value;
	            }
            });
            // Get field of study
            $.ajax({
                url: 'api/field_of_study',
                type: 'GET',
                success: function (response) {
                    $.each(response, function (i, item) {
                        $('#field-of-study-select').append($('<option>', {
                            value: item.id,
                            text : item.field_of_study_description,
                            selected: item.id == that.filters['field-of-study-select']
                        }));
                    });

                    $('#field-of-study-select').chosen({
                        no_results_text: "Oops, nothing found!",
                        width: "80%"
                    });
                }
            });
            $.ajax({
                url: 'api/qualification_type',
                type: 'GET',
                success: function (response) {
                    $.each(response, function (i, item) {
                        $('#qualification-type-select').append($('<option>', {
                            value: item.id,
                            text : item.type,
                            selected: item.id == that.filters['qualification-type-select']
                        }));
                    });
                    $('#qualification-type-select').chosen({
                        no_results_text: "Oops, nothing found!",
                        width: "80%"
                    });
                }
            });
            $.ajax({
                url: 'api/national_qualifications_framework',
                type: 'GET',
                success: function (response) {
                    $.each(response, function (i, item) {
                        $('#nqf-level-select').append($('<option>', {
                            value: item.id,
                            text : item.description,
                            selected: item.id == that.filters['nqf-level-select']
                        }));
                    });
                    $('#nqf-level-select').chosen({
                        no_results_text: "Oops, nothing found!",
                        width: "80%"
                    });
                }
            });
            $.ajax({
                url: 'api/subfield_of_study',
                type: 'GET',
                success: function (response) {
                    $.each(response, function (i, item) {
                        $('#subfield-of-study-select').append($('<option>', {
                            value: item.id,
                            text : item.learning_subfield,
                            selected: item.id == that.filters['subfield-of-study-select']
                        }));
                    });
                    $('#subfield-of-study-select').chosen({
                        no_results_text: "Oops, nothing found!",
                        width: "50%"
                    });
                }
            });
        }
    });

    return SearchBarView;
});