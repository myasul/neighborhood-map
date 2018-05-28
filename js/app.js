let map;
let infowindow;
let markers = [];
let autocomplete;
let bounds;
const ZOMATO_KEY = '000e28228e4fb09d7e02710d59331fbe';

// Restaurant Model
let Restaurant = function() {
    this.restaurant_id = ko.observable();
    this.lat = ko.observable();
    this.lng = ko.observable();
    this.name = ko.observable();
    this.selected = ko.observable();
    this.categories = ko.observableArray();
    this.average_cost_for_two = ko.observable();

    this.create_from_search = function(data) {
        this.restaurant_id(data.restaurant_id);
        this.lat(data.lat);
        this.lng(data.lng);
        this.name(data.name);
        this.selected(data.selected);
        this.categories(data.categories);
        this.average_cost_for_two(data.average_cost_for_two);
    }

    this.create_from_json = function(data) {
        this.restaurant_id(data.id);
        this.lat(data.location.latitude);
        this.lng(data.location.longitude);
        this.name(data.name);
        this.selected(false);
        this.categories(data.cuisines.split(", "));
        this.average_cost_for_two(data.average_cost_for_two);
    }
}

// Country Model
let Country = function(data) {
    this.name = ko.observable(data.name);
    this.code = ko.observable(data.code);
}

let ViewModel = function() {
    let self = this;
    this.restaurant_list = ko.observableArray();
    this.category_list = ko.observableArray();
    this.country_list = ko.observableArray();
    this.current_restaurant = ko.observable();

    // Currently, the list of restaurants is saved in retaurants_zomato.json
    // I used Zomato /search API to fetch the list of restaurants within the vicinity of Taguig.
    if (localStorage.length == 0) {
        $.getJSON("restaurants_zomato.json", function(json) {
            populate_restaurant_list_from_json(json.restaurants, self);
            populate_category_list(self);
        }).fail(function(error) {
            console.log(error.responseText);
            alert("An error has been encountered. Please consult with your system administrator.");
        });;
    } else {
        populate_restaurant_list_from_localstorage(self);
        populate_category_list(self);
    }

    // Populate the country drop down.
    $.getJSON("countries.json", function(json) {
        $.each(json, function() {
            self.country_list.push(new Country(this));
        });
    });

    // Filter feature
    $("#search").on("click", function() {
        let chosen_category = $("#category-list").val();
        let chosen_cost = $('#cost-slider').slider("option", "value");

        // Remove all the current restaurants so that we could populate it
        // with the restaurants that satisfy the filters specified by the user
        self.restaurant_list.removeAll();
        let restaurants = ko.utils.parseJson(localStorage.getItem("restaurants"));

        $.each(restaurants, function() {
            let average_cost_for_two = this.average_cost_for_two;
            let categories = this.categories;

            match = categories.find(function(category) {
                return category == chosen_category;
            });
            if (match && average_cost_for_two <= chosen_cost) {
                let restaurant = new Restaurant();
                restaurant.create_from_search(this)
                self.restaurant_list.push(restaurant);
            }
        });

        // Hide all markers first then show only the 
        // markers of the filtered restaurants
        hide_markers();
        show_markers(self.restaurant_list());
    });

    // Provides a way for the user to "reset" and 
    // show all the restaurants and markers.
    $("#show-all").on("click", function() {
        // clear lists first before populating them.
        view_model.restaurant_list.removeAll();

        populate_restaurant_list_from_localstorage(self);
        map.fitBounds(bounds);
        show_all_markers();
    });

    // Setting the current restaurant will be triggered when the user clicks
    // on a restaurant on the list
    this.set_current_restaurant = function() {
        if (self.current_restaurant()) {
            self.current_restaurant().selected(false);
        }
        self.current_restaurant(this);
        self.current_restaurant().selected(true);
        let marker = find_marker(this);

        if (marker) {
            // When the user clicks a restaurant the markers linked to it should bounce.
            toggle_bounce(marker);
            map.panTo(marker.position);
            map.setZoom(17);
            // It also should pop out the info window.
            populate_infowindow(marker, this);
        }
    }
    init_map(self);
}

