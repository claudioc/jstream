
var fs = require("fs");
var http = require('http');
var sockjs = require('sockjs');

var echo = sockjs.createServer();
echo.on('connection', function(conn) {

  conn.on('data', function(message) {

    var resource;
    try {
      resource = JSON.parse(message);
    } catch(e) {
      return;
    }

    fs.readFile("./assets/" + resource.name, function (err, data) {

      if (err) {
        resource.state = -1;
        console.log("Cannot read " + resource.name);
      } else {
        resource.content = data.toString();
        resource.state = 1;
      }

      setTimeout(function() {
        conn.write(JSON.stringify(resource));
      }, Math.random() * 3000);
      

    });
  });

  conn.on('close', function() {});
});

var server = http.createServer();
echo.installHandlers(server, {prefix:'/jstream'});
server.listen(9999, '0.0.0.0');
