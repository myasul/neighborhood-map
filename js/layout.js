(function() {
    let location_container_open;
    let location_container_close;
    let filter_container_open;
    let filter_container_close;
    let restaurant_container_open;
    let restaurant_container_close;
    let filter;
    let location;
    let restaurant;

    $(window).ready(function() {
        // Collect all the height measurements once the page is ready.
        // Height measurements will be used for slide up/down feature of
        // side section.
        location = $('#location').height();
        location_container_open = $('.location-container').height();
        location_container_close = $('.location-container').height() - location;

        filter = $('#filter').height();
        filter_container_open = $('.filter-container').height();
        filter_container_close = $('.filter-container').height() - filter;

        restaurant = $('#restaurant').height();
        restaurant_container_open = $('.restaurant-container').height();
        restaurant_container_close = $('.restaurant-container').height() - restaurant;
    });


    $('#location-toggle').click(function() {
        slide('location');
        resize_restaurant_section();
    });

    $('#filter-toggle').click(function() {
        slide('filter');
        resize_restaurant_section();
    });

    $('#restaurant-toggle').click(function() {
        slide('restaurant');
        resize_restaurant_section();
    });

    // Function would enable the user to slide up (hide) or
    // slide down (show) the sections in the side bar. 
    function slide(section) {
        let container_close = eval(`${section}_container_close`);
        let container_open = eval(`${section}_container_open`);
        $(`#${section}`).slideToggle();
        if ($(`#${section}`).hasClass('open')) {
            $(`.${section}-container`).css('height', `calc( ${container_close}px)`);
        } else {
            $(`.${section}-container`).css('height', `calc( ${container_open}px)`);
        }
        $(`#${section}`).toggleClass('open');
    }

    // The restaurant list should always fill up the space of the 
    // side bar. Space to be filled up would be different depending
    // on the number of sections opened.
    function resize_restaurant_section() {
        let location_is_hidden = !$('#location').hasClass('open');
        let filter_is_hidden = !$('#filter').hasClass('open');
        let restaurant = $('.restaurant-container');
        let rheight = restaurant_container_open;

        if (location_is_hidden && filter_is_hidden) {
            restaurant.height(rheight + location + filter);
        } else if (filter_is_hidden) {
            restaurant.height(rheight + filter);
        } else if (location_is_hidden) {
            restaurant.height(rheight + location);
        } else {
            restaurant.height(rheight);
        }
    }

    // Animate the arrow head when 
    $('.toggle').click(function() {
        let elem = $('svg', this);
        let degree_from;
        let degree_to;

        if ($(this).next('.open').length) {
            degree_from = '180';
            degree_to = '360';
        } else {
            degree_from = '0';
            degree_to = '180';
        }

        $({ deg: degree_from }).animate({ deg: degree_to }, {
            step: function(now, fx) {
                $(elem).css({ 'transform': `rotate(${now}deg)` });
            }
        });

    });

})();

// Return an error when initialization of google map fails.
function init_map_failed() {
    alert('An error has been encountered. Please consult with your system administrator.');
}