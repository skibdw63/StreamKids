// Tab Switching Helper
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => {
    tab.style.display = 'none';
  });
  
  const target = document.getElementById(tabId);
  if (target) {
    target.style.display = 'block';
  }

  if (tabId === 'fyp-tab' && typeof loadFYP === 'function') {
    loadFYP();
  }
}

// Authentication Handlers
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert(err.message));
}

function logoutUser() {
  firebase.auth().signOut().catch(err => alert(err.message));
}

// Placeholder functions for core stream features
function startMyStream() {
  console.log("Starting stream...");
}

function stopMyStream() {
  console.log("Stopping stream...");
}

function searchAndWatchStream() {
  console.log("Searching stream...");
}

// Real-Time Chat Message Handler
function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (!input || input.value.trim() === "") return;

  const user = firebase.auth().currentUser;
  if (!user) {
    alert("Please sign in to send messages!");
    return;
  }

  const messageText = input.value.trim();
  const db = firebase.firestore();

  // Fetch current user details for badge status
  db.collection('users').doc(user.uid).get().then(doc => {
    const isVerified = doc.exists ? !!doc.data().isVerified : false;

    db.collection('chat').add({
      uid: user.uid,
      displayName: user.displayName || 'Anonymous',
      isVerified: isVerified,
      message: messageText,
      timestamp: firebase.firestore.FieldValue.serverTimestamp()
    }).then(() => {
      input.value = "";
    }).catch(err => console.error("Error sending chat:", err));
  });
}

// Video Upload File Selection
function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    document.getElementById('selected-file-name').innerText = file.name;
    document.getElementById('upload-form').style.display = 'block';
  }
}

// Firebase Storage & Firestore Video Upload Handler
function uploadVideo() {
  const fileInput = document.getElementById('video-file-input');
  const titleInput = document.getElementById('video-title-input');
  const descInput = document.getElementById('video-desc-input');
  const status = document.getElementById('upload-status');
  const visibility = document.querySelector('input[name="video-visibility"]:checked')?.value || 'public';

  const user = firebase.auth().currentUser;
  if (!user) {
    alert("You must be logged in to upload videos.");
    return;
  }

  if (!fileInput.files || fileInput.files.length === 0) {
    alert("Please select an MP4 file.");
    return;
  }

  const file = fileInput.files[0];
  const title = titleInput.value.trim() || file.name;
  const description = descInput.value.trim();

  status.innerText = "Uploading video... 0%";

  const storageRef = firebase.storage().ref(`videos/${user.uid}_${Date.now()}_${file.name}`);
  const uploadTask = storageRef.put(file);

  uploadTask.on('state_changed', 
    (snapshot) => {
      const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
      status.innerText = `Uploading video... ${progress}%`;
    }, 
    (error) => {
      alert("Upload failed: " + error.message);
      status.innerText = "Upload failed.";
    }, 
    () => {
      uploadTask.snapshot.ref.getDownloadURL().then((downloadURL) => {
        firebase.firestore().collection('videos').add({
          title: title,
          description: description,
          url: downloadURL,
          uid: user.uid,
          uploaderName: user.displayName || 'Anonymous',
          visibility: visibility,
          createdAt: firebase.firestore.FieldValue.serverTimestamp()
        }).then(() => {
          status.innerText = "Upload completed successfully!";
          titleInput.value = "";
          descInput.value = "";
          fileInput.value = "";
          document.getElementById('upload-form').style.display = 'none';
        });
      });
    }
  );
}

// Stream Schedule Handler
function scheduleStream() {
  const title = document.getElementById('sched-title').value.trim();
  const time = document.getElementById('sched-time').value;
  const user = firebase.auth().currentUser;

  if (!user) {
    alert("Please sign in to schedule a stream.");
    return;
  }

  if (!title || !time) {
    alert("Please provide both a title and a scheduled date/time.");
    return;
  }

  firebase.firestore().collection('schedules').add({
    title: title,
    scheduledTime: time,
    uid: user.uid,
    hostName: user.displayName || 'Anonymous',
    createdAt: firebase.firestore.FieldValue.serverTimestamp()
  }).then(() => {
    alert(`Stream "${title}" scheduled for ${time}`);
    document.getElementById('sched-title').value = "";
    document.getElementById('sched-time').value = "";
    loadScheduledStreams();
  }).catch(err => alert("Error scheduling stream: " + err.message));
}

// Load Scheduled Streams List
function loadScheduledStreams() {
  const listContainer = document.getElementById('upcoming-streams-list');
  if (!listContainer) return;

  firebase.firestore().collection('schedules').orderBy('scheduledTime', 'asc').get().then(snapshot => {
    listContainer.innerHTML = "";
    if (snapshot.empty) {
      listContainer.innerHTML = "<p style='color: #888;'>No upcoming streams scheduled.</p>";
      return;
    }

    snapshot.forEach(doc => {
      const data = doc.data();
      const item = document.createElement('div');
      item.style.cssText = "background: #121212; padding: 10px; border-radius: 4px; border: 1px solid #333;";
      item.innerHTML = `
        <strong style="color: #0088ff;">${data.title}</strong> by ${data.hostName}<br>
        <small style="color: #00ffcc;">📅 ${new Date(data.scheduledTime).toLocaleString()}</small>
      `;
      listContainer.appendChild(item);
    });
  });
}

// Initialize Chat & Schedule Listeners on DOM Load
window.addEventListener('DOMContentLoaded', () => {
  // Real-time Chat Listener
  const chatMessages = document.getElementById('chat-messages');
  if (chatMessages) {
    firebase.firestore().collection('chat').orderBy('timestamp', 'asc').onSnapshot(snapshot => {
      chatMessages.innerHTML = "";
      snapshot.forEach(doc => {
        const data = doc.data();
        const msgRow = document.createElement('div');
        msgRow.style.marginBottom = "8px";

        const verifiedBadge = data.isVerified ? `<span class="badge-icon" title="Verified Creator">☑️</span>` : '';
        
        msgRow.innerHTML = `
          <span class="chat-username" onclick="openChannelProfile('${data.uid}')">${data.displayName}</span>${verifiedBadge}: 
          <span>${data.message}</span>
        `;
        chatMessages.appendChild(msgRow);
      });
      chatMessages.scrollTop = chatMessages.scrollHeight;
    });
  }

  // Load schedule list on startup
  loadScheduledStreams();
});
