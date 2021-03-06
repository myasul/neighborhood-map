'use strict';
let map;
let infowindow;
let autocomplete;
let bounds;
const ZOMATO_KEY = '000e28228e4fb09d7e02710d59331fbe';
const DFLT_LOCATION = { lat: '14.5408671', lng: '121.0503183' };


// Slider Custom Binding
// Code from https://stackoverflow.com/a/18331650
ko.bindingHandlers.slider = {
    init: function(element, valueAccessor, allBindingsAccessor) {
        let options = allBindingsAccessor().sliderOptions || {};
        $(element).slider(options);
        ko.utils.registerEventHandler(element, "slidechange", function(event, ui) {
            let observable = valueAccessor();
            observable(ui.value);
        });
        ko.utils.domNodeDisposal.addDisposeCallback(element, function() {
            $(element).slider("destroy");
        });
        ko.utils.registerEventHandler(element, "slide", function(event, ui) {
            let observable = valueAccessor();
            observable(ui.value);
        });
    },
    update: function(element, valueAccessor, allBindingsAccessor) {
        let value = ko.utils.unwrapObservable(valueAccessor());
        if (isNaN(value)) {
            value = 0;
        }
        $(element).slider("option", allBindingsAccessor().sliderOptions);
        $(element).slider("value", value);
    }
};

// Restaurant Model
let Restaurant = function(data, type) {
    this.id = data.id;
    this.location = new Location(data.location);
    this.name = data.name;
    this.average_cost_for_two = data.average_cost_for_two;
    this.displayed = ko.observable(true);
    this.marker = null;

    if (type == 'json') {
        this.categories = data.cuisines.split(', ');
        this.selected = ko.observable(false);
    } else {
        this.categories = data.categories;
        this.selected = ko.observable(data.selected);
    }
};

// Country Model
let Country = function(data) {
    this.name = data.name;
    this.code = data.code;
    this.currency = data.currency_code;
};

// Location Model
let Location = function(location) {
    this.latitude = location.latitude;
    this.longitude = location.longitude;
    this.city_id = location.city_id;
};

/* INITIALIZE VIEW MODEL */
let ViewModel = function() {
    let self = this;

    this.country_list = ko.observableArray();
    this.restaurant_list = ko.observableArray();
    this.category_list = ko.observableArray();

    this.current_restaurant = ko.observable();
    this.current_country = ko.observable();
    this.current_category = ko.observable();
    this.current_city = ko.observable();

    this.cost_filter = ko.observable(5000);
    this.prev_disabled = ko.observable(false);
    this.next_disabled = ko.observable(false);

    this.toggled = ko.observable(false);

    // Currently, the list of restaurants is saved in retaurants_zomato.json
    // I used Zomato /search API to fetch the list of restaurants within the vicinity of Taguig.
    if (localStorage.length === 0 || get_restaurants() === 0) {
        $.ajax({
            type: 'GET',
            dataType: 'json',
            url: `https://developers.zomato.com/api/v2.1/search?lat=${DFLT_LOCATION.lat}&lon=${DFLT_LOCATION.lng}&radius=2000&category=8%2C9%2C10&sort=real_distance&order=desc`,
            headers: { 'user-key': ZOMATO_KEY },
        }).done(function(json) {
            reset_result_query();
            set_current_location(DFLT_LOCATION.lat, DFLT_LOCATION.lng);
            populate_country_list(self);
            // Passing the current country using JQuery's deferred object
            // to make sure autocomplete is initialized with the correct country
            populate_restaurant_list_from_json(json.restaurants, self).then(function(result) {
                init_map(self);
            }).fail(function(error) {
                console.log(error.responseText);
                alert('An error has been encountered. Please consult with your system administrator.');
            });
            populate_category_list(self);
        }).fail(function(error) {
            console.log(error.responseText);
            alert('An error has been encountered. Please consult with your system administrator.');
        });
    } else {
        populate_country_list(self);
        // Passing the current country using JQuery's deferred object
        // to make sure autocomplete is initialized with the correct country
        populate_restaurant_list_from_localstorage(self).then(function(result) {
            init_map(self);
        }).fail(function(error) {
            console.log(error.responseText);
            alert('An error has been encountered. Please consult with your system administrator.');
        });
        populate_category_list(self);

    }

    // Setting the current restaurant will be triggered when the user clicks
    // on a restaurant on the list
    this.set_current_restaurant = function() {
        if (self.current_restaurant()) {
            self.current_restaurant().selected(false);
        }
        self.current_restaurant(this);
        self.current_restaurant().selected(true);
        let marker = this.marker;

        if (marker) {
            // When the user clicks a restaurant the markers linked to it should bounce.
            toggle_bounce(marker);
            map.panTo(marker.position);
            map.setZoom(17);
            // It also should pop out the info window.
            populate_infowindow(marker, this);
        }
    };

    // Search the place manually when the user presses enter
    this.search_restaurants_on_entered = function() {
        on_place_entered(self.current_city());
    };

    // Set the country restriction depending on the country that
    // the user picked in the country list
    this.country_change = function() {
        if (autocomplete) {
            autocomplete.setComponentRestrictions(get_country());
        }
    };
};

