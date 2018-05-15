let map;
let infowindow;
let markers = [];

let Restaurant = function(data) {
    this.restaurant_id = ko.observable(data.id);
    this.lat = ko.observable(data.location.latitude);
    this.lng = ko.observable(data.location.longitude);
    this.name = ko.observable(data.name);
    this.selected = ko.observable(false);
}

let ViewModel = function() {
    let self = this;
    this.restaurant_list = ko.observableArray();
    this.current_restaurant = ko.observable();

    $.getJSON("restaurants_zomato.json", function(json) {
        $.each(json.restaurants, function() {
            self.restaurant_list.push(new Restaurant(this.restaurant));
        });
    });

    if (!markers) {
        init_markers(this.restaurant_list);
    }

    this.set_current_restaurant = function() {
        if (self.current_restaurant()) {
            self.current_restaurant().selected(false);
        }
        self.current_restaurant(this);
        self.current_restaurant().selected(true);
        let marker = find_marker(this);

        if (marker) {
            toggle_bounce(marker);
            populate_infowindow(marker, this)
        }
    }
}

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

function init_map() {
    map = new google.maps.Map($('#map').get(0), {
        center: { lat: 14.5408671, lng: 121.0503183 },
        zoom: 15,
    });
    infowindow = new google.maps.InfoWindow();
    let bounds = new google.maps.LatLngBounds();
    if (!view_model.restaurant_list().length == 0) {
        bounds = init_markers(view_model.restaurant_list(), bounds);
        map.fitBounds(bounds);
        map.setZoom(16);
    }
}

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
        markers.push(marker); // TODO: check if needed
        bounds.extend(location);
    });
    return bounds;
}

function toggle_bounce(marker) {
    marker.setAnimation(google.maps.Animation.BOUNCE);
    window.setTimeout(function() {
        marker.setAnimation(null);
    }, 2000);
}

function populate_infowindow(marker, restaurant) {
    if (infowindow.marker != marker) {
        infowindow.close();
        infowindow.setContent('');
        infowindow.marker = marker;
        let rst_id = restaurant.restaurant_id();
        let details_url = `https://developers.zomato.com/api/v2.1/restaurant?res_id=${rst_id}`;
        let review_url = `https://developers.zomato.com/api/v2.1/reviews?res_id=${rst_id}&count=5`
        let restaurant_html = '';

        $.ajax({
            type: 'GET',
            dataType: "json",
            // TODO - Make a way for the user to insert their own API KEY
            headers: { "user-key": "000e28228e4fb09d7e02710d59331fbe" },
            url: details_url
        }).done(function(result) {
            console.log(result);
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

            infowindow.setContent(restaurant_html);
            infowindow.open(map, marker);
        }).fail(function(result) {});
    }
}

function init_map_with_delay() {
    window.setTimeout(init_map, 1000);
}

let view_model = new ViewModel();
ko.applyBindings(view_model);