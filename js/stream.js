let peer = null;
let localStream = null;
let currentPeerId = null;
let activeStreamTitle = "";
let chatUnsubscribe = null;
let viewerUnsubscribe = null;
let currentViewerDocId = null;

// Enumerate connected microphones
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

// Initialize PeerJS Connection
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

// Go Live Function (Host)
async function startMyStream() {
  const titleInput = document.getElementById('stream-title-input');
  const streamTitle = titleInput ? titleInput.value.trim() : "";

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

    if (window.db) {
      await db.collection('active_streams').doc(activeStreamTitle).set({
        title: streamTitle,
        peerId: peerId,
        viewers: 0,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });

      listenToChat(activeStreamTitle);
      listenToViewers(activeStreamTitle);
    }

    alert(`Stream "${streamTitle}" is live!`);
  } catch (err) {
    alert("Unable to access camera or microphone.");
    console.error(err);
  }
}

// Search and Watch Stream (Viewer)
async function searchAndWatchStream() {
  const searchInput = document.getElementById('search-stream-input');
  const searchTitle = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (!searchTitle) {
    alert("Please enter a stream title!");
    return;
  }

  if (!window.db) {
    alert("Database connection is not initialized.");
    return;
  }

  try {
    const doc = await db.collection('active_streams').doc(searchTitle).get();

    if (!doc.exists) {
      alert("No active stream found with that title!");
      return;
    }

    // Leave any previously watched stream before connecting to a new one
    await leaveCurrentStreamAsViewer();

    activeStreamTitle = searchTitle;
    const targetPeerId = doc.data().peerId;

    // Track individual viewer session doc
    const viewerRef = await db.collection('active_streams')
      .doc(searchTitle)
      .collection('viewers')
      .add({ joinedAt: firebase.firestore.FieldValue.serverTimestamp() });

    currentViewerDocId = viewerRef.id;

    // Increment live viewer counter (+1)
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

// Decrement viewer counter when a viewer leaves or closes tab (-1)
async function leaveCurrentStreamAsViewer() {
  if (activeStreamTitle && currentViewerDocId && window.db) {
    const streamRef = db.collection('active_streams').doc(activeStreamTitle);

    // Delete viewer tracking doc
    await streamRef.collection('viewers').doc(currentViewerDocId).delete().catch(console.error);

    // Decrement main viewer counter safely using transaction
    await db.runTransaction(async (transaction) => {
      const sfDoc = await transaction.get(streamRef);
      if (sfDoc.exists) {
        const newCount = Math.max(0, (sfDoc.data().viewers || 1) - 1);
        transaction.update(streamRef, { viewers: newCount });
      }
    }).catch(console.error);

    currentViewerDocId = null;
  }
}

// Automatically decrement viewer count if window/tab closes
window.addEventListener('beforeunload', () => {
  leaveCurrentStreamAsViewer();
});

// Stop Stream Function (Host/Viewer Reset)
async function stopMyStream() {
  await leaveCurrentStreamAsViewer();

  if (activeStreamTitle && window.db) {
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

  const vCount = document.getElementById('viewer-count');
  if (vCount) vCount.innerText = "0";

  console.log("Stream stopped.");
}

// Real-Time Chat Listener
function listenToChat(streamTitle) {
  const chatContainer = document.getElementById('chat-messages');
  if (!chatContainer || !window.db) return;

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

// Send Chat Message Function
async function sendChatMessage() {
  const input = document.getElementById('chat-input');
  const text = input ? input.value.trim() : "";

  if (!text) {
    alert("Please type a message before sending!");
    return;
  }

  if (!activeStreamTitle) {
    alert("You must join or start a stream first to chat!");
    return;
  }

  if (!window.db) {
    alert("Database is not connected.");
    return;
  }

  try {
    const user = window.auth ? auth.currentUser : null;
    const senderName = user && user.email ? user.email.split('@')[0] : "Guest Viewer";

    await db.collection('active_streams')
      .doc(activeStreamTitle)
      .collection('chat')
      .add({
        sender: senderName,
        text: text,
        timestamp: firebase.firestore.FieldValue.serverTimestamp()
      });

    input.value = '';
  } catch (err) {
    console.error("Error sending chat message:", err);
    alert("Could not send message. Check console for details.");
  }
}

// Real-Time Viewer Count Listener
function listenToViewers(streamTitle) {
  if (!window.db) return;
  if (viewerUnsubscribe) viewerUnsubscribe();

  viewerUnsubscribe = db.collection('active_streams')
    .doc(streamTitle)
    .onSnapshot((doc) => {
      if (doc.exists) {
        const count = doc.data().viewers || 0;
        const vCount = document.getElementById('viewer-count');
        if (vCount) vCount.innerText = count;
      }
    });
}

// Schedule Stream Function
async function scheduleStream() {
  const title = document.getElementById('sched-title')?.value.trim();
  const time = document.getElementById('sched-time')?.value;

  if (!title || !time) {
    alert("Please fill in both the stream title and date/time!");
    return;
  }

  if (!window.db) {
    alert("Database is not connected.");
    return;
  }

  try {
    await db.collection('scheduled_streams').add({
      title: title,
      scheduledTime: time,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    alert("Stream scheduled successfully!");
    document.getElementById('sched-title').value = '';
    document.getElementById('sched-time').value = '';
    loadScheduledStreams();
  } catch (err) {
    console.error("Error scheduling stream:", err);
    alert("Failed to save schedule. Check console for details.");
  }
}

// Load Scheduled Broadcasts
async function loadScheduledStreams() {
  const listEl = document.getElementById('upcoming-streams-list');
  if (!listEl || !window.db) return;

  listEl.innerHTML = 'Loading...';

  try {
    const snapshot = await db.collection('scheduled_streams').orderBy('scheduledTime', 'asc').get();

    if (snapshot.empty) {
      listEl.innerHTML = '<p style="color: #aaa;">No upcoming streams scheduled yet.</p>';
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
  } catch (err) {
    console.error("Error loading schedules:", err);
    listEl.innerHTML = '<p style="color: #aaa;">Could not load schedules.</p>';
  }
}

// Startup
document.addEventListener('DOMContentLoaded', () => {
  getMicrophones();
});