let view_model = new ViewModel();
ko.applyBindings(view_model);

/* INITIALIZE MAP */
function init_map(view_model) {
    map = new google.maps.Map($('#map').get(0), {
        center: { lat: parseFloat(DFLT_LOCATION.lat), lng: parseFloat(DFLT_LOCATION.lng) },
        zoom: 15,
    });
    bounds = new google.maps.LatLngBounds();
    infowindow = new google.maps.InfoWindow();

    // Create the autocomplete object and associate it with the UI input control.
    autocomplete = new google.maps.places.Autocomplete(
        ($('#city_autocomplete').get(0)), {
            types: ['(cities)'],
            componentRestrictions: { country: view_model.current_country() }
        }
    );

    // When the user selects a city suggested by Google's autocomplete feature,
    // Use that to search restaurants and zoom the map in on that city.
    autocomplete.addListener('place_changed', on_place_changed);

    bounds = init_markers(view_model, bounds);

    // Make sure that all markers are visible in the map
    map.fitBounds(bounds);
    map.setZoom(17);
}

/* FILTER Controllers */

// Searches all the restaurants that matches
// the cost and category the user has provided
function search_restaurants() {
    let chosen_category = view_model.current_category();
    let chosen_cost = view_model.cost_filter();
    let current_currency = get_currency();
    let rate, match;

    infowindow.close();

    // If the restaurants chosen are in a different country (other than the Philippines),
    // convert the chosen cost which is in peso to the default currency of the current country.
    // Using Free Currency Converter API to retrieve the currency conversion.
    if (current_currency != 'PHP') {
        $.ajax({
            type: 'GET',
            dataType: 'json',
            async: false,
            url: `https://free.currencyconverterapi.com/api/v5/convert?q=PHP_${current_currency}&compact=ultra`
        }).done(function(result) {
            rate = result[`PHP_${current_currency}`];
        }).fail(function(error) {
            console.log(error.responseText);
            alert('An error has been encountered. Please consult with your system administrator.');
        });

        chosen_cost = chosen_cost * rate;
    }

    $.each(view_model.restaurant_list(), function() {
        let average_cost_for_two = this.average_cost_for_two;
        let categories = this.categories;

        if (chosen_category == 'All') {
            match = 'All';
        } else {
            match = categories.find(function(category) {
                return category == chosen_category;
            });
        }

        if (!match || (match && average_cost_for_two > chosen_cost)) {
            this.displayed(false);
        } else {
            this.displayed(true);
        }
    });

    // Hide all markers first then show only the 
    // markers of the filtered restaurants
    hide_markers();
    show_markers(view_model.restaurant_list());
}

// Provides a way for the user to 'reset' and 
// show all the restaurants and markers.
function show_all_restaurants() {
    infowindow.close();
    view_model.current_category('All');
    view_model.cost_filter(5000);

    // clear lists first before populating them.
    map.fitBounds(bounds);
    $.each(view_model.restaurant_list(), function() {
        this.displayed(true);
        this.marker.setMap(map);
        this.marker.setAnimation(google.maps.Animation.DROP);
    });
}