// Initialise map
function init_map(view_model) {
    map = new google.maps.Map($('#map').get(0), {
        center: { lat: 14.5408671, lng: 121.0503183 },
        zoom: 15,
    });
    bounds = new google.maps.LatLngBounds();
    infowindow = new google.maps.InfoWindow();

    // Create the autocomplete object and associate it with the UI input control.
    autocomplete = new google.maps.places.Autocomplete(
        ($("#city_autocomplete").get(0)), {
            types: ['(cities)'],
            componentRestrictions: { 'country': [] }
        }
    );

    // When the user selects a city suggested by Google's autocomplete feature,
    // Use that to search restaurants and zoom the map in on that city.
    autocomplete.addListener('place_changed', on_place_changed);

    // Set the country restriction depending on the country that
    // the user picked in the country list
    $("#country-list").change(function() {
        autocomplete.setComponentRestrictions(get_country());
    });

    // Search the place manually when the user presses enter
    $("#city_autocomplete").keydown(function() {
        if (event.which == 13) {
            on_place_entered();
        }
    });

    if (!view_model.restaurant_list().length == 0) {
        bounds = init_markers(view_model.restaurant_list(), bounds);
        // Make sure that all markers are visible in the map
        map.fitBounds(bounds);
        map.setZoom(17);
    }
}


// The function will find the restaurant's marker by looking in 
// the each markers coordinates and comparing it with
// the coordinates of the provided restaurant.
function find_marker(rst) {
    let rst_lat = rst.lat();
    let rst_lng = rst.lng();
    let marker;
    for (let i = 0; i < markers.length; i++) {
        let marker_lat = markers[i].getPosition().lat().toFixed(10);
        let marker_lng = markers[i].getPosition().lng().toFixed(10);
        if ((rst_lat == marker_lat) && (rst_lng == marker_lng)) {
            return markers[i];
        }
    }
    return null;
}

function on_place_changed() {
    let place = autocomplete.getPlace();
    if (place.geometry) {
        let location = place.geometry.location;
        create_restaurant_list_and_markers(location.lat(), location.lng());
    } else {
        $("#city_autocomplete").val('');
    }
}

function on_place_entered() {
    let geocoder = new google.maps.Geocoder();
    let country = $("#country-list").val();
    let city = $("#city_autocomplete").val();

    if (!city) {
        alert("Please enter a valid city.");
    } else {
        geocoder.geocode({
                'address': city,
                componentRestrictions: get_country()
            },
            function(results, status) {
                if (status == google.maps.GeocoderStatus.OK) {
                    let location = results[0].geometry.location;
                    create_restaurant_list_and_markers(location.lat(), location.lng());
                } else {
                    alert("We could not find the specified location. Please enter a valid city.");
                }
            });
    }
}

// To create the restaurant list, pass the coordinates of the city 
// the user chose and use it to request the restaurant list from zomato.
function create_restaurant_list_and_markers(lat, lng) {
    $.ajax({
        type: 'GET',
        dataType: "json",
        url: `https://developers.zomato.com/api/v2.1/search?lat=${lat}&lon=${lng}&radius=2000&category=8%2C9%2C10&sort=real_distance&order=desc`,
        headers: { "user-key": ZOMATO_KEY },
    }).done(function(result) {
        clear_markers();
        // clear lists first before populating them.
        view_model.restaurant_list.removeAll();
        view_model.category_list.removeAll();
        bounds = new google.maps.LatLngBounds();

        populate_restaurant_list_from_json(result.restaurants, view_model);
        populate_category_list(view_model);

        if (!view_model.restaurant_list().length == 0) {
            bounds = init_markers(view_model.restaurant_list(), bounds);
            // Make sure that all markers are visible in the map
            map.fitBounds(bounds);
        }
    }).fail(function(error) {
        console.log(error.responseJSON);
        alert("An error has been encountered. Please consult with your system administrator.");
    });
}

