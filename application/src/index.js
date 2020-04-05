"use strict";

var Video = require("twilio-video");
var meetingTime = new Date(new Date().getTime() + 90000 * 1);

var activeRoom;
var previewTracks;
var identity;
var roomName;
var modorator;
var userName;
var gender;
var url;
var urlMeeting;
var participantsIds=[];
var socket = io();
var meetingNumbar = 0;
var maxMeetings = 1;

modorator = getUrlParam("modorator") == "1" ? "modorator=1" : "";
userName = getUrlParam("userName");
gender = getUrlParam("gender");
url = "/token?1=1&" + modorator + "&userName=" + userName + "&gender=" + gender;
urlMeeting = "/mmetingroom?1=1&userName=" + userName + "&gender=" + gender;


const captureScreen = document.querySelector("button#capturescreen");
const screenPreview = document.querySelector("video#screenpreview");
const stopScreenCapture = document.querySelector("button#stopscreencapture");

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
  name.textContent = identity;
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


$.getJSON(url, function(data) {
  identity = data.identity;
  document.getElementById("room-controls").style.display = "block";

  // Bind button to join Room.
  document.getElementById("button-join").onclick = function() {
    roomName = document.getElementById("room-name").value;
    if (!roomName) {
      alert("Please enter a room name.");
      return;
    }

    log("Joining room '" + roomName + "'...");
    var connectOptions = {
      name: roomName,
      logLevel: "error"
    };

    if (previewTracks) {
      connectOptions.tracks = previewTracks;
    }

    // Join the Room with the token from the server and the
    // LocalParticipant's Tracks.
    Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
      log("Could not connect to Twilio: " + error.message);
    });
  };

  // Bind button to leave Room.
  document.getElementById("button-leave").onclick = function() {
    log("Leaving room...");
    activeRoom.disconnect();
  };
});

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

  log("Joined as '" + identity + "'");
  document.getElementById("button-join").style.display = "none";
  document.getElementById("button-leave").style.display = "block";

  // Attach LocalParticipant's Tracks, if not already attached.
  var previewContainer = document.getElementById("local-media");
  if (!previewContainer.querySelector("video")) {
    attachTracks(getTracks(room.localParticipant), previewContainer);
  }

  // Attach the Tracks of the Room's Participants.

  var remoteMediaContainer = document.getElementById("remote-media");
  var modorateMediaContainer = document.getElementById("modorate-media");
  room.participants.forEach(function(participant) {
    console.log(participant);
    log("Already in Room: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    if (identityAry[2] == "1") {
      participantConnected(participant, modorateMediaContainer);
    } else {
      participantConnected(participant, remoteMediaContainer);
    }
  });

  // When a Participant joins the Room, log the event.
  room.on("participantConnected", function(participant) {
    log("Joining: '" + participant.identity + "'");
    var identityAry = participant.identity.split("#");
    if (identityAry[2] == "1") {
      participantConnected(participant, modorateMediaContainer);
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
    document.getElementById("button-join").style.display = "block";
    document.getElementById("button-leave").style.display = "none";
  });
}

// Preview LocalParticipant's Tracks.
document.getElementById("button-preview").onclick = function() {
  var localTracksPromise = previewTracks
    ? Promise.resolve(previewTracks)
    : Video.createLocalTracks();

  localTracksPromise.then(
    function(tracks) {
      window.previewTracks = previewTracks = tracks;
      var previewContainer = document.getElementById("local-media");
      if (!previewContainer.querySelector("video")) {
        attachTracks(tracks, previewContainer);
      }
    },
    function(error) {
      console.error("Unable to access local media", error);
      log("Unable to access Camera and Microphone");
    }
  );
};

