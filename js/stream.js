let peer = null;
let localStream = null;

// Enumerate audio input devices and populate the dropdown menu
async function getMicrophones() {
  const micSelect = document.getElementById('mic-select');
  if (!micSelect) return;

  try {
    await navigator.mediaDevices.getUserMedia({ audio: true });
    
    const devices = await navigator.mediaDevices.enumerateDevices();
    const audioInputs = devices.filter(device => device.kind === 'audioinput');

    micSelect.innerHTML = '';
    audioInputs.forEach((device, index) => {
      const option = document.createElement('option');
      option.value = device.deviceId;
      option.text = device.label || `Microphone ${index + 1}`;
      
      if (device.label.toLowerCase().includes('camo')) {
        option.selected = true;
      }

      micSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Could not list audio devices:", err);
  }
}

// Initialize PeerJS connection
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

  peer.on('call', (call) => {
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

// Start Streamer Camera & Selected Microphone
function startMyStream() {
  showTab('feed');

  const selectedMicId = document.getElementById('mic-select')?.value;

  const constraints = {
    video: true,
    audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
  };

  navigator.mediaDevices.getUserMedia(constraints)
    .then((stream) => {
      localStream = stream;
      const localVideo = document.getElementById('my-webcam');
      if (localVideo) {
        localVideo.srcObject = stream;
      }

      const audioTrack = stream.getAudioTracks()[0];
      if (audioTrack) {
        console.log("Active microphone:", audioTrack.label);
      }

      initPeer();
    })
    .catch((err) => {
      alert("Unable to access camera or microphone. Check permissions.");
      console.error(err);
    });
}

// Stop Streamer Camera & Release Tracks
function stopMyStream() {
  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  const localVideo = document.getElementById('my-webcam');
  if (localVideo) {
    localVideo.srcObject = null;
  }

  const peerDisplay = document.getElementById('my-peer-id');
  if (peerDisplay) {
    peerDisplay.innerText = "Peer ID: Disconnected";
  }

  if (peer) {
    peer.destroy();
    peer = null;
  }

  console.log("Stream stopped successfully.");
}

// Connect Viewer to Streamer
function connectToStreamer() {
  const targetId = document.getElementById('remote-peer-input').value.trim();

  if (!targetId) {
    alert("Please enter a valid Streamer Peer ID!");
    return;
  }

  if (!peer) {
    initPeer();
  }

  const options = {
    constraints: {
      offerToReceiveAudio: true,
      offerToReceiveVideo: true
    }
  };

  const call = peer.call(targetId, localStream || new MediaStream(), options);

  call.on('stream', (remoteStream) => {
    const remoteVideo = document.getElementById('remote-webcam');
    if (remoteVideo) {
      remoteVideo.srcObject = remoteStream;
      remoteVideo.muted = false;
      remoteVideo.play().catch(err => console.log("Autoplay blocked:", err));
    }
  });

  call.on('error', (err) => {
    alert("Failed to connect to streamer ID: " + targetId);
    console.error(err);
  });
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  getMicrophones();
  initPeer();
});