// Populate category list by fetching all the cuisines in all the restaurants
function populate_category_list(view_model) {
    $.each(view_model.restaurant_list(), function() {
        $.each(this.categories(), function() {
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

function populate_restaurant_list_from_json(restaurants, view_model) {
    let restaurant_array = []
    let count = 0;

    $.each(restaurants, function() {
        let restaurant = new Restaurant();
        restaurant.create_from_json(this.restaurant);
        view_model.restaurant_list.push(restaurant);
        restaurant_array.push(view_model.restaurant_list()[count]);
        count++;
    });
    localStorage.setItem("restaurants", ko.toJSON(restaurant_array));
}

function populate_restaurant_list_from_localstorage(view_model) {
    view_model.restaurant_list.removeAll();
    let restaurants = ko.utils.parseJson(localStorage.getItem("restaurants"));

    $.each(restaurants, function() {
        let restaurant = new Restaurant();
        restaurant.create_from_search(this);
        view_model.restaurant_list.push(restaurant);
    });
}

function get_country() {
    let empty_array = [];
    let country = $("#country-list").val();
    if (country == 'AA') {
        return {
            'country': []
        };
    } else {
        return { 'country': country };
    }
}

// Function will put all markers on all the restaurants' location 
// provided in the restaurant list.
function init_markers(restaurant_list, bounds) {
    $.each(restaurant_list, function() {
        let location = {};
        let self = this;
        location.lat = parseFloat(this.lat());
        location.lng = parseFloat(this.lng());
        var marker = new google.maps.Marker({
            position: location,
            animation: google.maps.Animation.DROP,
            title: this.name(),
            map: map,
        });
        let copy_marker;
        marker.addListener('click', function() {
            map.panTo(location);
            map.setZoom(17);
            toggle_bounce(marker);
            populate_infowindow(marker, self);
        });
        markers.push(marker);
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

// Populate the infowindow with the necessary restaurant details and
// pop it up in the marker provided.
function populate_infowindow(marker, restaurant) {
    if (infowindow.marker != marker) {
        infowindow.close();
        infowindow.setContent('');
        infowindow.marker = marker;
        let rst_id = restaurant.restaurant_id();
        let details_url = `https://developers.zomato.com/api/v2.1/restaurant?res_id=${rst_id}`;
        let review_url = `https://developers.zomato.com/api/v2.1/reviews?res_id=${rst_id}&count=5`
        let restaurant_html = '';

        // Request restaurant details from Zomato
        $.ajax({
            type: 'GET',
            dataType: "json",
            // TODO - Make a way for the user to insert their own API KEY
            headers: { "user-key": ZOMATO_KEY },
            url: details_url
        }).done(function(result) {
            restaurant_html = `
            <div class="infowindow-container">
                <h1>${result.name}</h1>
                <img src="${result.thumb}">
                <br>
                <p><a href="${result.url}">Check it out in Zomato!</a><br>
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
            alert("An error has been encountered. Please consult with your system administrator.");
        });
    } else {
        // If the user clicks on the same marker, reopen it.
        infowindow.close();
        infowindow.open(map, marker);
    }
}

function clear_markers() {
    hide_markers();
    markers = [];
}

function hide_markers() {
    $.each(markers, function() {
        this.setMap(null);
    });
}

function show_markers(restaurant_list) {
    $.each(restaurant_list, function() {
        let marker = find_marker(this);

        if (marker) {
            marker.setMap(map);
            marker.setAnimation(google.maps.Animation.DROP);
        }
    });
}

function show_all_markers() {
    $.each(markers, function() {
        this.setMap(map);
        this.setAnimation(google.maps.Animation.DROP);
    });
}

let view_model = new ViewModel();
ko.applyBindings(view_model);