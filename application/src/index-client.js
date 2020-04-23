"use strict";

var Video = require("twilio-video");

var activeRoom;
var previewTracks;
var identity;
var roomName;
var userName;
var id;
var gender;
var url;
var r; // current Round/Table
var roomType
var otherUserId;
var remarkId;
var audioExist;
var intervalChecker;
var systemEventId;
var profileExist = 0;

//var noSleep = new NoSleep();




var saveRemark = document.getElementById("saveRemark");

if (typeof userName === 'string' || userName instanceof String) {
    setCookie("userName",userName,1);
}
if (typeof gender === 'string' || gender instanceof String) {
    setCookie("gender",gender,1);
}
if (typeof id === 'string' || id instanceof String) {
    setCookie("id",id,1);
}

if (typeof r === 'string' || r instanceof String) {
    setCookie("r",r,1);
}




// Attach the Track to the DOM.
function attachTrack(track, container) {
  container.appendChild(track.attach());
}

// Attach array of Tracks to the DOM. <change>
function attachTracks(tracks, container) {
  tracks.forEach(function(track) {
    attachTrack(track, container);
  });
}

// Detach given track from the DOM.
function detachTrack(track) {
  track.detach().forEach(function(element) {
    element.remove();
  });
}

// Appends remoteParticipant name to the DOM.
function appendName(identity, container) {
  const name = document.createElement("p");
  name.id = `participantName-${identity}`;
  name.className = "instructions";
  if(identity!="modorator") {
    name.textContent = identity;
    container.appendChild(name);
  }
}

function appendProfileElement(elementIdentity,elementContent, container, useClass) {
  const name = document.createElement("div");
  name.id = `profile-${elementIdentity}`;
  name.className = useClass;
  name.textContent = elementContent;
  if(typeof container != 'undefined' && container != null  ) {
    container.appendChild(name);
  }
}

// Removes remoteParticipant container from the DOM.
function removeName(participant) {
  if (participant) {
    let { identity } = participant;
    const container = document.getElementById(
      `participantContainer-${identity}`
    );
    container.parentNode.removeChild(container);
  }
}

// A new RemoteTrack was published to the Room.
function trackPublished(publication, container) {
  if (publication.isSubscribed) {
    attachTrack(publication.track, container);
  }
  publication.on("subscribed", function(track) {
    log("Subscribed to " + publication.kind + " track");
    attachTrack(track, container);
  });
  publication.on("unsubscribed", detachTrack);
}

// A RemoteTrack was unpublished from the Room.
function trackUnpublished(publication) {
  log(publication.kind + " track was unpublished.");
}

// A new RemoteParticipant joined the Room
function participantConnected(participant, container) {
  let selfContainer = document.createElement("div");
  selfContainer.id = `participantContainer-${participant.identity}`;

  container.appendChild(selfContainer);
  var identityAry = participant.identity.split("#");
  appendName(identityAry[0], selfContainer);
  
  participant.tracks.forEach(function(publication) {
    trackPublished(publication, selfContainer);
  });
  participant.on("trackPublished", function(publication) {
    trackPublished(publication, selfContainer);
  });
  participant.on("trackUnpublished", trackUnpublished);
}

// Detach the Participant's Tracks from the DOM.
function detachParticipantTracks(participant) {
  var tracks = getTracks(participant);
  tracks.forEach(detachTrack);
}

// When we are about to transition away from this page, disconnect
// from the room, if joined.
window.addEventListener("beforeunload", leaveRoomIfJoined);

// Obtain a token from the server in order to connect to the Room.


function connect() {
    $.getJSON(url, function(data) {
      identity = data.identity;
    // document.getElementById("room-controls").style.display = "block";

      // Bind button to join Room.

      var connectOptions;
      
        if(r !=null) {
          connectOptions = {
            name:  "Room" + r,
            logLevel: "error",
            type : "small-group",
          };
  
        }
        else {
          connectOptions = {
            name:  "Lobby" ,
            logLevel: "error",
            type : "group",
            audio : true,
            video : {width:600},
          };
        }

        log("Joining room '" + connectOptions.name + "'...");
     
        // Join the Room with the token from the server and the
        // LocalParticipant's Tracks.
        Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
          log("Could not connect to Twilio: " + error.message);
        });
    });
}

// Get the Participant's Tracks.
function getTracks(participant) {
  return Array.from(participant.tracks.values())
    .filter(function(publication) {
      return publication.track;
    })
    .map(function(publication) {
      return publication.track;
    });
}