// Activity log.
function log(message) {
  var logDiv = document.getElementById("log");
  logDiv.innerHTML += "<p>&gt;&nbsp;" + message + "</p>";
  logDiv.scrollTop = logDiv.scrollHeight;
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
  var parts = window.location.href.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(
    m,
    key,
    value
  ) {
    vars[key] = value;
  });
  return vars;
}
function getUrlParam(parameter, defaultvalue) {
  var urlparameter = defaultvalue;
  if (window.location.href.indexOf(parameter) > -1) {
    urlparameter = getUrlVars()[parameter];
  }
  return urlparameter;
}

/**
 * Create a LocalVideoTrack for your screen. You can then share it
 * with other Participants in the Room.
 * @param {number} height - Desired vertical resolution in pixels
 * @param {number} width - Desired horizontal resolution in pixels
 * @returns {Promise<LocalVideoTrack>}
 */
function createScreenTrack(height, width) {
  if (
    typeof navigator === "undefined" ||
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getDisplayMedia
  ) {
    return Promise.reject(new Error("getDisplayMedia is not supported"));
  }
  return navigator.mediaDevices
    .getDisplayMedia({
      video: {
        height: height,
        width: width
      }
    })
    .then(function(stream) {
      var screenTrack = stream.getVideoTracks()[0];
      activeRoom.localParticipant.publishTrack(screenTrack);
      return new Video.LocalVideoTrack(screenTrack);
    });
}

// exports.createScreenTrack = createScreenTrack;

(async function() {
  // Load the code snippet.

  // Hide the "Stop Capture Screen" button.
  stopScreenCapture.style.display = "none";

  // The LocalVideoTrack for your screen.
  let screenTrack;

  captureScreen.onclick = async function() {
    try {
      // Create and preview your local screen.
      screenTrack = await createScreenTrack(720, 1280);
      screenTrack.attach(screenPreview);
      // Show the "Capture Screen" button after screen capture stops.
      screenTrack.on("stopped", toggleButtons);
      // Show the "Stop Capture Screen" button.
      toggleButtons();
    } catch (e) {
      alert(e.message);
    }
  };

  stopScreenCapture.onclick = function() {
    // Stop capturing your screen.
    screenTrack.stop();
  };
})();

function toggleButtons() {
  captureScreen.style.display =
    captureScreen.style.display === "none" ? "" : "none";
  stopScreenCapture.style.display =
    stopScreenCapture.style.display === "none" ? "" : "none";
}




function beep() {
    var snd = new Audio("data:audio/wav;base64,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qJrx4KOQjahZxWbcZgztj2c49nKmkId44S71j0c8eV9yDK6uPRzx5X18eDvjvQ6yKo9ZSS6l//8elePK/Lf//IInrOF/FvDoADYAGBMGb7FtErm5MXMlmPAJQVgWta7Zx2go+8xJ0UiCb8LHHdftWyLJE0QIAIsI+UbXu67dZMjmgDGCGl1H+vpF4NSDckSIkk7Vd+sxEhBQMRU8j/12UIRhzSaUdQ+rQU5kGeFxm+hb1oh6pWWmv3uvmReDl0UnvtapVaIzo1jZbf/pD6ElLqSX+rUmOQNpJFa/r+sa4e/pBlAABoAAAAA3CUgShLdGIxsY7AUABPRrgCABdDuQ5GC7DqPQCgbbJUAoRSUj+NIEig0YfyWUho1VBBBA//uQZB4ABZx5zfMakeAAAAmwAAAAF5F3P0w9GtAAACfAAAAAwLhMDmAYWMgVEG1U0FIGCBgXBXAtfMH10000EEEEEECUBYln03TTTdNBDZopopYvrTTdNa325mImNg3TTPV9q3pmY0xoO6bv3r00y+IDGid/9aaaZTGMuj9mpu9Mpio1dXrr5HERTZSmqU36A3CumzN/9Robv/Xx4v9ijkSRSNLQhAWumap82WRSBUqXStV/YcS+XVLnSS+WLDroqArFkMEsAS+eWmrUzrO0oEmE40RlMZ5+ODIkAyKAGUwZ3mVKmcamcJnMW26MRPgUw6j+LkhyHGVGYjSUUKNpuJUQoOIAyDvEyG8S5yfK6dhZc0Tx1KI/gviKL6qvvFs1+bWtaz58uUNnryq6kt5RzOCkPWlVqVX2a/EEBUdU1KrXLf40GoiiFXK///qpoiDXrOgqDR38JB0bw7SoL+ZB9o1RCkQjQ2CBYZKd/+VJxZRRZlqSkKiws0WFxUyCwsKiMy7hUVFhIaCrNQsKkTIsLivwKKigsj8XYlwt/WKi2N4d//uQRCSAAjURNIHpMZBGYiaQPSYyAAABLAAAAAAAACWAAAAApUF/Mg+0aohSIRobBAsMlO//Kk4soosy1JSFRYWaLC4qZBYWFRGZdwqKiwkNBVmoWFSJkWFxX4FFRQWR+LsS4W/rFRb/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////VEFHAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAU291bmRib3kuZGUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAMjAwNGh0dHA6Ly93d3cuc291bmRib3kuZGUAAAAAAAAAACU=");  
    //var play = snd.play();
}

