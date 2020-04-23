"use strict";

var Video = require("twilio-video");

var activeRoom;
var previewTracks;
var identity;
var roomName;
var roomId;
var userName;
var id;
var gender;
var url;
var r; // current Round/Table
var roomType
var otherUserId;
var remarkId;
var systemEventId;

//var noSleep = new NoSleep();


toastr.options.showMethod = 'slideDown';
toastr.options.hideMethod = 'slideUp';
toastr.options.closeMethod = 'slideUp';
toastr.options.closeButton = true;
toastr.options.tapToDismiss = false;



systemEventId = getUrlParam("eventId");

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
  //clearRoom()  
  let selfContainer = document.createElement("div");
  selfContainer.id = `participantContainer-${participant.identity}`;

  container.appendChild(selfContainer);
  var identityAry = participant.identity.split("#");
  appendName(identityAry[0], selfContainer);
  if(identityAry[2] !='1')
    loadProfile(identityAry[3])

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

// -------------------------------------------------------------------- CONNECT   -------------------------------------------------------------------- 

function connect() {
    $.getJSON(url, function(data) {
      identity = data.identity;
    // document.getElementById("room-controls").style.display = "block";

      // Bind button to join Room.
      
 
        roomName = "Room" + r;
 
        log("Joining room '" + roomName + "'...");
        var connectOptions = {
          name: roomName,
          logLevel: "debug",
          type : 'small-group',
          audio : true,
          video:{width:600}
          
        };


        // Join the Room with the token from the server and the
        // LocalParticipant's Tracks.
        Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
          log("Could not connect to Twilio: " + error.message);
        });
    
      // Bind button to leave Room.
    
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

  // Attach LocalParticipant's Tracks, if not already attached.
   attachTracks(getTracks(room.localParticipant), remoteMediaContainer);

  
  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    otherUserId = identityAry[3]; 
      participantConnected(participant, modorateMediaContainer);
      loadProfile(otherUserId);
      loadRemark(otherUserId);
    
  });

  // When a Participant joins the Room, log the event.
  room.on("participantConnected", function(participant) {
    log("Joining: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    otherUserId = identityAry[3]; 
      participantConnected(participant, modorateMediaContainer);
      loadProfile(otherUserId);
      loadRemark(otherUserId);
   
   
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
  userName = getUrlParam("userName");
  gender = getUrlParam("gender");
  id = getUrlParam("id");
  r = getUrlParam("r");
  roomId = getUrlParam("room_id");

  if(gender=='m') {
    document.querySelector("#txtLobbyMessage").innerText = decodeURI(userName) + ", " + "הנך נמצא בחדר מספר " + r
  }
  else {
    document.querySelector("#txtLobbyMessage").innerText = decodeURI(userName) + ", " +  "הנך נמצאת בחדר מספר " + r
  }



  //enableNoSleep();

  url = "/token?1=1&userName=" + userName + "&gender=" + gender + "&id=" + id;

  connect();
  //clearRoom();
  myLocationNow();

  // update table number

  // if(typeof(r) !="undefined" && r!=null) {
  //   document.querySelector("#tableNumber").innerText = "שולחן מספר " + r;
  // }

  //$("#txtUserName").text( decodeURI(userName));
  // ------------------ All participants functions ----------------------------


  socket.on('ClientTimer', function(msg){
    if(typeof(document.querySelector("#countdowntimer")) != 'undefined' && document.querySelector("#countdowntimer") != null) {
      document.querySelector("#countdowntimer").innerHTML=msg;
    }
  });

  socket.on('broadcastMessage', function(msg){
    
    toastr.warning(msg,{timeOut: 5000})
  });

  socket.on('buzzer', function(msg){
    beep();
  });

  socket.on('EndOfMeeting', function(msg){
    document.location.href='/thanks';
  });

  // this event fires 30 sec before room is about to change and it will erase participant other side video & audio
  socket.on('clearParticipantWindow', function(msg){
    document.querySelector("#modorate-media").innerHTML="";
    //loadProfileImage(otherUserId);
  });
    


if(saveRemark != null) {
    saveRemark.onclick = function() {
        var remark = document.querySelector("#messageTxt").value
        remarkId = parseInt(remarkId);
        if (isNaN(remarkId)) {remarkId=0}
        $.get( "/save-rem?id=" + id + "&user_id=" + otherUserId + "&remark=" + remark + '&remark_id=' + remarkId)
        .done(function(data) {
          if (data) {
            remarkId = data.result
            toastr.warning("ההערה נשמרה",{timeOut: 5000})
            document.querySelector("#messageTxt").value = ""

          }
        }) 
    };
  }

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
  
  function loadRemark(otherUserId){ 
    $.get( "/read-rem?id=" + id + "&user_id=" + otherUserId )
    .done(function(data) {
      if (data) {
        remarkId = data.remarkId
      }
    }) 
  }



  function loadProfileImage(id) {
    return false;
    $.get( "/profileImage?id=" + id)
    .done(function(data) {
      var img = document.createElement('img');
      img.src = "http://www.speedateisrael.co.il/profile-pictures/" + data.file_name;
      img.style.width="600px";
      document.querySelector("#modorate-media").appendChild(img);
    })
  }
  


  function loadProfile(id) {

    $.get( "/profile?id=" + id)
      .done(function( data ) {

        document.querySelector("#profileContents").innerHTML = data;

      
      });
  }

function clearRoom() {
   if(document.querySelector("profileContents") != null)
      document.querySelector("profileContents").innerHTML = ""
  if(document.querySelector("modorator-media") !=null ) 
     document.querySelector("modorator-media").innerHTML=""
}

function myLocationNow() {
  var intervalLocation = setInterval(function() {
    $.get( "/myLocationNow?id=" + id + "&userName=" + userName +  "&gender=" + gender)
    .done(function(data) {
      if(decodeURI(document.location.href)!=decodeURI(data)) {
        document.location.href=data
      }
  })

  },5000)
}

function enableNoSleep() {
  noSleep.enable();
  document.removeEventListener('touchstart', enableNoSleep, false);
}