// Successfully connected!
function roomJoined(room) {
  window.room = activeRoom = room;


  // Attach the Tracks of the Room's Participants.

  var remoteMediaContainer = document.getElementById("remote-media");
  var modorateMediaContainer = document.getElementById("modorate-media");
  var presentorMediaContainer = document.getElementById("modorate-media");

  // Attach LocalParticipant's Tracks, if not already attached.
   attachTracks(getTracks(room.localParticipant), remoteMediaContainer);

  
  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    otherUserId = identityAry[3]; 
    if (identityAry[2] == "1" ) {
      participantConnected(participant, modorateMediaContainer);
    } else if (identityAry[2] == "2" ) {
      participantConnected(participant, presentorMediaContainer);
    } else {
      participantConnected(participant, remoteMediaContainer);
    }
    
  });

  // When a Participant joins the Room, log the event.
  room.on("participantConnected", function(participant) {
    log("Joining: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    otherUserId = identityAry[3]; 
    if (identityAry[2] == "1" ) {
      participantConnected(participant, modorateMediaContainer);
    } else if (identityAry[2] == "2" ) {
      participantConnected(participant, presentorMediaContainer);
    } else {
      participantConnected(participant, remoteMediaContainer);
    }
  });

  // When a Participant leaves the Room, detach its Tracks.
  room.on("participantDisconnected", function(participant) {
    log("RemoteParticipant '" + participant.identity + "' left the room");
    detachParticipantTracks(participant);
    removeName(participant);
  });

  // Once the LocalParticipant leaves the room, detach the Tracks
  // of all Participants, including that of the LocalParticipant.
  room.on("disconnected", function() {
    log("Left");
    if (previewTracks) {
      previewTracks.forEach(function(track) {
        track.stop();
      });
      previewTracks = null;
    }
    detachParticipantTracks(room.localParticipant);
    room.participants.forEach(detachParticipantTracks);
    room.participants.forEach(removeName);
    activeRoom = null;
    //$("#button-join").style.display = "block";
    //$("$button-leave").style.display = "none";
  });
}


// Activity log.
function log(message) {
  console.log(message);
}

// Leave Room.
function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
  }
}

/// helpers functions
function getUrlVars() {
  var vars = {};
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m, key, value  ) {
    vars[key] = value;
  });
  return vars;
}


function getUrlParam(parameter, defaultvalue) {
  var urlparameter = defaultvalue;
  if (window.location.href.indexOf(parameter) > -1) {
    urlparameter = getUrlVars()[parameter];
  }
  return urlparameter || null;
}



function beep() {
    var audio = document.getElementById("audio");
    audio.play();
}



//  --------------------------------------------------------------------------- Document.ready init ---------------------------------
//  --------------------------------------------------------------------------- Document.ready init----------------------------------
//  --------------------------------------------------------------------------- Document.ready init -----------------------------------
$(function () {


  enableNoSleep();
  userName = getUrlParam("userName");
  gender = getUrlParam("gender");
  id = getUrlParam("id");
  r = getUrlParam("r");
  systemEventId = getUrlParam("eventId");

  if(gender=='m') {
    document.querySelector("#txtLobbyMessage").innerText = "הנך נמצא בלובי"
  }
  else {
    document.querySelector("#txtLobbyMessage").innerText = "הנך נמצאת בלובי"
  }

  url = "/token?1=1&userName=" + userName + "&gender=" + gender + "&id=" + id;

  connect()
  checkPresentation();
  myLocationNow(id,userName,gender)

  $("#txtUserName").text( decodeURI(userName));
  // ------------------ All participants functions ----------------------------
  $('#chatform').submit(function(e){
    e.preventDefault(); // prevents page reloading
    socket.emit('chat message', decodeURI(userName) + ": " + $('#messageTxt').val());
    $('#messageTxt').val('');
    return false;
  });

  // Add chat line from everyone (include me) when event occur
  socket.on('chat message', function(msg){
    $('#messages').append($('<li>').text(msg));
  });

  socket.on('ClientTimer', function(msg){
    if(typeof(document.querySelector("#countdowntimer")) != 'undefined' && document.querySelector("#countdowntimer") != null) {
      document.querySelector("#countdowntimer").innerHTML=msg;
    }
  });

  socket.on('presentorConnect', function(msg){
    document.querySelector("#modorate-media").style.display = "none"
  })

  socket.on('modoratorConnect', function(msg){
    document.querySelector("#presentor-media").style.display = "none"
  })


  socket.on('broadcastMessage', function(msg){
    toastr.options.showMethod = 'slideDown';
    toastr.options.hideMethod = 'slideUp';
    toastr.options.closeMethod = 'slideUp';
    toastr.options.closeButton = true;
    toastr.options.tapToDismiss = false;
    
    
    toastr.warning(msg,{timeOut: 5000})
  });

  socket.on('startPesentation', function(msg){
    // hide presentor
    document.querySelector("#participantContainer-Modorator\\#undefined\\#1\\#\\#1586726753363 > video:nth-child(2)")
    .style.position = "absolute";
    document.querySelector("#participantContainer-Modorator\\#undefined\\#1\\#\\#1586726753363 > video:nth-child(2)")
    .style.width = "150px";
    document.querySelector("#participantContainer-Modorator\\#undefined\\#1\\#\\#1586726753363 > video:nth-child(2)")
    .style.right = "30px";
    document.querySelector("#participantContainer-Modorator\\#undefined\\#1\\#\\#1586726753363 > video:nth-child(4)")
    .style.width = "820px";



    
  });

  
  socket.on('EndOfMeeting', function(msg){
    document.location.href='/thanks';
  });

  // this event fires 30 sec before room is about to change and it will erase participant other side video & audio
  // socket.on('clearParticipantWindow', function(msg){
  //   document.querySelector("#modorate-media").innerHTML="";
  //   loadProfileImage(otherUserId);
  // });
  
  // this event fires when moderator is change and it will erase moderator video & audio
  socket.on('takeControl', function(msg){
    if(roomName == 'Lobby') {
      document.querySelector("#modorate-media").innerHTML="";
    }
  });
  
  socket.on("unsharescreen", function(msg) {
    var presentation = document.querySelector("#modorate-media>div>video:nth-child(4)")
    var parent = document.querySelector("#modorate-media>div")
    parent.removeChild(presentation);
  });



/// --- end document ready
});

