let peer, localStream;

function initPeer() {
  peer = new Peer();
  peer.on('open', (id) => {
    document.getElementById('my-peer-id').innerText = "Peer ID: " + id;
  });

  peer.on('call', (call) => {
    call.answer(localStream);
    call.on('stream', (remoteStream) => {
      document.getElementById('remote-webcam').srcObject = remoteStream;
    });
  });
}

function startMyStream() {
  showTab('feed');
  navigator.mediaDevices.getUserMedia({ video: true, audio: true })
    .then((stream) => {
      localStream = stream;
      document.getElementById('my-webcam').srcObject = stream;
      if (!peer) initPeer();
    })
    .catch((err) => {
      alert("Please allow camera and microphone access in browser settings!");
    });
}

function connectToStreamer() {
  const targetId = document.getElementById('remote-peer-input').value;
  if (!targetId) return alert("Enter a Peer ID first!");
  const call = peer.call(targetId, localStream);
  call.on('stream', (remoteStream) => {
    document.getElementById('remote-webcam').srcObject = remoteStream;
  });
}
