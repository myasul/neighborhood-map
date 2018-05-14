let map;
let markers = [];

let Restaurant = function(data) {
    this.restaurant_id = ko.observable(data.id);
    this.lat = ko.observable(data.location.latitude);
    this.lng = ko.observable(data.location.longitude);
    this.name = ko.observable(data.name);
}

let ViewModel = function() {
    console.log(new Date());
    let self = this;
    this.restaurant_list = ko.observableArray();

    $.getJSON("restaurants_zomato.json", function(json) {
        $.each(json.restaurants, function() {
            self.restaurant_list.push(new Restaurant(this.restaurant));
        });
    });

    if (!markers) {
        init_markers(this.restaurant_list);
    }
}

function init_map() {
    console.log(new Date());
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
        console.log(location);
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
    console.log(bounds);
    return bounds;
}

function toggle_bounce() {
    var self = this;
    if (!this.getAnimation()) {
        this.setAnimation(google.maps.Animation.BOUNCE);
        window.setTimeout(function() {
            self.setAnimation(null);
        }, 2000)
    } else {
        this.setAnimation(null);
    }
}

function init_map_with_delay() {
    window.setTimeout(init_map, 1000);
}

let view_model = new ViewModel();
ko.applyBindings(view_model);