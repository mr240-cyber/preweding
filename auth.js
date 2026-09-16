document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  const registerForm = document.getElementById('registerForm');
  const auth = window.auth;
  const db = window.db;

  // On page load, if user is already logged in, redirect to booking
  if (auth) {
    auth.onAuthStateChanged((user) => {
      if (user) {
        // Automatically redirect to booking if logged in
        // Optional: you can redirect to dashboard instead
        const urlParams = new URLSearchParams(window.location.search);
        const returnUrl = urlParams.get('returnUrl') || '/booking.html';
        window.location.href = returnUrl;
      }
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value;
      const password = document.getElementById('loginPassword').value;
      const btn = loginForm.querySelector('button');
      const originalText = btn.textContent;

      btn.textContent = 'Memeriksa...';
      btn.disabled = true;

      try {
        await auth.signInWithEmailAndPassword(email, password);
        // auth listener will handle redirect
      } catch (error) {
        alert('Gagal masuk: ' + error.message);
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }

  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('registerName').value;
      const email = document.getElementById('registerEmail').value;
      const password = document.getElementById('registerPassword').value;
      const btn = registerForm.querySelector('button');
      const originalText = btn.textContent;

      btn.textContent = 'Mendaftar...';
      btn.disabled = true;

      try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        const user = userCredential.user;
        
        // Update profile with name
        await user.updateProfile({
          displayName: name
        });

        // Optionally, save user data to firestore
        if (db) {
          await db.collection('users').doc(user.uid).set({
            name: name,
            email: email,
            createdAt: firebase.firestore.FieldValue.serverTimestamp()
          });
        }
        
        // auth listener will handle redirect
      } catch (error) {
        alert('Gagal mendaftar: ' + error.message);
        btn.textContent = originalText;
        btn.disabled = false;
      }
    });
  }
});