/// chat functions


$(function () {
 

  // ------------------ All participants functions ----------------------------
  $('#chatform').submit(function(e){
    e.preventDefault(); // prevents page reloading
    socket.emit('chat message', $('#messageTxt').val());
    $('#messageTxt').val('');
    return false;
  });

  // Add chat line from everyone (include me) when event occur
  socket.on('chat message', function(msg){
    $('#messages').append($('<li>').text(msg));
  });

  // Redirect to meeting room when event occur
  socket.on('start meeting', function(msg){
    document.location.href=urlMeeting;
    
  });

  // ------------------------ User functions ---------------------------------
  $( "#button-load-participant" ).click(function() {
    participantsIds=[];
    // activeRoom.participants.forEach(function(participant) {
    //   participantsIds.push(participant.identity);
    // });
    $.get( "/load-participants")
      .done(function( data ) {
        alert( "Data Loaded: " + data );
        
      });
  });

  socket.on('timer', function(msg){
    $("#countdowntimer").HTML(minutes + ":" + seconds );
  });


  // ---------------------    Modorator functions ----------------------------

  
  // - start conversation - open lobby
  $( "#startConversation" ).click(function() {
    $.get('/start-event')
    .done(function(){
      alert( "Event started - Lobby is open" );
    })
  });


// -- send participants to private meeting rooms
  $( "#button-start-meeting" ).click(function() {
    participantsIds=[];
    
    activeRoom.participants.forEach(function(participant) {
       participantsIds.push(participant.identity);
       var data = JSON.stringify(participantsIds);
    });
    $.get( "/save-participants", { participantsIds:data })
      .done(function( data ) {
        alert( "Data Loaded: " + data );
        meetingNumbar++;
        socket.emit('start meeting', meetingNumbar);
        startTimer();
      });
  });
});

// --- share screen
$( "#stopConversation" ).click(function() {
  createScreenTrack();
})




// -- disconnect all
$( "#stopConversation" ).click(function() {
  doDisconnect('Lobby');
})




// disconnect eveybody from the room
function doDisconnect(room) {
  room.participants.forEach(remoteParticipant => {
    remoteParticipant.disconnect()
  })
  room.disconnect()
}

/// This is the timer of the meeting

function startTimer() {
  var x = setInterval(function() {

    // Get today's date and time
    var now = new Date().getTime();

    // Find the distance between now and the count down date
    var distance = meetingTime - now;

    // Time calculations for days, hours, minutes and seconds
    var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    // Display the result in the element with id="demo"
    document.getElementById("countdowntimerModorator").innerHTML = minutes + ":" + seconds ;
    socket.emit('timer', minutes + ":" + seconds);

    // If the count down is finished, write some text
    if (distance < 60000 ) {
      beep()
    }

    if (distance < 1000) {
      clearInterval(x);
    }


  }, 1000);
}