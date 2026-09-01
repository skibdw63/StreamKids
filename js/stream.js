let peer = null;
let localStream = null;
let currentPeerId = null;
let activeStreamTitle = "";
let chatUnsubscribe = null;
let viewerUnsubscribe = null;

// Get connected microphones
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
      if (device.label.toLowerCase().includes('camo')) option.selected = true;
      micSelect.appendChild(option);
    });
  } catch (err) {
    console.error("Could not list audio devices:", err);
  }
}

// Initialize PeerJS
function initPeer() {
  return new Promise((resolve) => {
    if (peer && currentPeerId) {
      resolve(currentPeerId);
      return;
    }

    peer = new Peer({
      config: {
        iceServers: [
          { urls: 'stun:stun.l.google.com:19302' },
          { urls: 'stun:stun1.l.google.com:19302' }
        ]
      }
    });

    peer.on('open', (id) => {
      currentPeerId = id;
      const peerDisplay = document.getElementById('my-peer-id');
      if (peerDisplay) peerDisplay.innerText = "Peer ID: " + id;
      resolve(id);
    });

    peer.on('call', (call) => {
      call.answer(localStream);
      call.on('stream', (remoteStream) => {
        const remoteVideo = document.getElementById('remote-webcam');
        if (remoteVideo) remoteVideo.srcObject = remoteStream;
      });
    });

    peer.on('error', (err) => console.error("PeerJS Error:", err));
  });
}

// Start Streamer Camera & Publish Stream
async function startMyStream() {
  const streamTitle = document.getElementById('stream-title-input').value.trim();

  if (!streamTitle) {
    alert("Please enter a title for your stream!");
    return;
  }

  activeStreamTitle = streamTitle.toLowerCase();
  showTab('feed');
  const selectedMicId = document.getElementById('mic-select')?.value;

  const constraints = {
    video: true,
    audio: selectedMicId ? { deviceId: { exact: selectedMicId } } : true
  };

  try {
    const stream = await navigator.mediaDevices.getUserMedia(constraints);
    localStream = stream;
    const localVideo = document.getElementById('my-webcam');
    if (localVideo) localVideo.srcObject = stream;

    const peerId = await initPeer();

    // Create stream entry in Firestore
    await db.collection('active_streams').doc(activeStreamTitle).set({
      title: streamTitle,
      peerId: peerId,
      viewers: 0,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    listenToChat(activeStreamTitle);
    listenToViewers(activeStreamTitle);

    alert(`Stream "${streamTitle}" is live!`);
  } catch (err) {
    alert("Unable to access camera or microphone.");
    console.error(err);
  }
}

// Stop Stream & Delete from Directory
async function stopMyStream() {
  if (activeStreamTitle) {
    db.collection('active_streams').doc(activeStreamTitle).delete().catch(console.error);
  }

  if (localStream) {
    localStream.getTracks().forEach(track => track.stop());
    localStream = null;
  }

  const localVideo = document.getElementById('my-webcam');
  if (localVideo) localVideo.srcObject = null;

  if (chatUnsubscribe) chatUnsubscribe();
  if (viewerUnsubscribe) viewerUnsubscribe();

  if (peer) {
    peer.destroy();
    peer = null;
    currentPeerId = null;
  }

  document.getElementById('viewer-count').innerText = "0";
  console.log("Stream stopped.");
}

// Search Stream & Watch
async function searchAndWatchStream() {
  const searchTitle = document.getElementById('search-stream-input').value.trim().toLowerCase();

  if (!searchTitle) {
    alert("Please enter a stream title!");
    return;
  }

  try {
    const doc = await db.collection('active_streams').doc(searchTitle).get();

    if (!doc.exists) {
      alert("No active stream found with that title!");
      return;
    }

    activeStreamTitle = searchTitle;
    const targetPeerId = doc.data().peerId;

    // Increment Viewer Counter in Firestore
    await db.collection('active_streams').doc(searchTitle).update({
      viewers: firebase.firestore.FieldValue.increment(1)
    });

    await initPeer();

    const options = { constraints: { offerToReceiveAudio: true, offerToReceiveVideo: true } };
    const call = peer.call(targetPeerId, localStream || new MediaStream(), options);

    call.on('stream', (remoteStream) => {
      const remoteVideo = document.getElementById('remote-webcam');
      if (remoteVideo) {
        remoteVideo.srcObject = remoteStream;
        remoteVideo.muted = false;
        remoteVideo.play().catch(console.error);
      }
    });

    listenToChat(activeStreamTitle);
    listenToViewers(activeStreamTitle);

  } catch (err) {
    console.error("Error connecting to stream:", err);
  }
}

// Real-Time Chat Listener
function listenToChat(streamTitle) {
  const chatContainer = document.getElementById('chat-messages');
  if (chatUnsubscribe) chatUnsubscribe();

  chatUnsubscribe = db.collection('active_streams')
    .doc(streamTitle)
    .collection('chat')
    .orderBy('timestamp', 'asc')
    .onSnapshot((snapshot) => {
      chatContainer.innerHTML = '';
      snapshot.forEach((doc) => {
        const msg = doc.data();
        const p = document.createElement('p');
        p.style.margin = "4px 0";
        p.innerHTML = `<strong style="color: #00ffcc;">${msg.sender}:</strong> ${msg.text}`;
        chatContainer.appendChild(p);
      });
      chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

// Send Chat Message
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input.value.trim();

  if (!text || !activeStreamTitle) return;

  const user = auth.currentUser;
  const senderName = user ? user.email.split('@')[0] : "Guest Viewer";

  await db.collection('active_streams')
    .doc(activeStreamTitle)
    .collection('chat')
    .add({
      sender: senderName,
      text: text,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    });

  input.value = '';
}

// Real-Time Viewer Count Listener
function listenToViewers(streamTitle) {
  if (viewerUnsubscribe) viewerUnsubscribe();

  viewerUnsubscribe = db.collection('active_streams')
    .doc(streamTitle)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const count = doc.data().viewers || 0;
        document.getElementById('viewer-count').innerText = count;
      }
    });
}

// Schedule Stream Functionality
async function scheduleStream() {
  const title = document.getElementById('sched-title').value.trim();
  const time = document.getElementById('sched-time').value;

  if (!title || !time) {
    alert("Please fill in both the title and schedule time!");
    return;
  }

  await db.collection('scheduled_streams').add({
    title: title,
    scheduledTime: time,
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  });

  alert("Stream scheduled successfully!");
  document.getElementById('sched-title').value = '';
  document.getElementById('sched-time').value = '';
  loadScheduledStreams();
}

// Load Scheduled Streams List
async function loadScheduledStreams() {
  const listEl = document.getElementById('upcoming-streams-list');
  listEl.innerHTML = 'Loading...';

  const snapshot = await db.collection('scheduled_streams').orderBy('scheduledTime', 'asc').get();

  if (snapshot.empty) {
    listEl.innerHTML = '<p>No upcoming streams scheduled yet.</p>';
    return;
  }

  listEl.innerHTML = '';
  snapshot.forEach((doc) => {
    const item = doc.data();
    const div = document.createElement('div');
    div.style.cssText = "background: #121212; padding: 12px; border-radius: 6px; border-left: 4px solid #00ffcc;";
    div.innerHTML = `<strong>${item.title}</strong><br><small style="color: #aaa;">Scheduled for: ${new Date(item.scheduledTime).toLocaleString()}</small>`;
    listEl.appendChild(div);
  });
}

// Run on page startup
document.addEventListener('DOMContentLoaded', () => {
  getMicrophones();
});
