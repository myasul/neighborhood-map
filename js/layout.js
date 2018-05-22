(function() {
    let toggled = false;
    let location_height;
    let location_container_height;
    let filter_height;
    let filter_container_height;
    let restaurant_height;
    let restaurant_container_height;

    // Burger icon that will toggle to display the restaurant list
    $("header img").click(function() {
        $("aside").toggleClass('slide');
        $(".filter-container").toggleClass('hide');
        $(".location-container").toggleClass('hide');
        $("#cost-slider").toggleClass('hide');
        $("#custom-handle").toggleClass('hide');
        if (!toggled) {
            $("#map").width("100%");
            toggled = true;
        } else {
            $("#map").css('width', 'calc(100% - 330px)');
            toggled = false;
        }

    });

    // Hide the restaurant list if the screen of the user is less
    $(window).resize(function() {
        if ($(window).width() <= 950) {
            $("aside").addClass('slide');
            $(".filter-container").addClass('hide');
            $(".location-container").toggleClass('hide');
            $("#cost-slider").addClass('hide');
            $("#custom-handle").addClass('hide');
            $("#map").width("100%");
            toggled = true;
        }
    })


    $(window).ready(function() {
        // Collect all the height measurements once the page is ready.
        // Height measurements will be used for slide up/down feature of
        // side section.
        location_height = $("#location").height();
        location_container_height = $(".location-container").height();

        filter_height = $("#filter").height();
        filter_container_height = $(".filter-container").height();

        restaurant_height = $("#restaurant").height();
        restaurant_container_height = $(".restaurant-container").height();

        // Hide the restaurant list if the screen of the user is less
        // than 950 pixels (applies to tablets and mobile phones)
        if ($(window).width() <= 950) {
            $("aside").addClass('slide');
            $(".filter-container ").addClass('hide');
            $(".location-container").toggleClass('hide');
            $("#cost-slider").addClass('hide');
            $("#custom-handle").addClass('hide');
            $("#map").width("100%");
            toggled = true;
        }
    });


    $("#location-toggle").click(function() {
        slide('location');
    });

    $("#filter-toggle").click(function() {
        slide('filter');
    });

    $("#restaurant-toggle").click(function() {
        slide('restaurant');
    });

    // Function would enable the user to slide up (hide) or
    // slide down (show) the sections in the side bar. 
    function slide(section) {
        let wrapper_height = eval(`${section}_height`);
        let container_height = eval(`${section}_container_height`);
        $(`#${section}`).slideToggle("open");
        if ($(`#${section}`).hasClass("open")) {
            $(`.${section}-container`).css('height', `calc( ${container_height}px - ${wrapper_height}px)`);
        } else {
            $(`.${section}-container`).css('height', `calc( ${container_height}px)`);
        }
        $(`#${section}`).toggleClass("open");
    }

    // Jquery UI Slider
    let handle = $("#custom-handle");
    $("#cost-slider").slider({
        value: 5000,
        min: 500,
        max: 5000,
        step: 50,
        create: function() {
            handle.text('₱' + $(this).slider("value"));
        },
        slide: function(event, ui) {
            handle.text(`₱ ${ui.value}`);
        }
    });

})()