// Tab Switching Helper
function showTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(tab => tab.style.display = 'none');
  const target = document.getElementById(tabId);
  if (target) target.style.display = 'block';

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

// Placeholder functions for core features
function startMyStream() {
  console.log("Starting stream...");
}

function stopMyStream() {
  console.log("Stopping stream...");
}

function searchAndWatchStream() {
  console.log("Searching stream...");
}

function sendChatMessage() {
  const input = document.getElementById('chat-input');
  if (input && input.value.trim() !== "") {
    console.log("Chat Message Sent:", input.value);
    input.value = "";
  }
}

function handleFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    document.getElementById('selected-file-name').innerText = file.name;
    document.getElementById('upload-form').style.display = 'block';
  }
}

function uploadVideo() {
  const status = document.getElementById('upload-status');
  if (status) status.innerText = "Uploading video...";
}

function scheduleStream() {
  const title = document.getElementById('sched-title').value;
  const time = document.getElementById('sched-time').value;
  if (title && time) {
    alert(`Stream "${title}" scheduled for ${time}`);
  }
}
