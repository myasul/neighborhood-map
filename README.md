# Restaurant Finder
Neighbourhood Map Project for Udacity's Full Stack Web Developer Course


__Description__

This website allows the user to browse restaurants in different cities that is supported by Zomato. The specific location of the restaurants are plotted using markers in the Google map. Users can also use filters (category and average cost for two people) to help them search thro
-ugh the list of restaurants.

__Pre-requisites__
- Setup Google Map Javascript API.
  - Get an API key by following the instructons in this link - https://developers.google.com/maps/documentation/javascript/get-api-key.
  - Open index.html and insert your API key in,
  ```html
  <script defer src="https://maps.googleapis.com/maps/api/js?libraries=places,geometry&key=YOUR_API_KEY"></script>
  ```
  
- Setup Zomato API.
  - Generate an API key by going to the link below and clicking 'Generate API key'.
  https://developers.zomato.com/api#headline2
  - Open app.js file and paste the Zomato key in line 6.
  ```javascript
  const ZOMATO_KEY = '000e28228e4fb09d7e02710d59331fbe';
  ```
  
- Personalized Default location and Restaurant list. (optional)
  - Change default location.
    - Get the coordinates using Geocoder API. The coordintes can be found in results.geometry.location
    https://maps.googleapis.com/maps/api/geocode/json?address=INPUT_ADDRESS_HERE&key=YOUR_API_KEY
    - Add the latitude and longitude inside app.js in line 7.
  ```javascript
  const DFLT_LOCATION = { lat: 'INSERT LATITUDE HERE', lng: 'INSERT LONGITUDE HERE' };
  ```
  - Create your own restaurants_zomato.json.
    - Use Zomato's API search sandbox. Use your Zomato API key and the coordinates you acquired using Google's Geocoder API
    https://developers.zomato.com/documentation#!/restaurant/search
    - Save the result as restaurants_zomato.json.
    
__Features__
- Users can search restaurants depending on the country and city they have provided in the location section.
- Filters (category and average cost for two) can be used to further assist the user in searching through the restaurant list.
  Average cost for two is in pesos but this is automatically converted to the selected country's currency. (e.g. If the user selected 5000 PHP for New York restaurants, the system would display restaurants that have cost equals or lower than 95.095 USD.)
- The website would display an initial list of 20 restaurants. The user has the choice to request another set of restaurants (20 restaurants at most) from Zomato by clicking the right arrow button in the Filter section. 
- The users can go to the previous list by clicking the left arrow button.
- The website would provide useful information about the restaurant when either you click the restaurant's name in the restaurants section or the marker inside the map.
  - Link to zomato containing the full details of the restaurant.
  - Average cost for two.
  - Rating.
  - Full Address.
- The website is fully responsive and can be viewed in tablets and mobile phones.

ENJOY USING THE RESTAURANT FINDER! :smile::blush::grin:
