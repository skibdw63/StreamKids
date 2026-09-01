let targetMathAnswer = 0;

// Generate Math Gate Problem
function generateMathGate() {
  const num1 = Math.floor(Math.random() * 20) + 5;
  const num2 = Math.floor(Math.random() * 20) + 5;
  targetMathAnswer = num1 * num2;
  
  const questionEl = document.getElementById('math-question');
  if (questionEl) {
    questionEl.innerText = `What is ${num1} × ${num2}?`;
  }
}

// Verify Math Gate Result
function verifyParentMath() {
  const inputEl = document.getElementById('math-answer');
  const userAns = parseInt(inputEl.value, 10);

  if (userAns === targetMathAnswer) {
    document.getElementById('math-gate').classList.add('hidden');
    document.getElementById('firebase-auth-form').classList.remove('hidden');
  } else {
    alert("Incorrect answer. Please try again.");
    generateMathGate();
  }
}

// Parent Registration
function handleSignUp() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const country = document.getElementById('user-country').value;
  const statusEl = document.getElementById('auth-status');

  if (!email || !password) {
    statusEl.style.color = 'red';
    statusEl.innerText = 'Please provide both email and password.';
    return;
  }

  if (!country) {
    statusEl.style.color = 'red';
    statusEl.innerText = 'Please select where you are from!';
    return;
  }

  auth.createUserWithEmailAndPassword(email, password)
    .then((userCredential) => {
      // Save country location alongside parent verification in Firestore
      return db.collection('users').doc(userCredential.user.uid).set({
        email: email,
        country: country,
        parentConsentVerified: true,
        createdAt: firebase.firestore.FieldValue.serverTimestamp()
      });
    })
    .then(() => {
      statusEl.style.color = 'green';
      statusEl.innerText = 'Parent Account successfully created and verified!';
    })
    .catch((error) => {
      statusEl.style.color = 'red';
      statusEl.innerText = error.message;
    });
}

// Parent Login
function handleLogin() {
  const email = document.getElementById('auth-email').value;
  const password = document.getElementById('auth-password').value;
  const statusEl = document.getElementById('auth-status');

  if (!email || !password) {
    statusEl.style.color = 'red';
    statusEl.innerText = 'Please enter your email and password.';
    return;
  }

  auth.signInWithEmailAndPassword(email, password)
    .then(() => {
      statusEl.style.color = 'green';
      statusEl.innerText = 'Logged in successfully!';
    })
    .catch((error) => {
      statusEl.style.color = 'red';
      statusEl.innerText = error.message;
    });
}

// Run math problem setup on startup
document.addEventListener('DOMContentLoaded', generateMathGate);
