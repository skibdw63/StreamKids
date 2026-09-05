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

// Upload Video to Firebase Storage & Metadata to Firestore
async function uploadVideo() {
  const titleInput = document.getElementById('video-title-input');
  const descInput = document.getElementById('video-desc-input');
  const statusEl = document.getElementById('upload-status');
  const uploadBtn = document.getElementById('upload-btn');

  const title = titleInput ? titleInput.value.trim() : "";
  const desc = descInput ? descInput.value.trim() : "";
  const visibility = document.querySelector('input[name="video-visibility"]:checked')?.value || 'public';

  if (!selectedVideoFile || !title) {
    alert("Please choose an MP4 video file and enter a title.");
    return;
  }

  const { db, storage, auth } = getFirebaseServices();

  if (!db || !storage) {
    alert("Firebase database or storage service is not initialized properly.");
    return;
  }

  const currentUser = auth ? auth.currentUser : null;

  try {
    if (uploadBtn) uploadBtn.disabled = true;
    if (statusEl) statusEl.innerText = "Starting upload...";

    // 1. Upload video file to Firebase Storage with Progress
    const storageRef = storage.ref().child(`videos/${Date.now()}_${selectedVideoFile.name}`);
    const uploadTask = storageRef.put(selectedVideoFile);

    await new Promise((resolve, reject) => {
      uploadTask.on(
        'state_changed',
        (snapshot) => {
          const progress = Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100);
          if (statusEl) statusEl.innerText = `Uploading video: ${progress}%`;
        },
        (error) => reject(error),
        () => resolve()
      );
    });

    if (statusEl) statusEl.innerText = "Saving video details...";
    const videoUrl = await uploadTask.snapshot.ref.getDownloadURL();

    // 2. Save metadata to Firestore
    const authorName = currentUser && currentUser.email ? currentUser.email.split('@')[0] : "Guest User";

    await db.collection('videos').add({
      title: title,
      description: desc,
      videoUrl: videoUrl,
      visibility: visibility,
      author: authorName,
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    if (statusEl) statusEl.innerText = "Upload complete!";
    alert("Your video was successfully uploaded!");

    // Reset Form
    selectedVideoFile = null;
    if (document.getElementById('selected-file-name')) document.getElementById('selected-file-name').innerText = '';
    if (titleInput) titleInput.value = '';
    if (descInput) descInput.value = '';
    
    const fileInput = document.getElementById('video-file-input');
    if (fileInput) fileInput.value = '';

    const formEl = document.getElementById('upload-form');
    if (formEl) formEl.style.display = 'none';

  } catch (err) {
    console.error("Video Upload Error:", err);
    if (statusEl) statusEl.innerText = "Error uploading video. See console for details.";
  } finally {
    if (uploadBtn) uploadBtn.disabled = false;
  }
}

// Load Random Public Videos for "For You Page"
async function loadFYP() {
  const fypContainer = document.getElementById('fyp-container');
  const { db } = getFirebaseServices();

  if (!fypContainer) return;
  if (!db) {
    fypContainer.innerHTML = '<p style="color: #aaa;">Database not available.</p>';
    return;
  }

  fypContainer.innerHTML = '<p style="color: #aaa;">Loading videos...</p>';

  try {
    // Retrieve public videos
    const snapshot = await db.collection('videos')
      .where('visibility', '==', 'public')
      .limit(30)
      .get();

    if (snapshot.empty) {
      fypContainer.innerHTML = '<p style="color: #aaa;">No public videos published yet!</p>';
      return;
    }

    let videos = [];
    snapshot.forEach(doc => videos.push({ id: doc.id, ...doc.data() }));

    // Fisher-Yates shuffle algorithm for random order
    for (let i = videos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [videos[i], videos[j]] = [videos[j], videos[i]];
    }

    fypContainer.innerHTML = '';

    // Render video cards
    videos.forEach((vid) => {
      const card = document.createElement('div');
      card.style.cssText = "background: #181818; padding: 15px; border-radius: 8px; border: 1px solid #2a2a2a; margin-bottom: 15px;";
      
      const safeTitle = vid.title || "Untitled Video";
      const safeAuthor = vid.author || "Guest User";
      const safeDesc = vid.description || "";

      card.innerHTML = `
        <h3 style="margin: 0 0 5px 0; color: #00ffcc;">${safeTitle}</h3>
        <p style="font-size: 0.85em; color: #aaa; margin: 0 0 10px 0;">Posted by @${safeAuthor}</p>
        <video src="${vid.videoUrl}" controls preload="metadata" style="width: 100%; max-height: 400px; border-radius: 6px; background: #000;"></video>
        ${safeDesc ? `<p style="margin-top: 10px; font-size: 0.9em; color: #ddd;">${safeDesc}</p>` : ''}
      `;
      fypContainer.appendChild(card);
    });

  } catch (err) {
    console.error("Error loading FYP:", err);
    fypContainer.innerHTML = '<p style="color: #aaa;">Failed to load FYP videos.</p>';
  }
}
