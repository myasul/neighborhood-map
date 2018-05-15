let map;
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
            marker.setAnimation(google.maps.Animation.BOUNCE);
            window.setTimeout(function() {
                marker.setAnimation(null);
            }, 2000);
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
    var bounds = new google.maps.LatLngBounds();
    if (!view_model.restaurant_list().length == 0) {
        bounds = init_markers(view_model.restaurant_list(), bounds);
        map.fitBounds(bounds);
        map.setZoom(16);
    }
}

function init_markers(restaurant_list, bounds) {
    $.each(restaurant_list, function() {
        let location = {};
        location.lat = parseFloat(this.lat());
        location.lng = parseFloat(this.lng());
        var marker = new google.maps.Marker({
            position: location,
            animation: google.maps.Animation.DROP,
            title: this.name(),
            map: map,
        });
        let copy_marker;
        marker.addListener('click', toggle_bounce);
        markers.push(marker); // TODO: check if needed
        bounds.extend(location);
    });
    return bounds;
}

function toggle_bounce() {
    var self = this;
    this.setAnimation(google.maps.Animation.BOUNCE);
    window.setTimeout(function() {
        self.setAnimation(null);
    }, 2000);
}

function init_map_with_delay() {
    window.setTimeout(init_map, 1000);
}

let view_model = new ViewModel();
ko.applyBindings(view_model);