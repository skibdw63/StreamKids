// Tab Switching Helper
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

  // Automatically load the feed when switching to the FYP tab
  if (tabId === 'fyp-tab') {
    loadFYP();
  }
}

// Authentication Handlers
function loginWithGoogle() {
  const provider = new firebase.auth.GoogleAuthProvider();
  firebase.auth().signInWithPopup(provider).catch(err => alert(err.message));
}

function logoutUser() {
  firebase.auth().signOut();
}

// Loads and renders videos in the For You Page (FYP) feed
async function loadFYP() {
  const fypContainer = document.getElementById('fyp-container');
  if (!fypContainer) return;

  fypContainer.innerHTML = '<p style="color: #aaa;">Loading videos...</p>';

  try {
    const snapshot = await firebase.firestore()
      .collection('videos')
      .where('visibility', '==', 'public')
      .orderBy('createdAt', 'desc')
      .get();

    if (snapshot.empty) {
      fypContainer.innerHTML = '<p style="color: #aaa;">No videos posted yet.</p>';
      return;
    }

    fypContainer.innerHTML = ''; // Clear loading text

    snapshot.forEach(doc => {
      const data = doc.data();

      // Uses uploaderName from the Firestore document (e.g. "Skibidi What")
      const authorName = data.uploaderName || 'Guest User';

      const card = document.createElement('div');
      card.className = 'video-card';
      card.style.marginBottom = '20px';

      card.innerHTML = `
        <h3 style="color: #00ffcc; margin-bottom: 4px;">${escapeHtml(data.title || 'Untitled')}</h3>
        <p style="color: #aaaaaa; font-size: 0.9rem; margin-bottom: 10px;">
          Posted by <span onclick="openChannelProfile('${data.uploaderUid}')" style="color: #0088ff; cursor: pointer; font-weight: bold;">@${escapeHtml(authorName)}</span>
        </p>
        <video src="${data.videoUrl}" controls style="width: 100%; max-height: 400px; background: #000; border-radius: 6px;"></video>
        ${data.description ? `<p style="margin-top: 8px; color: #dddddd;">${escapeHtml(data.description)}</p>` : ''}
      `;

      fypContainer.appendChild(card);
    });
  } catch (err) {
    console.error("Error loading FYP:", err);
    fypContainer.innerHTML = `<p style="color: #ff5555;">Error loading feed: ${err.message}</p>`;
  }
}

// Helper to escape special HTML characters to prevent XSS issues
function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Live Stream Placeholders
function startMyStream() {
  console.log("Starting stream...");
}

function stopMyStream() {
  console.log("Stopping stream...");
}

function searchAndWatchStream() {
  const input = document.getElementById('search-stream-input');
  if (input) console.log("Searching for stream:", input.value);
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (input && input.value.trim() !== "") {
    console.log("Chat Message Sent:", input.value);
    input.value = "";
  }
}

// File Selection Handler
function handleFileSelect(event) {
  const file = event.target.files[0];
  const form = document.getElementById('upload-form');
  const fileNameDisplay = document.getElementById('selected-file-name');

  if (file) {
    if (fileNameDisplay) fileNameDisplay.innerText = "Selected File: " + file.name;
    if (form) form.style.display = 'block';
  }
}

// Video Scheduling Placeholder
function scheduleStream() {
  const title = document.getElementById('sched-title').value;
  const time = document.getElementById('sched-time').value;
  if (title && time) {
    alert(`Stream scheduled: ${title} at ${time}`);
  }
}
