// js/video.js

let selectedVideoFile = null;

// Handle File Selection
function handleFileSelect(event) {
  const file = event.target.files ? event.target.files[0] : (event.dataTransfer ? event.dataTransfer.files[0] : null);
  
  if (file && file.type === "video/mp4") {
    selectedVideoFile = file;
    document.getElementById('selected-file-name').innerText = `Selected File: ${file.name}`;
    document.getElementById('upload-form').style.display = 'block';
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

// Upload Video to Storage & Firestore
async function uploadVideo() {
  const title = document.getElementById('video-title-input')?.value.trim();
  const desc = document.getElementById('video-desc-input')?.value.trim();
  const visibility = document.querySelector('input[name="video-visibility"]:checked')?.value;
  const statusEl = document.getElementById('upload-status');
  const uploadBtn = document.getElementById('upload-btn');

  if (!selectedVideoFile || !title) {
    alert("Please choose an MP4 video file and enter a title.");
    return;
  }

  const dbInstance = window.db;
  const storageInstance = window.storage;
  const currentUser = window.auth ? window.auth.currentUser : null;

  if (!dbInstance || !storageInstance) {
    alert("Firebase service is not fully initialized.");
    return;
  }

  try {
    uploadBtn.disabled = true;
    statusEl.innerText = "Uploading video file to Firebase Storage...";

    // 1. Upload video file to Firebase Storage
    const fileRef = storageInstance.ref().child(`videos/${Date.now()}_${selectedVideoFile.name}`);
    const uploadTask = await fileRef.put(selectedVideoFile);
    const videoUrl = await uploadTask.ref.getDownloadURL();

    statusEl.innerText = "Saving video metadata to database...";

    // 2. Save metadata to Firestore
    await dbInstance.collection('videos').add({
      title: title,
      description: desc || "",
      videoUrl: videoUrl,
      visibility: visibility,
      author: currentUser && currentUser.email ? currentUser.email.split('@')[0] : "Guest User",
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });

    statusEl.innerText = "Upload complete!";
    alert("Your video was successfully uploaded!");

    // Reset Form
    selectedVideoFile = null;
    document.getElementById('selected-file-name').innerText = '';
    document.getElementById('video-title-input').value = '';
    document.getElementById('video-desc-input').value = '';
    document.getElementById('upload-form').style.display = 'none';
    uploadBtn.disabled = false;

  } catch (err) {
    console.error("Video Upload Error:", err);
    statusEl.innerText = "Error uploading video. See console for details.";
    uploadBtn.disabled = false;
  }
}

// Load Random Public Videos for "For You Page"
async function loadFYP() {
  const fypContainer = document.getElementById('fyp-container');
  const dbInstance = window.db;

  if (!fypContainer || !dbInstance) return;

  fypContainer.innerHTML = '<p style="color: #aaa;">Loading videos...</p>';

  try {
    // Retrieve only public videos
    const snapshot = await dbInstance.collection('videos')
      .where('visibility', '==', 'public')
      .limit(30)
      .get();

    if (snapshot.empty) {
      fypContainer.innerHTML = '<p style="color: #aaa;">No public videos published yet!</p>';
      return;
    }

    let videos = [];
    snapshot.forEach(doc => videos.push(doc.data()));

    // Fisher-Yates random shuffle algorithm
    for (let i = videos.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [videos[i], videos[j]] = [videos[j], videos[i]];
    }

    fypContainer.innerHTML = '';

    // Render video items
    videos.forEach((vid) => {
      const card = document.createElement('div');
      card.style.cssText = "background: #181818; padding: 15px; border-radius: 8px; border: 1px solid #2a2a2a;";
      card.innerHTML = `
        <h3 style="margin: 0 0 5px 0; color: #00ffcc;">${vid.title}</h3>
        <p style="font-size: 0.85em; color: #aaa; margin: 0 0 10px 0;">Posted by @${vid.author}</p>
        <video src="${vid.videoUrl}" controls style="width: 100%; max-height: 400px; border-radius: 6px; background: #000;"></video>
        ${vid.description ? `<p style="margin-top: 10px; font-size: 0.9em; color: #ddd;">${vid.description}</p>` : ''}
      `;
      fypContainer.appendChild(card);
    });

  } catch (err) {
    console.error("Error loading FYP:", err);
    fypContainer.innerHTML = '<p style="color: #aaa;">Failed to load FYP videos.</p>';
  }
}
