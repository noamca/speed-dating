"use strict";

/**
 * Load Twilio configuration from .env config file - the following environment
 * variables should be set:
 * process.env.TWILIO_ACCOUNT_SID
 * process.env.TWILIO_API_SID
 * process.env.TWILIO_API_SECRET
 */
require("dotenv").load();

var http = require("http");
var path = require("path");
var AccessToken = require("twilio").jwt.AccessToken;
var VideoGrant = AccessToken.VideoGrant;
var express = require("express");
const fs = require('fs');
var mysql = require('mysql');
var con = mysql.createConnection({
  host: "localhost",
  user: "root",
  password: ""
});

con.connect(function(err) {
  if (err) throw err;
  console.log("Mysql Connected!");
});

// Max. period that a Participant is allowed to be in a Room (currently 5000 seconds or 1.5 hours)
const MAX_ALLOWED_SESSION_DURATION = 5000;

// Create Express webapp.
var app = express();

// Set up the path for the application.
var applicationPath = path.join(__dirname, "../application/public");
app.use("/application", express.static(applicationPath));

/**
 * Default to the Date application.
 */
app.get("/", function(request, response) {
  var modorator = request.query.modorator || 0;
  var userName = request.query.userName || 0;
  var gender = request.query.gender || 0;
  var Id = request.query.id || 0;
  response.redirect("/application/lobby.html?userName=" + userName + "&gender=" + gender + "&id=" + Id);
});

app.get("/room", function(request, response) {
  var userName = request.query.userName || 0;
  var gender = request.query.gender || 0;
  var r = request.query.r || 0;
  response.redirect("/application/room.html?r=" + r + "&userName=" + userName + "&gender=" + gender);
});

app.get("/modorator", function(request, response) {
  var userName = request.query.userName || 0;
  var gender = request.query.gender || 0;
  response.redirect("/application/modorator.html?userName=" + userName + "&gender=" + gender);
});



// ----------------- Event functions ---------------------------
// save participants data into JSON format 
app.get("/start-event",function(request, response) {
  //var participants = request.query.participantsIds;
  var event = 1;
  fs.writeFileSync('event.json', event, (err) => {
    if (err) throw err;
    console.log('event start file written');
  });
});

// save participants data into JSON format 
app.get("/stop-event",function(request, response) {
  //var participants = request.query.participantsIds;
  var event = 0;
  fs.writeFileSync('event.json', event, (err) => {
    if (err) throw err;
    console.log('event stop file written');
    response.send("1");
  });
});

app.get("/check-event",function(request, response) {
  fs.readFile('event.json', (err, data) => {
    if (err) throw err;
    
  });
  response.send(data);
});


// ----------------- Participants functions ---------------------------

// save participants data into JSON format 
app.get("/save-participants",function(request, response) {
  //var participants = request.query.participantsIds;
  var rooms = request.query.rooms;
  console.log(rooms);
  fs.writeFileSync('rooms.json', rooms, (err) => {
    if (err) throw err;
    console.log('Data written to file');
    
  });
  response.send("1");
});

app.get("/load-participants",function(request, response) {
  var dataSend;
  fs.readFile('rooms.json', (err, data) => {
    if (err) throw err;
    response.send(new Buffer(data));
    
  });
});


app.get("/profile",function(request, response) {
  var id = request.query.id;
  var sql = "SELECT * FROM speedate.responder_users where id=" + id;
  con.query(sql , function (err, result) {
    if (err) throw err;
    response.send(result[0]);
  });
});




// ----------------- common functions ---------------------------


/**
 * Generate an Access Token for a chat application user - it generates a random
 * username for the client requesting a token, and takes a device ID as a query
 * parameter.
 */
app.get("/token", function(request, response) {
  var modorator = request.query.modorator || 0;
  var userName = request.query.userName || "";
  var gender = request.query.gender || "";
  var id = request.query.id || "";

  var time = new Date().getTime();
  var identity = userName + "#" + gender + "#" + modorator + "#" + id;

  // Create an access token which we will sign and return to the client,
  // containing the grant we just created.
  var token = new AccessToken(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_API_KEY,
    process.env.TWILIO_API_SECRET,
    { ttl: MAX_ALLOWED_SESSION_DURATION }
  );

  // Assign the generated identity to the token.
  token.identity = identity;

  // Grant the access token Twilio Video capabilities.
  var grant = new VideoGrant();
  token.addGrant(grant);

  // Serialize the token to a JWT string and include it in a JSON response.
  response.send({
    identity: identity,
    modorator: modorator,
    userName: userName,
    gender: gender,
    token: token.toJwt()
  });
});

// Create http server and run it.
var server = http.createServer(app);
var port = process.env.PORT || 3000;
server.listen(port, function() {
  console.log("Express server running on *:" + port);
});
var io  = require('socket.io').listen(server);


io.on('connection', function(socket){
  console.log('a user connected');
  socket.on('disconnect', function(){
    console.log('user disconnected');
  });

  socket.on('chat message', function(msg){
    //console.log('message: ' + msg);
    io.emit('chat message', msg);
  });

  socket.on('start meeting', function(msg){
    //console.log('message: ' + msg);
    io.emit('start meeting', msg);
  });  

  socket.on('ClientTimer', function(msg){
    //console.log('message: ' + msg);
    io.emit('ClientTimer', msg);
  });  

  socket.on('buzzer', function(msg){
    //console.log('message: ' + msg);
    io.emit('buzzer', msg);
  });  

  socket.on('backToLobby', function(msg){
    //console.log('message: ' + msg);
    io.emit('backToLobby', msg);
  });  




});
