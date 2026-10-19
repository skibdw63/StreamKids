// js/video.js

let selectedVideoFile = null;

// Firebase Instance Helper
function getFirebaseServices() {
  const db = window.db || (typeof firebase !== 'undefined' && firebase.firestore ? firebase.firestore() : null);
  const storage = window.storage || (typeof firebase !== 'undefined' && firebase.storage ? firebase.storage() : null);
  const auth = window.auth || (typeof firebase !== 'undefined' && firebase.auth ? firebase.auth() : null);

  return { db, storage, auth };
}

// Handle File Selection (Drag & Drop or File Input)
function handleFileSelect(event) {
  const file = event.target.files ? event.target.files[0] : (event.dataTransfer ? event.dataTransfer.files[0] : null);

  if (!file) return;

  const isMp4Type = file.type === "video/mp4";
  const isMp4Ext = file.name.toLowerCase().endsWith('.mp4');

  if (isMp4Type || isMp4Ext) {
    selectedVideoFile = file;
    const nameEl = document.getElementById('selected-file-name');
    const formEl = document.getElementById('upload-form');

    if (nameEl) nameEl.innerText = `Selected File: ${file.name}`;
    if (formEl) formEl.style.display = 'block';
  } else {
    alert("Please select or drop a valid MP4 video file.");
  }
}

// Setup Drag and Drop Listeners
document.addEventListener('DOMContentLoaded', () => {
  const dropZone = document.getElementById('drop-zone');
  if (!dropZone) return;

  dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#00ffcc';
    dropZone.style.background = '#1a1a1a';
  });

  dropZone.addEventListener('dragleave', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#444';
    dropZone.style.background = 'transparent';
  });

  dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.style.borderColor = '#444';
    dropZone.style.background = 'transparent';
    handleFileSelect(e);
  });
});
