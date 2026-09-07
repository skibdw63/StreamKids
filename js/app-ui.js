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

// Channel Profile View (Owner vs Viewer Controls)
async function openChannelProfile(targetUid) {
  const profileContainer = document.getElementById('profile-container');
  if (!profileContainer) return;

  const currentUser = firebase.auth().currentUser;
  const isOwner = currentUser && currentUser.uid === targetUid;

  // Show profile section tab
  showTab('profile-tab');
  profileContainer.innerHTML = '<p style="color: #aaa;">Loading channel...</p>';

  try {
    // 1. Fetch channel owner data
    const userDoc = await firebase.firestore().collection('users').doc(targetUid).get();
    const userData = userDoc.exists ? userDoc.data() : {};

    const displayName = userData.displayName || 'StreamKids Creator';
    const handle = userData.handle || `@user_${targetUid.substring(0, 5)}`;
    const avatarUrl = userData.avatarUrl || 'https://via.placeholder.com/150';
    const bio = userData.bio || 'Welcome to my official channel!';

    // 2. Fetch user's uploaded videos
    const videosSnapshot = await firebase.firestore()
      .collection('videos')
      .where('uploaderUid', '==', targetUid)
      .where('visibility', '==', 'public')
      .get();

    let videoCardsHtml = '';
    if (videosSnapshot.empty) {
      videoCardsHtml = `
        <div style="text-align: center; padding: 40px; color: #888; width: 100%;">
          <p>This channel doesn't have any content</p>
        </div>`;
    } else {
      videosSnapshot.forEach(doc => {
        const v = doc.data();
        videoCardsHtml += `
          <div style="width: 200px; display: inline-block; margin: 10px; text-align: left;">
            <video src="${v.videoUrl}" controls style="width: 100%; height: 120px; border-radius: 8px; object-fit: cover;"></video>
            <p style="font-weight: bold; margin: 5px 0 2px; color: #fff;">${escapeHtml(v.title || 'Untitled')}</p>
          </div>`;
      });
    }

    // 3. Render Profile (Owner view gets action buttons + editable picture)
    profileContainer.innerHTML = `
      <div style="padding: 20px; color: #fff;">
        <div style="display: flex; align-items: center; gap: 20px; margin-bottom: 20px;">
          <!-- Profile Picture (Editable only for channel owner) -->
          <div style="position: relative;">
            <img id="profile-avatar-img" src="${avatarUrl}" style="width: 110px; height: 110px; border-radius: 50%; object-fit: cover; border: 2px solid #333;" />
            ${isOwner ? `
              <button onclick="document.getElementById('avatar-file-input').click()" style="position: absolute; bottom: 0; right: 0; background: #0088ff; border: none; color: #fff; border-radius: 50%; width: 32px; height: 32px; cursor: pointer;" title="Change Picture">📷</button>
              <input type="file" id="avatar-file-input" accept="image/*" style="display:none;" onchange="uploadProfilePicture(event, '${targetUid}')" />
            ` : ''}
          </div>

          <div>
            <h2 style="margin: 0; font-size: 1.8rem;">${escapeHtml(displayName)}</h2>
            <p style="margin: 4px 0; color: #aaa;">${escapeHtml(handle)}</p>
            <p style="margin: 4px 0; color: #ddd; font-size: 0.9rem;">${escapeHtml(bio)}</p>

            <!-- Action Buttons: Show Customize/Manage buttons if owner, Subscribe button if viewer -->
            <div style="margin-top: 12px; display: flex; gap: 10px;">
              ${isOwner ? `
                <button onclick="editChannelDetails()" style="padding: 8px 16px; background: #333; color: #fff; border: 1px solid #555; border-radius: 20px; cursor: pointer;">Customize channel</button>
                <button onclick="manageVideos()" style="padding: 8px 16px; background: #333; color: #fff; border: 1px solid #555; border-radius: 20px; cursor: pointer;">Manage videos</button>
              ` : `
                <button onclick="toggleSubscribe('${targetUid}')" style="padding: 8px 18px; background: #cc0000; color: #fff; border: none; border-radius: 20px; font-weight: bold; cursor: pointer;">Subscribe</button>
              `}
            </div>
          </div>
        </div>

        <hr style="border-color: #333; margin: 20px 0;" />

        <!-- Videos Section -->
        <div>
          <h3>Uploaded Videos</h3>
          <div style="display: flex; flex-wrap: wrap;">${videoCardsHtml}</div>
        </div>
      </div>
    `;

  } catch (err) {
    console.error("Error opening profile:", err);
    profileContainer.innerHTML = `<p style="color: #ff5555;">Error loading profile: ${err.message}</p>`;
  }
}

// Upload and Update Profile Picture (Owner only)
async function uploadProfilePicture(event, uid) {
  const file = event.target.files[0];
  if (!file) return;

  try {
    // 1. Upload file to Supabase Storage
    const fileName = `avatars/${uid}_${Date.now()}`;
    const { data, error } = await supabase.storage.from('streamkids-videos').upload(fileName, file);

    if (error) throw error;

    const { data: publicUrlData } = supabase.storage.from('streamkids-videos').getPublicUrl(fileName);
    const newAvatarUrl = publicUrlData.publicUrl;

    // 2. Save image URL to Firestore user document
    await firebase.firestore().collection('users').doc(uid).set({
      avatarUrl: newAvatarUrl
    }, { merge: true });

    // 3. Update DOM avatar image element directly
    const imgElem = document.getElementById('profile-avatar-img');
    if (imgElem) imgElem.src = newAvatarUrl;

    alert("Profile picture updated successfully!");
  } catch (err) {
    console.error("Failed to update profile picture:", err);
    alert("Failed to upload image: " + err.message);
  }
}

// Placeholder functions for profile actions
function editChannelDetails() {
  alert("Customize Channel panel coming soon!");
}

function manageVideos() {
  alert("Manage Videos panel coming soon!");
}

function toggleSubscribe(targetUid) {
  alert("Subscribed to channel!");
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
