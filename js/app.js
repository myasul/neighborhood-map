let map;
let infowindow;
let markers = [];
let toggled = false;

// Restaurant Model
let Restaurant = function(data) {
    this.restaurant_id = ko.observable(data.id);
    this.lat = ko.observable(data.location.latitude);
    this.lng = ko.observable(data.location.longitude);
    this.name = ko.observable(data.name);
    this.selected = ko.observable(false);
    this.categories = ko.observableArray(data.cuisines.split(", "));
    this.price = ko.observable(data.average_cost_for_two);
}

let ViewModel = function() {
    let self = this;
    // Restaurant list. Choices provided to the user that will be displayed in the side bar.
    this.restaurant_list = ko.observableArray();
    // List of categories. This will be used as filter.
    this.category_list = ko.observableArray();
    // The restaurant that is selected by the user.
    this.current_restaurant = ko.observable();

    // Currently, the list of restaurants is saved in retaurants_zomato.json
    // I used Zomato /search API to fetch the list of restaurants within the vicinity of Taguig.
    $.getJSON("restaurants_zomato.json", function(json) {
        // Populate the restaurant list by creating restaurant objects
        $.each(json.restaurants, function() {
            self.restaurant_list.push(new Restaurant(this.restaurant));
        });

        // Populate category list by fetching all the cuisines in all the restaurants
        $.each(self.restaurant_list(), function() {
            $.each(this.categories(), function() {
                let category = String(this);
                // Make sure that all the categories saved do not have duplicates
                let match = ko.utils.arrayFirst(self.category_list(), function(item) {
                    return category === item;
                });
                if (!match) {
                    self.category_list.push(category);
                }
            })
        });

    }).fail(function(error) {
        console.log(error.responseText);
        alert("An error has been encountered. Please consult with your system administrator.");
    });;

    // Filter feature
    $("#search").on("click", function() {
        let chosen_category = $("#category-list").val();
        let chosen_price = $('#price-slider').slider("option", "value");
        // Remove all the current restaurants so that we could populate it
        // with the restaurants that satisfy the filters specified by the user
        self.restaurant_list.removeAll();

        // Populate the restaurant list
        $.getJSON("restaurants_zomato.json", function(json) {
            $.each(json.restaurants, function() {
                let categories = this.restaurant.cuisines.split(", ");
                let price = this.restaurant.average_cost_for_two;
                match = categories.find(function(category) {
                    return category == chosen_category;
                });
                // Check if the restaurant satisfies the filter
                if (match && price <= chosen_price) {
                    self.restaurant_list.push(new Restaurant(this.restaurant));
                }
            });

            // Hide all markers first then show only the 
            // markers of the filtered restaurants
            hide_markers();
            show_markers(self.restaurant_list());
        }).fail(function(error) {
            console.log(error.responseText);
            alert("An error has been encountered. Please consult with your system administrator.");
        });
    });

    // Provides a way for the user to "reset" and 
    // show all the restaurants and markers.
    $("#show-all").on("click", function() {
        self.restaurant_list.removeAll();
        $.getJSON("restaurants_zomato.json", function(json) { // TODO :: add fail function
            $.each(json.restaurants, function() {
                self.restaurant_list.push(new Restaurant(this.restaurant));
            });
        });
        show_all_markers();
    });

    // Put all the markers in place when the page loads.
    if (!markers) {
        init_markers(this.restaurant_list);
    }

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
            // It also should pop out the info window.
            populate_infowindow(marker, this);
        }
    }
}

// This function finds the marker related to the provided restaurant
function find_marker(rst) {
    let rst_lat = rst.lat();
    let rst_lng = rst.lng();
    let marker;
    for (let i = 0; i < markers.length; i++) {
        // The function will find the restaurant's marker by looking in 
        // the each markers coordinates and comparing it with
        // the coordinates of the provided restaurant.
        let marker_lat = markers[i].getPosition().lat().toFixed(10);
        let marker_lng = markers[i].getPosition().lng().toFixed(10);
        if ((rst_lat == marker_lat) && (rst_lng == marker_lng)) {
            return markers[i];
        }
    }
    return null;
}

// Initialise map
function init_map() {
    map = new google.maps.Map($('#map').get(0), {
        center: { lat: 14.5408671, lng: 121.0503183 },
        zoom: 15,
    });
    infowindow = new google.maps.InfoWindow();
    let bounds = new google.maps.LatLngBounds();
    if (!view_model.restaurant_list().length == 0) {
        bounds = init_markers(view_model.restaurant_list(), bounds);
        // Make sure that all markers are visible in the map
        map.fitBounds(bounds);
        map.setZoom(16);
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
            headers: { "user-key": "000e28228e4fb09d7e02710d59331fbe" },
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

// Added 1 second delay to the initialization of the map
// to make sure that the restaurant list is loaded.
function init_map_with_delay() {
    window.setTimeout(init_map, 1000);
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

$("header img").click(function() {
    $("aside").toggleClass('slide');
    $(".control-container ").toggleClass('hide');
    $("#price-slider").toggleClass('hide');
    $("#custom-handle").toggleClass('hide');
    $("#map").width()
    if (!toggled) {
        $("#map").width("100%");
        toggled = true;
    } else {
        $("#map").css('width', 'calc(100% - 330px)');
        toggled = false;
    }

});

$(window).resize(function() {
    if ($(window).width() <= 950) {
        $("aside").addClass('slide');
        $(".control-container ").addClass('hide');
        $("#price-slider").addClass('hide');
        $("#custom-handle").addClass('hide');
        $("#map").width("100%");
        toggled = true;
    }
})

$(window).ready(function() {
    if ($(window).width() <= 950) {
        $("aside").addClass('slide');
        $(".control-container ").addClass('hide');
        $("#price-slider").addClass('hide');
        $("#custom-handle").addClass('hide');
        $("#map").width("100%");
        toggled = true;
    }
});

// Jquery UI Slider
let handle = $("#custom-handle");
$("#price-slider").slider({
    value: 3000,
    min: 500,
    max: 3000,
    step: 50,
    create: function() {
        handle.text('₱' + $(this).slider("value"));
    },
    slide: function(event, ui) {
        handle.text(`₱ ${ui.value}`);
    }
});

let view_model = new ViewModel();
ko.applyBindings(view_model);