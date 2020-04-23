"use strict";

var Video = require("twilio-video");

var meetingTime;

var activeRoom;
var previewTracks;
var identity;
var roomName;
var modorator;
var presentor;

var userName;
var gender;
var url;
var urlMeeting;
var participantsIds=[];
var meetingNumber = 0;
var maxMeetings = 1;
var rooms = [];
var mensList = [];
var womensList = [];
var lastSeconds;
var meetingDuration = 60000; 
var meetingInterval;


modorator = getUrlParam("modorator") == "1" ? "modorator=1" : "";
presentor = getUrlParam("presentor") == "1" ? "presentor=1" : "";
userName = getUrlParam("userName");
gender = getUrlParam("gender");
url = "/token?1=1&" + modorator + "&userName=" + userName + "&gender=" + gender + "&" + presentor;
urlMeeting = "/mmetingroom?1=1&userName=" + userName + "&gender=" + gender;


const captureScreen = document.querySelector("button#capturescreen");
const screenPreview = document.querySelector("video#screenpreview");
const stopScreenCapture = document.querySelector("button#stopScreenCapture");

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
function connect() {

  socket.emit("resetMeeteing");
  $.getJSON(url, function(data) {
    socket.emit("takeControl",userName);
    identity = data.identity;
 
    // Bind button to join Room.
    
      roomName = "Lobby"

      log("Joining room '" + roomName + "'...");
      var connectOptions = {
        name: roomName,
        logLevel: "error",
        video:{width:600},
        audio:true

      };

      if (previewTracks) {
        connectOptions.tracks = previewTracks;
      }

      // Join the Room with the token from the server and the
      // LocalParticipant's Tracks.
      Video.connect(data.token, connectOptions).then(roomJoined, function(error) {
        log("Could not connect to Twilio: " + error.message);
      });
  });
};

  
 

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
  document.getElementById("startConversation").style.display = "none";
  document.getElementById("stopConversation").style.display = "block";

  // Attach LocalParticipant's Tracks, if not already attached.
  // var previewContainer = document.getElementById("local-media");
  // if (!previewContainer.querySelector("video")) {
  //   attachTracks(getTracks(room.localParticipant), previewContainer);
  // }

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
    //document.getElementById("button-join").style.display = "block";
    //document.getElementById("button-leave").style.display = "none";
  });
}

// Activity log.
function log(message) {
  console.log(message);
  // var logDiv = document.getElementById("log");
  // logDiv.innerHTML += "<p>&gt;&nbsp;" + message + "</p>";
  // logDiv.scrollTop = logDiv.scrollHeight;
}

// Leave Room.
function leaveRoomIfJoined() {
  if (activeRoom) {
    activeRoom.disconnect();
  }
}

function getUrlParam(parameter, defaultvalue) {
  var urlparameter = defaultvalue;
  if (window.location.href.indexOf(parameter) > -1) {
    urlparameter = getUrlVars()[parameter];
  }
  return urlparameter;
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
        width: width,
        id : 'screenshare'
      }
    })
    .then(function(stream) {
      var screenTrack = stream.getVideoTracks()[0];
      activeRoom.localParticipant.publishTrack(screenTrack);
      return new Video.LocalVideoTrack(screenTrack);
    });
}