// This will retrieve the next set of restaurants (max of 20 restaurants)
// and this function would call a function that would create the list
// and set of markers.
function next_restaurants() {
    if (view_model.prev_disabled()) view_model.prev_disabled(false);
    let rq = get_result_query();
    let location = get_current_location();
    let next = parseInt(rq.next);

    if (next == 20) {
        set_result_query(next + 20, 0);
    } else {
        set_result_query(next + 20, next - 20);
    }
    create_restaurant_list_and_markers(location.lat, location.lng, next);
}


// This will retrieve the previous set of restaurants (max of 20 restaurants)
// and this function would call a function that would create the list
// and set of markers.
function previous_restaurants() {
    if (view_model.next_disabled()) view_model.next_disabled(false);
    let rq = get_result_query();
    let location = get_current_location();
    let prev = parseInt(rq.prev);
    let next = parseInt(rq.next);

    if (prev === 0) {
        set_result_query(next - 20, -1);
        view_model.prev_disabled(true);
    } else {
        set_result_query(next - 20, prev - 20);
    }
    create_restaurant_list_and_markers(location.lat, location.lng, prev);
}

/* LOCATION functions */

// Function that is being called when the user selected
// from the list suggested by Google's autocomplete.
// Location selected will be used to create the restaurant list and markers.
function on_place_changed() {
    reset_result_query();
    let place = autocomplete.getPlace();

    if (place.geometry) {
        let location = place.geometry.location;

        create_restaurant_list_and_markers(location.lat(), location.lng(), 0);
        set_current_location(location.lat(), location.lng());
    } else {
        view_model.current_city("");
    }
}

// Function that is being called when the user choose to compete the address
// and click the enter button from the keyboard.
// Location selected will be used to create the restaurant list and markers.
function on_place_entered(city) {
    reset_result_query();
    let geocoder = new google.maps.Geocoder();

    if (!city) {
        alert('Please enter a valid city.');
    } else {
        geocoder.geocode({
                'address': city,
                componentRestrictions: get_country()
            },
            function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    let location = results[0].geometry.location;

                    create_restaurant_list_and_markers(location.lat(), location.lng(), 0);
                    set_current_location(location.lat(), location.lng());
                } else {
                    alert('We could not find the specified location. Please enter a valid city.');
                }
            });
    }
}

function reset_result_query() {
    view_model.prev_disabled(true);
    view_model.next_disabled(false);
    set_result_query(20, -1);
}

/* FUNCTIONS that manipulate the list and markers. */

// To create the restaurant list, pass the coordinates of the city 
// the user chose and use it to request the restaurant list from zomato.
function create_restaurant_list_and_markers(lat, lng, start) {
    $.ajax({
        type: 'GET',
        dataType: 'json',
        url: `https://developers.zomato.com/api/v2.1/search?start=${start}&lat=${lat}&lon=${lng}&radius=2000&category=8%2C9%2C10&sort=real_distance&order=desc`,
        headers: { 'user-key': ZOMATO_KEY },
    }).done(function(result) {
        if (result.results_shown > 0) {
            // clear lists first before populating them.
            hide_markers();
            view_model.restaurant_list.removeAll();
            view_model.category_list.removeAll();
            view_model.cost_filter(5000);
            bounds = new google.maps.LatLngBounds();

            populate_restaurant_list_from_json(result.restaurants, view_model);
            populate_category_list(view_model);

            let empty_restaurants = view_model.restaurant_list().length === 0;
            if (!empty_restaurants) {
                bounds = init_markers(view_model, bounds);
                // Make sure that all markers are visible in the map
                map.fitBounds(bounds);
            }
        } else {
            // Revert the result query.
            let rq = get_result_query();
            set_result_query(start - 20, rq.prev - 20);

            view_model.next_disabled(true);
            alert('No more restaurants found.\n' +
                'Please check out the previous restaurants by clicking the left arrow button or ' +
                'searching other cites.');
        }
    }).fail(function(error) {
        console.log(error.responseJSON);
        alert('An error has been encountered. Please consult with your system administrator.');
    });
}

