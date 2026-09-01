let peer = null;
let localStream = null;

// Initialize PeerJS connection
function initPeer() {
  if (peer) return;

  // Automatically connects to PeerJS cloud servers
  peer = new Peer();

  peer.on('open', (id) => {
    console.log("Connected to PeerJS server with ID:", id);
    const peerDisplay = document.getElementById('my-peer-id');
    if (peerDisplay) {
      peerDisplay.innerText = "Peer ID: " + id;
    }
  });

  // Receive stream call from viewer
  peer.on('call', (call) => {
    call.answer(localStream);

    call.on('stream', (remoteStream) => {
      const remoteVideo = document.getElementById('remote-webcam');
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
      }
    });
  });

  peer.on('error', (err) => {
    console.error("PeerJS Error:", err);
  });
}

// Start user's webcam and camera stream
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
      alert("Unable to access camera and microphone. Please allow permissions in your browser.");
    });
}

// Connect viewer to streamer using Streamer Peer ID
function connectToStreamer() {
  const targetId = document.getElementById('remote-peer-input').value.trim();
  
  if (!targetId) {
    alert("Please enter a valid Streamer Peer ID!");
    return;
  }

  if (!peer) {
    initPeer();
  }

  const call = peer.call(targetId, localStream);

  call.on('stream', (remoteStream) => {
    const remoteVideo = document.getElementById('remote-webcam');
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
    }
  });

  call.on('error', (err) => {
    alert("Failed to connect to streamer ID: " + targetId);
  });
}
