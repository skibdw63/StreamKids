let num1, num2, correctAnswer;

function showTab(tab) {
  document.getElementById('section-gate').style.display = 'none';
  document.getElementById('section-feed').style.display = 'none';
  document.getElementById('section-dashboard').style.display = 'none';
  document.getElementById('section-' + tab).style.display = 'block';
}

function selectCountry(country) {
  num1 = Math.floor(Math.random() * 80) + 12;
  num2 = Math.floor(Math.random() * 8) + 2;
  correctAnswer = num1 * num2;
  document.getElementById('math-question').innerText = `Parents: What is ${num1} × ${num2}?`;
  document.getElementById('math-gate').style.display = 'block';
}

function checkMath() {
  if (parseInt(document.getElementById('math-answer').value) === correctAnswer) {
    document.getElementById('stat-status').innerText = "Verified Parent ✅";
    document.getElementById('stat-status').style.color = "#4caf50";
    alert("Parent verified!");
    showTab('feed');
  } else {
    alert("Incorrect answer.");
  }
}

function openSignup() { document.getElementById('signup-modal').style.display = 'block'; }
function closeSignup() { document.getElementById('signup-modal').style.display = 'none'; }

function registerUser() {
  const email = document.getElementById('parent-email').value;
  const pass = document.getElementById('parent-pass').value;

  auth.createUserWithEmailAndPassword(email, pass)
    .then((userCredential) => {
      return db.collection("users").doc(userCredential.user.uid).set({
        parent_email: email,
        parent_consented: true,
        created_at: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      alert("Account created and saved in Firebase!");
      closeSignup();
    })
    .catch((err) => {
      alert("Error: " + err.message);
    });
}