(async function() {
  // Load the code snippet.

  // Hide the "Stop Capture Screen" button.
  //stopScreenCapture.style.display = "none";

  // The LocalVideoTrack for your screen.
  let screenTrack;

  captureScreen.onclick = async function() {
    try {
      // Create and preview your local screen.
      
      screenTrack = await createScreenTrack("800px", "600px");
      screenTrack.attach(screenPreview);
      socket.emit("startPesentation","1");
      // Show the "Capture Screen" button after screen capture stops.
      screenTrack.on("stopped", toggleButtons);
      // Show the "Stop Capture Screen" button.
      //toggleButtons();
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
  // captureScreen.style.display =
  //   captureScreen.style.display === "none" ? "" : "none";
  // stopScreenCapture.style.display =
  //   stopScreenCapture.style.display === "none" ? "" : "none";
  socket.emit("unsharescreen","");
}




// document ready init ----------------------------------------*********************************************------------------------------------------------------------
// document ready init ----------------------------------------*********************************************------------------------------------------------------------
// document ready init ----------------------------------------*********************************************------------------------------------------------------------



$(function () {

  previewMyself();
  connect();

 

  if(modorator!="") {
    socket.emit("modoratorConnect");
  }

  if(presentor!="") {
    socket.emit("presentorConnect");
  }


 
  // ------------------ All participants functions ----------------------------
  $('#chatform').submit(function(e){
    e.preventDefault(); // prevents page reloading
    socket.emit('chat message', "מנחה: " + $('#messageTxt').val());
    $('#messageTxt').val('');
    return false;
  });

  // Add chat line from everyone (include me) when event occur
  
  // ---------------------    Modorator functions ----------------------------

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

  $("#buttonBreak" ).click(function() {
    socket.emit("backToLobby","1");
    // var highestTimeoutId = setTimeout(";");
    // for (var iii = 0 ; iii < highestTimeoutId ; iii++) {
    //   clearInterval(iii); 
    // }
    clearInterval(meetingInterval); 
    
  });

  $("#btnTakeControl" ).click(function() {
    socket.emit("takeControl",userName);
  });

  

  $("#btnSendMessage" ).click(function() {
    socket.emit("broadcastMessage",document.querySelector("#messageToEveryone").value);
  });


    // Add chat line from everyone (include me) when event occur
    socket.on('chat message', function(msg){
      $('#messages').append($('<li>').text(msg));
    });

    socket.on('takeControl', function(msg){
        if(msg!=userName) {
          document.querySelector("#modorate-media").innerHTML="";
        }
    });    
  
    $( "#btnSetRooms" ).click(function() {
      setRooms();
      var data = JSON.stringify(rooms);
      $.get( "/save-participants", { rooms:data })
      .done(function(){
        alert("חלוקת המשתתפים לחדרים הסתיימה בהצלחה, במפגש זה יש " + rooms.length + " חדרים")
        document.querySelector("#txtTotalMeetings").innerHTML = "סהכ מפגשים:" + rooms.length
      })
      console.log(rooms);
    })   

    
  
// -- send participants to private meeting rooms
  $( "#button-start-meeting" ).click(function() {
    $.get('/start-event')
    .done(function(){
      console.log( "Event started" );
    })    
    $.get('/start-private-meetings')
    .done(function(){
      console.log( "Private Meetings started" );
    })    

  

   // $.get( "/save-participants", { rooms:data })
     // .done(function( data ) {
        console.log( "started 1 on 1 meetings");
        meetingTime = new Date(new Date().getTime() + meetingDuration);
        meetingNumber = 1;
        startTimer();
        socket.emit('start meeting', meetingNumber);
        
     // });
 // });
  })

  $( "#buttonContinueMeetings" ).click(function() {
        console.log( "continue 1 on 1 meetings");
        meetingTime = new Date(new Date().getTime() + meetingDuration);
        meetingNumber = parseInt(document.querySelector("#txtMeetingNumber").value);
        socket.emit('start meeting', meetingNumber);
        startTimer();
      });
  


  $( "#buttonDisconnectMe" ).click(function() {
      disconnectMe();
  });

  $( "#stopConversation" ).click(function() {
    log("Leaving room...");
    
    socket.emit("EndOfMeeting");
    alert("הפגישה הסתיימה");
    activeRoom.disconnect();
  })

  


  $( "#button-test" ).click(function() {
  
  })


}); // - end of document ready



// disconnect eveybody from the room
function doDisconnect(room) {
  room.participants.forEach(remoteParticipant => {
    remoteParticipant.disconnect()
  })
  room.disconnect()
}

/// This is the timer of the meeting

function startTimer() {

  document.querySelector("#txtMeetingNumber").value = meetingNumber;

  meetingInterval = setInterval(function() {

    // Get today's date and time
    var now = new Date().getTime();
    

    // Find the distance between now and the count down date
    var distance = meetingTime - now;

    // Time calculations for days, hours, minutes and seconds
    //var days = Math.floor(distance / (1000 * 60 * 60 * 24));
    //var hours = Math.floor((distance % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    var minutes = Math.floor((distance % (1000 * 60 * 60)) / (1000 * 60));
    var seconds = Math.floor((distance % (1000 * 60)) / 1000);

    document.getElementById("countdowntimerModorator").innerHTML = minutes + ":" + seconds ;
    if (distance > 0) { 
        socket.emit("ClientTimer",minutes + ":" + seconds);
        console.log(minutes + ":" + seconds);
    }

    if(seconds!=lastSeconds) {
      lastSeconds = seconds;
    }
    
    // If the count down is finished, write some text
    if (distance < 60000  && distance > 57000) {
      socket.emit('buzzer', "one minute left");
    }

    // if (distance < 30000  && distance > 27000) {
    //   socket.emit('clearParticipantWindow', "1/2 minute left");
    // }

    if (distance < 0  && distance > -2000) {
      socket.emit('clearParticipantWindow', "1/2 minute left");
    }


    if (distance < -30000) {
      meetingNumber++;
      
      if(meetingNumber > maxMeetings) {

        meetingNumber = maxMeetings;
        socket.emit("backToLobby","1");
        var highestTimeoutId = setTimeout(";");
         // for (var iii = 0 ; iii < highestTimeoutId ; iii++) {
         //   clearInterval(iii); 
         // }
         clearInterval(meetingInterval); 
        }
      else {
        meetingTime = new Date(new Date().getTime() + meetingDuration );
        socket.emit("start meeting",meetingNumber);
        startTimer();
      }
      
    }
  }, 1000);
}


function setRooms() {

  mensList=[]
  womensList=[]

  window.room.participants.forEach(remoteParticipant => {
    identity = remoteParticipant.identity;
    if(identity.includes("#m#")) {
      mensList.push(identity)
    }
    else {
      womensList.push(identity);
    }
  })

  if(womensList.length > mensList.length) {
      for(i=0;i<womensList.length - mensList.length;i++) {
          mensList[mensList.length]  = "0";
      }
  }
  if(mensList.length > womensList.length) {
      for(i=0;i<mensList.length - womensList.length;i++) {
          womensList[womensList.length] = "0";
      }
  }
  maxMeetings = mensList.length
  
  for (var i=0;i<maxMeetings;i++) {
 
      let ii=i 
      rooms[ii] = {
          'females' : womensList,
          'mens' : newary(ii)
      }
  }
}

function newary(idx) {
  var aaa = []
  for(var a=idx;a<mensList.length ;a++) {
      aaa.push(mensList[a])
  }
  for(var a=0;a<idx;a++) {
      aaa.push(mensList[a])
  }
  return aaa;
}

function previewMyself() {
  var localTracksPromise = previewTracks
    ? Promise.resolve(previewTracks)
    : Video.createLocalTracks({
      audio: true,
      video: { width: 800 },
    });

  localTracksPromise.then(function(tracks) {
      window.previewTracks = previewTracks = tracks;
      var previewContainer = document.getElementById('modorate-media');
      if (!previewContainer.querySelector('video')) {
        attachTracks(tracks, previewContainer);
      }
    },function(error) {
      console.error('Unable to access local media', error);
      log('Unable to access Camera and Microphone');
    }
  );
};


function disconnectMe() {
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
};


