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
var r; // current room
var roomType
var otherUserId;
var remarkId;
var audioExist;

userName = getUrlParam("userName");
gender = getUrlParam("gender");
id = getUrlParam("id");
r = getUrlParam("r");

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


url = "/token?1=1&userName=" + userName + "&gender=" + gender + "&id=" + id;

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

function appendProfileElement(elementIdentity,elementContent, container) {
  const name = document.createElement("div");
  name.id = `profile-${elementIdentity}`;
  name.className = "text";
  name.textContent = elementContent;
  container.appendChild(name);
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


function connect() {
    $.getJSON(url, function(data) {
      identity = data.identity;
    // document.getElementById("room-controls").style.display = "block";

      // Bind button to join Room.
      
        if(r !=null) {
            roomName = "Room" + r;
            roomType = "small-group";
            audioExist = true;
            

        }
        else {
            roomName = "Lobby";
            roomType = "group";
            audioExist = false;
            
        }

        log("Joining room '" + roomName + "'...");
        var connectOptions = {
          name: roomName,
          logLevel: "error",
          type : roomType,
          audio : audioExist,
          video : { width: 200 }
          
        };

        if (previewTracks) {
          connectOptions.tracks = previewTracks;
        }

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
  
  room.participants.forEach(function(participant) {
    log("Already in Room: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    otherUserId = identityAry[3]; 
    if (identityAry[2] == "1" || r !=null) {
      participantConnected(participant, modorateMediaContainer);
    } else {
      participantConnected(participant, remoteMediaContainer);
      loadProfile(otherUserId);
      loadRemark(otherUserId);
    }
  });

  // When a Participant joins the Room, log the event.
  room.on("participantConnected", function(participant) {
    log("Joining: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    otherUserId = identityAry[3]; 
    if (identityAry[2] == "1" || r !=null) {
      participantConnected(participant, modorateMediaContainer);
    } else {
      participantConnected(participant, remoteMediaContainer);
      if(parseInt(otherUserId) > 0) {
        loadProfile(otherUserId);
        loadRemark(otherUserId);
      }

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



//  Document.ready init
$(function () {

  if(r !=null) {
    connect()
  }

  $("#btnConnect" ).click(function() {
    connect();
    document.querySelector("#startConversation").innerText = "מחובר";
  });

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
    //$("#countdowntimer".text(msg));
    document.querySelector("#countdowntimer").textContent=msg;
  });

  socket.on('buzzer', function(msg){
    beep();
  });``

  socket.on('EndOfMeeting', function(msg){
    document.location.href='/thanks';
  });

  // this event fires 30 sec before room is about to change and it will erase participant other side video & audio
  socket.on('clearParticipantWindow', function(msg){
    document.querySelector("#modorate-media").innerHTML="";
  });
  
  // this event fires when moderator is change and it will erase moderator video & audio
  socket.on('takeControl', function(msg){
    if(roomName == 'Lobby') {
      document.querySelector("#modorate-media").innerHTML="";
    }
  });
  
  socket.on("unsharescreen", function(msg) {
    document.querySelector("#participantContainer-Modorator\\#undefined\\#1\\# > video:nth-child(4)").style.display = "none";
  });


  socket.on('start meeting', function(msg){
    
    $.get( "/load-participants")
    .done(function( data ) {
        var roomNumber = 0;  
        var roundNumber = msg;
        var loadedPar = JSON.parse(data);
        var thisRound = loadedPar[parseInt(roundNumber) - 1]
        if(gender == 'm') {
            var i = 1
            thisRound.mens.forEach(id => {
                if(id.includes(decodeURI(userName))) {
                    let ii=i;
                    roomNumber = ii;
                }
                i++;
            })
        }
        else {
            var i = 1
            thisRound.females.forEach(id => {
                if(id.includes(decodeURI(userName))) {
                    let ii=i;
                    roomNumber = ii;
                }
                i++;
            })
        }
        room.disconnect()
        document.location.href='/room?r=' + roomNumber + "&userName=" + userName +  "&gender=" + gender + "&id=" + id;
    });
});

socket.on('backToLobby', function(msg){
    document.location.href="/application/lobby.html?userName=" + userName +  "&gender=" + gender + "&id=" + id;
  });



  saveRemark.onclick = function() {
      var remark = document.querySelector("#messageTxt").value
      remarkId = parseInt(remarkId);
      if (isNaN(remarkId)) {remarkId=0}
      $.get( "/save-rem?id=" + id + "&user_id=" + otherUserId + "&remark=" + remark + '&remark_id=' + remarkId)
      .done(function(data) {
        if (data) {
          remarkId = data.result
        }
      }) 
  };


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

  function loadProfile(id) {

    $.get( "/profile?id=" + id)
      .done(function( data ) {
        var i = 1;
        var profileContents = document.getElementById("profileContents");
        if(data.bearth_year_public == '1') {
          appendProfileElement(i,'',profileContents);
          var row = document.getElementById("profile-" + i);
          appendProfileElement('birthYearLabel','שנת לידה',row)
          appendProfileElement('birthYearLabel', data.bearth_year,row)
        }
        i++;

        if(data.relationship_public == '1') {
          appendProfileElement(i,'',profileContents)
          var row = document.getElementById("profile-" + i);
          appendProfileElement('birthYearLabel','מצב משפחתי',row)
          appendProfileElement('birthYearLabel', data.relationship,row)
        }i++;

        if(data.height_public == '1') {
          appendProfileElement(i,'',profileContents)
          var row = document.getElementById("profile-" + i);
          appendProfileElement('birthYearLabel','גובה',row)
          appendProfileElement('birthYearLabel', data.height,row)
        }i++;

        if(data.has_kids_public == '1') {
          appendProfileElement(i,'',profileContents)
          var row = document.getElementById("profile-" + i);
          appendProfileElement('birthYearLabel','ילדים',row)
          appendProfileElement('birthYearLabel', data.has_kids,row)
        }i++;

        if(data.education_public == '1') {
          appendProfileElement(i,'',profileContents)
          var row = document.getElementById("profile-" + i);
          appendProfileElement('birthYearLabel','השכלה',row)
          appendProfileElement('birthYearLabel', data.education,row)
        }i++;

        if(data.proffesion_public == '1') {
          appendProfileElement(i,'',profileContents)
          var row = document.getElementById("profile-" + i);
          appendProfileElement('birthYearLabel','עיסוק',row)
          appendProfileElement('birthYearLabel', data.proffesion,row)
        }i++;

        if(data.smoke_public == '1') {
          appendProfileElement(i,'',profileContents)
          var row = document.getElementById("profile-" + i);
          appendProfileElement('birthYearLabel','מעשן/ת',row)
          appendProfileElement('birthYearLabel', data.smoke,row)
        }i++;
        
      });
  }

  function makeid(length) {
    var result           = '';
    var characters       = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    var charactersLength = characters.length;
    for ( var i = 0; i < length; i++ ) {
       result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result;
 }


 // Preview LocalParticipant's Tracks.
document.getElementById('button-preview').onclick = function() {
  var localTracksPromise = previewTracks
    ? Promise.resolve(previewTracks)
    : Video.createLocalTracks({
      audio: true,
      video: { width: 100 },
    });

  localTracksPromise.then(function(tracks) {
      window.previewTracks = previewTracks = tracks;
      var previewContainer = document.getElementById('my-preview-video');
      if (!previewContainer.querySelector('video')) {
        attachTracks(tracks, previewContainer);
      }
    },function(error) {
      console.error('Unable to access local media', error);
      log('Unable to access Camera and Microphone');
    }
  );
};

//document.querySelector("#participantContainer-Modorator\\#undefined\\#1\\# > video").style.display = "none"
//document.querySelector("#participantContainer-Modorator\\#undefined\\#1\\# > video:nth-child(4)").style.width="640px"
  





