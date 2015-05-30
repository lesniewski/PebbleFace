var coords = {
  latitude: 37.8717,
  longitude: -122.2728,
};

navigator.geolocation.watchPosition(
  function(position) { coords = position.coords; },
  function(error) { console.log("getCurrentPosition error: " + error.message); },
  {
    maximumAge: 10000,
    timeout: 10000,
  }
);

var ajax = require('ajax');
var UI = require('ui');
var Vector2 = require('vector2');

var window = new UI.Window();
var text_box = new UI.Text({
  position: new Vector2(0, 50),
  size: new Vector2(144, 30),
  font: 'gothic-24-bold',
  text: 'Text Anywhere!',
  textAlign: 'center',
  textOverflow: 'wrap'
});
window.add(text_box);
window.show();

var text = "(no data)";
var timestamp = Date.now();

function update_text() {
  text_box.text(text + " (" + Math.round((Date.now() - timestamp)/1000) + " sec)");
}

function update_from_web() {
  ajax(
    {
      url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=actransit&t=0&r=51A',
      cache: false,
    },
    function(data, status, request) {
      var closest_distance_m = Infinity;
      var lines = data.split('\n');
      for (var i = 0; i < lines.length; i++) {
        if (lines[i].indexOf('<vehicle ') != -1) {
          var attrs = lines[i].match(/(\w+)="([^"]*)"/g);
          var vehicle = {};
          for (var j = 0; j < attrs.length; j++) {
            var m = attrs[j].match(/(\w+)="([^"]*)"/);
            vehicle[m[1]] = m[2];
          }
          
          // Lame approximation, valid for short distances, far away from poles, and not crossing dateline.
          var earth_circumference_m = 40075160;
          var dy_m = (vehicle.lat - coords.latitude) * earth_circumference_m/360;
          var dx_m = (vehicle.lon - coords.longitude) * Math.cos(vehicle.lat*Math.PI/180) * earth_circumference_m/360;
  
          var distance_m = Math.sqrt(dx_m*dx_m + dy_m*dy_m);
          var direction = Math.atan2(dy_m, dx_m);
          var heading = ["W","SW","S","SE","E","NE","N","NW","W"][Math.round(4*(1 + direction/Math.PI))];
          if (closest_distance_m > distance_m) {
            closest_distance_m = distance_m;
            var miles_per_m = 0.000621371;
            var distance_miles = miles_per_m * distance_m;
            text = vehicle.routeTag + ": " + distance_miles.toFixed(2) + " mi " + heading;
            timestamp = Date.now() - (1000.0 * vehicle.secsSinceReport);
          }
        }
      }
      update_text();
      setTimeout(update_from_web, 10000);
    },
    function(data, status, request) {
      update_text();
      setTimeout(update_from_web, 10000);
    }
  );
}
update_from_web();