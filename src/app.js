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

function parse_nextbus_xml(data) {
  var lines = data.split('\n');
  var vehicles = [];
  for (var i = 0; i < lines.length; i++) {
    if (lines[i].indexOf('<vehicle ') != -1) {
      var attrs = lines[i].match(/(\w+)="([^"]*)"/g);
      var vehicle = {};
      for (var j = 0; j < attrs.length; j++) {
        var m = attrs[j].match(/(\w+)="([^"]*)"/);
        vehicle[m[1]] = m[2];
      }
      vehicles[vehicles.length] = vehicle;
    }
  }
  return vehicles;
}

function latlon_to_distance_heading(from_lat, from_lon, to_lat, to_lon) {
  var loc = {};
  // Lame approximation, valid for short distances, far away from poles, and
  // not crossing dateline.
  var earth_circumference_m = 40075160;
  loc.dy_m = (to_lat - from_lat) * earth_circumference_m / 360;
  loc.dx_m = (to_lon - from_lon) * Math.cos(from_lat*Math.PI/180) * earth_circumference_m / 360;

  loc.distance_m = Math.sqrt(loc.dx_m*loc.dx_m + loc.dy_m*loc.dy_m);
  var miles_per_m = 0.000621371;
  loc.distance_miles = miles_per_m * loc.distance_m;
  loc.direction = Math.atan2(dy_m, dx_m);
  loc.heading_int = (Math.round(direction * 4/Math.PI) + 8) % 8;
  loc.heading = ["E","NE","N","NW","W","SW","S","SE"][loc.heading_int];
  return loc;
}

function update_from_web() {
  ajax(
    {
      url: 'http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=actransit&t=0&r=51A',
      cache: false,
    },
    function(data, status, request) {
      var vehicles = parse_nextbus_xml(data);
      var closest_distance_miles = Infinity;
      for (var i = 0; i < vehicles.length; i++) {
        var loc = latlon_to_distance_heading(
          coords.latitude, coords.longitude, vehicle.lat, vehicle.lon);
        if (closest_distance_miles > loc.distance_miles) {
          closest_distance_miles = loc.distance_miles;
          text = vehicle.routeTag + ": " + loc.distance_miles.toFixed(2) + " mi " + loc.heading;
          timestamp = Date.now() - (1000.0 * vehicle.secsSinceReport);
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