// Populate category list by fetching all the cuisines in all the restaurants
function populate_category_list(view_model) {
    view_model.category_list.push('All');
    $.each(view_model.restaurant_list(), function() {
        $.each(this.categories, function() {
            let category = String(this);
            // Make sure that all the categories saved do not have duplicates
            let match = ko.utils.arrayFirst(view_model.category_list(), function(item) {
                return category === item;
            });
            if (!match) {
                view_model.category_list.push(category);
            }
        });
    });
}

// Function that will create a restaurant list from the provided list
// parsed from a json file. The list will be saved in Local Storage
// so that we will not use Zomato API to populate the restaurant list
// when the browser is refreshed.  
function populate_restaurant_list_from_json(restaurants, view_model) {
    let restaurant_array = [];
    let count = 0;
    let get_city = false;
    let city_id;

    $.each(restaurants, function() {
        if (!get_city) {
            city_id = this.restaurant.location.city_id;
            get_city = true;
        }
        view_model.restaurant_list.push(new Restaurant(this.restaurant, 'json'));
        restaurant_array.push(view_model.restaurant_list()[count]);
        count++;
    });
    localStorage.setItem('restaurants', ko.toJSON(restaurant_array));
    return populate_current_country(view_model, city_id);
}

// Function that will create a restaurant list from the 
// list saved from the browsers's local storage.
function populate_restaurant_list_from_localstorage(view_model) {
    view_model.restaurant_list.removeAll();
    let restaurants = get_restaurants();
    let get_city = false;
    let city_id;

    $.each(restaurants, function() {
        if (!get_city) {
            city_id = this.location.city_id;
            get_city = true;
        }
        view_model.restaurant_list.push(new Restaurant(this, 'search'));
    });
    return populate_current_country(view_model, city_id);
}

// Populate the country drop down.
function populate_country_list(view_model) {
    $.getJSON('countries.json', function(json) {
        $.each(json, function() {
            view_model.country_list.push(new Country(this));
        });
    }).fail(function(error) {
        console.log(error.responseText);
        alert('An error has been encountered. Please consult with your system administrator.');
    });
}

// Use Zomato API to retrieve and populate current country using the 
// city ID saved in each of the restaurants.
function populate_current_country(view_model, city_id) {
    return $.ajax({
        type: 'GET',
        dataType: 'json',
        url: `https://developers.zomato.com/api/v2.1/cities?city_ids=${city_id}`,
        headers: { 'user-key': ZOMATO_KEY },
    }).done(function(json) {
        let country_name = json.location_suggestions[0].country_name;
        let country = find_country(country_name, 1);
        view_model.current_country(country.code);
    }).fail(function(error) {
        console.log(error.responseText);
        alert('An error has been encountered. Please consult with your system administrator.');
    });
}

function get_country() {
    let country = view_model.current_country();
    let country_list = {};

    if (country) {
        country_list.country = country;
    } else {
        country_list.country = 'PH';
    }

    return country_list;
}

function get_currency() {
    let country = find_country(view_model.current_country(), 0);
    return country.currency;
}

// Finding the country in the country list.
// Function accepts the whole name or the country code.
function find_country(country_to_find, code_or_name) {
    let match;
    if (code_or_name === 0) {
        match = ko.utils.arrayFirst(view_model.country_list(), function(country) {
            return country.code == country_to_find;
        });
    } else {
        match = ko.utils.arrayFirst(view_model.country_list(), function(country) {
            return country.name == country_to_find;
        });
    }

    if (match) {
        return match;
    }
    return null;
}

/*
 GETTERS and SETTERS
 Get and set methods to be able to retrieve and set data in Local Storage. 
 */

function set_current_location(lat, lng) {
    let location = { lat: `${lat}`, lng: `${lng}` };
    localStorage.setItem('location', JSON.stringify(location));
}

function get_current_location() {
    return JSON.parse(localStorage.getItem('location'));
}

function set_result_query(next, prev) {
    let result_query = { next: `${next}`, prev: `${prev}` };
    localStorage.setItem('result_query', JSON.stringify(result_query));
}

function get_result_query() {
    return JSON.parse(localStorage.getItem('result_query'));
}

