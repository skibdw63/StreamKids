let peer = null;
let localStream = null;

// Initialize PeerJS with public STUN servers for network connections
function initPeer() {
  if (peer) return;

  peer = new Peer({
    config: {
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    }
  });

  peer.on('open', (id) => {
    console.log("Connected to PeerJS server with ID:", id);
    const peerDisplay = document.getElementById('my-peer-id');
    if (peerDisplay) {
      peerDisplay.innerText = "Peer ID: " + id;
    }
  });

  // Handle incoming calls from viewers
  peer.on('call', (call) => {
    // Send local camera stream back to viewer
    call.answer(localStream);

    call.on('stream', (remoteStream) => {
      const remoteVideo = document.getElementById('remote-webcam');
      if (remoteVideo && remoteStream.getVideoTracks().length > 0) {
        remoteVideo.srcObject = remoteStream;
      }
    });

    call.on('error', (err) => {
      console.error("Call error:", err);
    });
  });

  peer.on('error', (err) => {
    console.error("PeerJS Error:", err);
  });
}

// Start user's camera (Streamer Tab)
function startMyStream() {
  showTab('feed');

  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;
      const localVideo = document.getElementById('my-webcam');
      if (localVideo) {
        localVideo.srcObject = stream;
      }
      initPeer();
    })
    .catch((err) => {
      alert("Unable to access camera/microphone. Please allow browser permissions.");
      console.error(err);
    });
}

// Watch stream (Viewer Tab)
function connectToStreamer() {
  const targetId = document.getElementById('remote-peer-input').value.trim();

  if (!targetId) {
    alert("Please enter a valid Streamer Peer ID!");
    return;
  }

  if (!peer) {
    initPeer();
  }

  // Create empty audio/video track constraints if user isn't streaming back
  const options = {
    constraints: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    }
  };

  // Call the streamer with local stream or dummy constraints
  const call = peer.call(targetId, localStream || new MediaStream(), options);

  call.on('stream', (remoteStream) => {
    console.log("Received streamer's media stream!");
    const remoteVideo = document.getElementById('remote-webcam');
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
      remoteVideo.play();
    }
  });

  call.on('error', (err) => {
    alert("Failed to connect to streamer ID: " + targetId);
    console.error(err);
  });
}

// Initialize peer connection automatically on page load
document.addEventListener('DOMContentLoaded', () => {
  initPeer();
});
