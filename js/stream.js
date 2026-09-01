let peer = null;
let localStream = null;
let currentPeerId = null;
let activeStreamTitle = "";
let chatUnsubscribe = null;
let viewerUnsubscribe = null;
let currentViewerDocId = null;
let heartbeatInterval = null;

// Helper to safely obtain the database instance
function getDb() {
  if (window.db) return window.db;
  if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
    window.db = firebase.firestore();
    return window.db;
  }
  return null;
}

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

  const dbInstance = getDb();
  if (!dbInstance) {
    alert("Database connection is not initialized.");
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

    await dbInstance.collection('active_streams').doc(activeStreamTitle).set({
      title: streamTitle,
      peerId: peerId,
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

// Search and Watch Stream (Viewer)
async function searchAndWatchStream() {
  const searchInput = document.getElementById('search-stream-input');
  const searchTitle = searchInput ? searchInput.value.trim().toLowerCase() : "";

  if (!searchTitle) {
    alert("Please enter a stream title!");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) {
    alert("Database connection is not initialized.");
    return;
  }

  try {
    const doc = await dbInstance.collection('active_streams').doc(searchTitle).get();

    if (!doc.exists) {
      alert("No active stream found with that title!");
      return;
    }

    await leaveCurrentStreamAsViewer();

    activeStreamTitle = searchTitle;
    const targetPeerId = doc.data().peerId;

    // 1. Add viewer to Firestore BEFORE initializing PeerJS connection
    const viewerRef = await dbInstance.collection('active_streams')
      .doc(searchTitle)
      .collection('viewers')
      .add({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() });

    currentViewerDocId = viewerRef.id;

    // 2. Start heartbeat pings
    startHeartbeat(searchTitle, currentViewerDocId);

    // 3. Listen to count & chat immediately
    listenToChat(activeStreamTitle);
    listenToViewers(activeStreamTitle);

    // 4. Connect to Host via PeerJS Call
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

  } catch (err) {
    console.error("Error connecting to stream:", err);
  }
}

// Heartbeat Ping (updates every 5 seconds)
function startHeartbeat(streamTitle, viewerId) {
  if (heartbeatInterval) clearInterval(heartbeatInterval);

  heartbeatInterval = setInterval(async () => {
    const dbInstance = getDb();
    if (activeStreamTitle && currentViewerDocId && dbInstance) {
      try {
        await dbInstance.collection('active_streams')
          .doc(streamTitle)
          .collection('viewers')
          .doc(viewerId)
          .set({ lastSeen: firebase.firestore.FieldValue.serverTimestamp() }, { merge: true });
      } catch (err) {
        console.error("Heartbeat ping error:", err);
      }
    }
  }, 5000);
}

// Stop Heartbeat & Leave Stream
async function leaveCurrentStreamAsViewer() {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
  }

  const dbInstance = getDb();
  if (activeStreamTitle && currentViewerDocId && dbInstance) {
    const streamTitle = activeStreamTitle;
    const viewerId = currentViewerDocId;
    currentViewerDocId = null;

    await dbInstance.collection('active_streams')
      .doc(streamTitle)
      .collection('viewers')
      .doc(viewerId)
      .delete()
      .catch(console.error);
  }
}

// Window Unload Fallback
window.addEventListener('beforeunload', () => {
  leaveCurrentStreamAsViewer();
});

// Stop Stream Function
async function stopMyStream() {
  await leaveCurrentStreamAsViewer();

  const dbInstance = getDb();
  if (activeStreamTitle && dbInstance) {
    dbInstance.collection('active_streams').doc(activeStreamTitle).delete().catch(console.error);
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

// Real-Time Viewer Count Listener (Handles pending server timestamps safely)
function listenToViewers(streamTitle) {
  const dbInstance = getDb();
  if (!dbInstance) return;

  if (viewerUnsubscribe) viewerUnsubscribe();

  viewerUnsubscribe = dbInstance.collection('active_streams')
    .doc(streamTitle)
    .collection('viewers')
    .onSnapshot((snapshot) => {
      const now = Date.now();
      let activeCount = 0;

      snapshot.forEach((doc) => {
        const data = doc.data();

        // 1. Pending local write from serverTimestamp()
        if (!data.lastSeen) {
          activeCount++;
          return;
        }

        // 2. Parse timestamp safely
        let lastSeenTime = now;
        if (typeof data.lastSeen.toMillis === 'function') {
          lastSeenTime = data.lastSeen.toMillis();
        } else if (typeof data.lastSeen.toDate === 'function') {
          lastSeenTime = data.lastSeen.toDate().getTime();
        }

        // 3. Count active sessions within 12s window
        if (now - lastSeenTime < 12000) {
          activeCount++;
        } else {
          doc.ref.delete().catch(() => {});
        }
      });

      const vCount = document.getElementById('viewer-count');
      if (vCount) vCount.innerText = activeCount;
    }, (error) => {
      console.error("Viewer listener error:", error);
    });
}

// Real-Time Chat Listener
function listenToChat(streamTitle) {
  const chatContainer = document.getElementById('chat-messages');
  const dbInstance = getDb();
  if (!chatContainer || !dbInstance) return;

  if (chatUnsubscribe) chatUnsubscribe();

  chatUnsubscribe = dbInstance.collection('active_streams')
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

  const dbInstance = getDb();
  if (!dbInstance) {
    alert("Database connection is not initialized.");
    return;
  }

  try {
    const user = window.auth ? auth.currentUser : null;
    const senderName = user && user.email ? user.email.split('@')[0] : "Guest Viewer";

    await dbInstance.collection('active_streams')
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

// Schedule Stream Function
async function scheduleStream() {
  const title = document.getElementById('sched-title')?.value.trim();
  const time = document.getElementById('sched-time')?.value;

  if (!title || !time) {
    alert("Please fill in both the stream title and date/time!");
    return;
  }

  const dbInstance = getDb();
  if (!dbInstance) {
    alert("Database connection is not initialized.");
    return;
  }

  try {
    await dbInstance.collection('scheduled_streams').add({
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
  const dbInstance = getDb();
  if (!listEl || !dbInstance) return;

  listEl.innerHTML = 'Loading...';

  try {
    const snapshot = await dbInstance.collection('scheduled_streams').orderBy('scheduledTime', 'asc').get();

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