function get_restaurants() {
    let restaurants = ko.utils.parseJson(localStorage.getItem('restaurants'));
    if (!restaurants) {
        return 0;
    }
    return restaurants;
}


// Populate the infowindow with the necessary restaurant details and
// pop it up in the marker provided.
function populate_infowindow(marker, restaurant) {
    if (infowindow.marker != marker) {
        infowindow.close();
        infowindow.setContent('');
        infowindow.marker = marker;
        let rst_id = restaurant.id;
        let details_url = `https://developers.zomato.com/api/v2.1/restaurant?res_id=${rst_id}`;
        let restaurant_html = '';

        // Request restaurant details from Zomato
        $.ajax({
            type: 'GET',
            dataType: 'json',
            headers: { 'user-key': ZOMATO_KEY },
            url: details_url
        }).done(function(result) {
            restaurant_html = `
            <div class='infowindow-container'>
                <h1>${result.name}</h1>
                <img src='${result.thumb}'>
                <br>
                <p><a href='${result.url}' target="_blank">Check it out in Zomato!</a><br>
                <strong>Address:</strong> ${result.location.address}<br>
                <strong>Average Cost for Two:</strong> ${result.currency}${result.average_cost_for_two}<br>
                <strong>Rating:</strong> ${result.user_rating.aggregate_rating}
                </p>
            </div>
            `;
            // Populate infowindow
            infowindow.setContent(restaurant_html);
            infowindow.open(map, marker);
        }).fail(function(error) {
            console.log(error.responseJSON);
            alert('An error has been encountered. Please consult with your system administrator.');
        });
    } else {
        // If the user clicks on the same marker, reopen it.
        infowindow.close();
        infowindow.open(map, marker);
    }
}

/* MARKER functions */

// Function will put all markers on all the restaurants' location 
// provided in the restaurant list.
function init_markers(view_model, bounds) {
    $.each(view_model.restaurant_list(), function() {
        let location = {};
        let self = this;
        location.lat = parseFloat(this.location.latitude);
        location.lng = parseFloat(this.location.longitude);
        let marker = new google.maps.Marker({
            position: location,
            animation: google.maps.Animation.DROP,
            title: this.name,
            map: map,
        });

        // Add listener to the marker so that when the user clicks it
        // the marker would bounce and display the info window.
        marker.addListener('click', function() {
            map.panTo(location);
            map.setZoom(17);
            toggle_bounce(marker);
            populate_infowindow(marker, self);
        });

        this.marker = marker;
        bounds.extend(location);
    });
    return bounds;
}

// Will trigger a bounce animation on the marker provided.
function toggle_bounce(marker) {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    // Marker will only bounce for 2 seconds
    window.setTimeout(function() {
        marker.setAnimation(null);
    }, 2000);
}

function hide_markers() {
    $.each(view_model.restaurant_list(), function() {
        if (this.marker) {
            this.marker.setMap(null);
        }
    });
}

function show_markers(restaurant_list) {
    $.each(restaurant_list, function() {
        if (this.displayed()) {
            let marker = this.marker;

            if (marker) {
                marker.setMap(map);
                marker.setAnimation(google.maps.Animation.DROP);
            }
        }
    });
}

// Function that would determine if the side section would
// be displayed or not.
function toggle_burger() {
    if (view_model.toggled()) {
        view_model.toggled(false);
    } else {
        view_model.toggled(true);
    }
}

$(window).ready(function() {
    let rq = get_result_query();
    let prev;
    if (!rq) {
        prev = -1;
    } else {
        prev = parseInt(rq.prev);
    }
    // Previous button should be disabled by default if the restaurant list
    // provided by Zomato is the first list of its restaurants.
    if (!prev || prev == -1) view_model.prev_disabled(true);

    // Side section should be hidden by default if the webpage is viewed 
    // in a smaller screen e.g. tablet or mobile phone.
    if ($(window).width() <= 950) {
        view_model.toggled(true);
    }
});

// Side section should be hidden if the user resizes the browser 
// to 950px or lower.
$(window).resize(function() {
    if ($(window).width() <= 950) {
        view_model.toggled(true);
    }
});