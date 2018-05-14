let map;

function init_map() {
    map = new google.maps.Map($('#map').get(0), {
        center: { lat: 14.5408671, lng: 121.0503183 },
        zoom: 15,
    })
}

let Restaurant = function(data) {
    this.restaurant_id = ko.observable(data.id);
    this.lat = ko.observable(data.location.latitude);
    this.lng = ko.observable(data.location.longitude);
    this.name = ko.observable(data.name);
}

let ViewModel = function() {
    let self = this;
    this.restaurant_list = ko.observableArray();

    $.getJSON("restaurants_zomato.json", function(json) {
        $.each(json.restaurants, function() {
            self.restaurant_list.push(new Restaurant(this.restaurant));
        });
    });

}

ko.applyBindings(new ViewModel());