function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays*24*60*60*1000));
    var expires = "expires="+ d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
  }

  function getCookie(cname) {
    var name = cname + "=";
    var decodedCookie = decodeURIComponent(document.cookie);
    var ca = decodedCookie.split(';');
    for(var i = 0; i <ca.length; i++) {
      var c = ca[i];
      while (c.charAt(0) == ' ') {
        c = c.substring(1);
      }
      if (c.indexOf(name) == 0) {
        return c.substring(name.length, c.length);
      }
    }
    return "";
  } 
  
    
function checkPresentation() {
  intervalChecker = setInterval(function() {
    if(document.querySelector("#modorate-media>div>video:nth-child(4)")) {

      var manager = document.querySelector("#participantContainer-Modorator2\\#undefined\\#1\\# > video")
      if(typeof(manager) != 'undefined' && presentor != null) {
        manager.style.width = "150px";
        manager.style.position = "absolute";
        manager.style.right = "30px";
      }
      var presentor = document.querySelector("#modorate-media>div>video:nth-child(2)")
      if(typeof(presentor) != 'undefined' && presentor != null) {
          presentor.style.width = "150px";
          presentor.style.position = "absolute";
          presentor.style.right = "30px";
          document.querySelector("#modorate-media>div>video:nth-child(4)").style.width = "640px";
      }
      else {
        var presentor = document.querySelector("#modorate-media>div>video:nth-child(3)")
        if(typeof presentor != 'undefined'  && presentor != null) {
          presentor.style.width = "150px";
          presentor.style.position = "absolute";
          presentor.style.right = "30px";
          document.querySelector("#modorate-media>div>video:nth-child(4)").style.width = "640px";
        }
      }
    }
    else {
      var presentor = document.querySelector("#modorate-media>div>video:nth-child(2)")
      if(typeof(presentor) != 'undefined' && presentor != null) {
          presentor.style.width = "800px";
          presentor.style.position = "relative";
          presentor.style.right = "0px";
      }
      else {
        var presentor = document.querySelector("#modorate-media>div>video:nth-child(3)")
        if(typeof presentor != 'undefined' && presentor != null ) {
          presentor.style.width = "800px";
          presentor.style.position = "relative";
          presentor.style.right = "0px";
        }
      }      
    }

  },1000);
}


function myLocationNow(id,userName,gender) {
  var intervalLocation = setInterval(function() {
    $.get( "/myLocationNow?id=" + id + "&userName=" + userName +  "&gender=" + gender)
    .done(function(data) {
      if(decodeURI(document.location.href)!=decodeURI(data)) {
        // leaveRoomIfJoined();
        document.location.href=data 
        
      }
  
    })

  },1000)
}

function enableNoSleep() {
  noSleep.enable();
  document.removeEventListener('touchstart', enableNoSleep, false);
}









