// PebbleJS watchface by Chris Lesniewski (ctl@mit.edu).
// Downloads bus locations from nextbus.com and displays the closest bus.

var ajax = require('ajax');
var UI = require('ui');
var Vector2 = require('vector2');


// Track our current position.
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


// Set up the Pebble UI.
var window = new UI.Window();
var text_box = new UI.Text({
  position: new Vector2(0, 20),
  size: new Vector2(144, 80),
  font: 'gothic-24-bold',
  text: '(error)',
  textAlign: 'center',
  textOverflow: 'wrap'
});
window.add(text_box);
window.show();


// Every 10 seconds, update the vehicle location indicators.
function main_update_loop() {
  refresh_vehicle_locations(function() {
    setTimeout(main_update_loop, 10000);
  });
}

function refresh_vehicle_locations(callback) {
  get_nextbus_vehicle_locations(
    [
      { agency: "actransit", route: "E" },
      { agency: "actransit", route: "49" },
    ],
    function(vehicles) {
      var closest = closest_by_heading(vehicles);
      refresh_vehicles_text(closest.slice(0, 2));
      callback();
    },
    function() {
      refresh_vehicles_text();
      callback();
    }
  );
}

// Download vehicle locations from nextbus.com.
function get_nextbus_vehicle_locations(agency_routes, on_success, on_error) {
  var vehicles = [];
  var outstanding = agency_routes.length;
  agency_routes.forEach(function(spec) {
    var url = ('http://webservices.nextbus.com/service/publicXMLFeed?command=vehicleLocations&a=' +
        spec.agency + '&t=0&r=' + spec.route);
    ajax({ url: url, cache: false, },
      function(data, status, request) {
        vehicles = vehicles.concat(parse_nextbus_xml(data));
        if (--outstanding === 0) {
          on_success(vehicles);
        }
      },
      function(data, status, request) {
        outstanding = 0;
        on_error();
      }
    );
  });
}

// Convert <vehicle .../> lines in nextbus result XML into JSON.
function parse_nextbus_xml(data) {
  var vehicles = [];
  data.match(/<vehicle\s+[^>]*\/\s*>/g).forEach(function(tag) {      
    var vehicle = {};
    tag.match(/(\w+)="([^"]*)"/g).forEach(function(attr) {
      var m = attr.match(/(\w+)="([^"]*)"/);
      vehicle[m[1]] = m[2];
    });
    vehicle.timestamp = Date.now() - (1000.0 * vehicle.secsSinceReport);
    vehicles.push(vehicle);
  });
  return vehicles;
}

// Order the vehicles by distance. Then keep only the closest vehicles in any cardinal direction.
function closest_by_heading(vehicles) {
  var by_distance = [];
  vehicles.forEach(function(v) {
    v.loc = latlon_to_distance_heading(coords.latitude, coords.longitude, v.lat, v.lon);
    by_distance.push(v);
  });
  by_distance.sort(function(a, b) {
    return a.loc.distance_m - b.loc.distance_m;
  });
  var headings = [false, false, false, false, false, false, false, false];
  var closest = [];
  by_distance.forEach(function(v) {
    if (!headings[v.loc.heading_int]) {
      headings[v.loc.heading_int] = true;
      headings[(v.loc.heading_int+1) % 8] = true;
      headings[(v.loc.heading_int+7) % 8] = true;
      closest.push(v);
    }
  });
  return closest;
}

// Given a pair of latitude/longitudes, compute distance and direction information in various units.
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
  loc.direction = Math.atan2(loc.dy_m, loc.dx_m);
  loc.heading_int = (Math.round(loc.direction * 4/Math.PI) + 8) % 8;
  loc.heading = ["E","NE","N","NW","W","SW","S","SE"][loc.heading_int];
  return loc;
}

// Display the list of vehicles.
var vehicles = [];
function refresh_vehicles_text(updated_vehicles) {
  if (updated_vehicles !== undefined) { vehicles = updated_vehicles; }
  if (vehicles.length === 0) { text_box.text("(no vehicles)"); return; }

  var text = "";
  vehicles.forEach(function(v) {
    text += v.routeTag + ": " + v.loc.distance_miles.toFixed(2) + " mi " + v.loc.heading;
    text += " (" + Math.round((Date.now() - v.timestamp)/1000) + " sec)\n";
  });
  text_box.text(text);
}

main_update_loop();