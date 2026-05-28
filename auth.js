// ── Auth config ───────────────────────────────────────────────────────────────
var GOOGLE_CLIENT_ID = '914714046695-0lpbvj12n5jlofd9hrlcvl9mfrsupchb.apps.googleusercontent.com';

// Whitelist of emails allowed to access the app
var ALLOWED_EMAILS = [
  'cmcainformatique@gmail.com',
  'brettmalitogo@gmail.com'
  // add more as needed
];

// ── State ─────────────────────────────────────────────────────────────────────
var accessToken   = null;
var tokenExpiry   = null;
var currentUser   = null;
var tokenClient   = null;

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('load', function () {
  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets email profile openid',
    callback: handleTokenResponse
  });

  // Wire up your sign-in button to this
  document.getElementById('g-signin-btn').addEventListener('click', function () {
    tokenClient.requestAccessToken();
  });
});



// ── Step 2: Access token callback (lets us call the Sheets API) ───────────────
function handleTokenResponse(response) {
  if (response.error) {
    console.error('Token error:', response.error);
    return;
  }
  accessToken = response.access_token;
  tokenExpiry  = Date.now() + (response.expires_in - 60) * 1000;

  // Single call to get user identity — replaces handleIdToken entirely
  fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { 'Authorization': 'Bearer ' + accessToken }
  })
  .then(function (res) { return res.json(); })
  .then(function (info) {
    if (!isAllowed(info.email)) {
      document.getElementById('auth-error').style.display = 'block';
      accessToken = null;
      return;
    }
    currentUser = { email: info.email, name: info.name, picture: info.picture };
    updateUserUI();
    hideAuthOverlay();
    loadInventory();
    loadHistorique();
  });
}

// ── Token refresh ─────────────────────────────────────────────────────────────
function ensureFreshToken(callback) {
  if (accessToken && Date.now() < tokenExpiry) {
    callback();
    return;
  }
  // Token expired — get a new one silently
  tokenClient.requestAccessToken({ prompt: '' });
  // Re-queue the callback; the token response handler will trigger loads
  // For simplicity, just reload after a short delay
  setTimeout(callback, 1500);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function isAllowed(email) {
  return ALLOWED_EMAILS.indexOf(email.toLowerCase()) !== -1;
}

function hideAuthOverlay() {
  document.getElementById('auth-overlay').style.display = 'none';
}

function updateUserUI() {
  if (!currentUser) return;
  document.getElementById('user-email').textContent  = currentUser.email;
  document.getElementById('btn-signout').style.display = 'inline-block';
  if (currentUser.picture) {
    var img = document.getElementById('user-avatar');
    img.src = currentUser.picture;
    img.style.display = 'inline-block';
  }
}

function signOut() {
  google.accounts.id.disableAutoSelect();
  accessToken = null;
  currentUser = null;
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('auth-error').style.display   = 'none';
  document.getElementById('btn-signout').style.display  = 'none';
  document.getElementById('user-avatar').style.display  = 'none';
  document.getElementById('user-email').textContent     = '';
}

// ── Authenticated fetch wrapper ───────────────────────────────────────────────
function authFetch(url, options) {
  options = options || {};
  options.headers = options.headers || {};
  options.headers['Authorization'] = 'Bearer ' + accessToken;
  return fetch(url, options);
}