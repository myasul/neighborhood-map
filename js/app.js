let map;

function init_map() {
    alert("hello!")
    map = new google.maps.Map($('#map').get(0), {
        center: { lat: 14.5408671, lng: 121.0503183 },
        zoom: 15,
    })
}