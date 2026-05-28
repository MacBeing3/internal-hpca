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
  google.accounts.id.initialize({
    client_id: GOOGLE_CLIENT_ID,
    callback:  handleIdToken,
    auto_select: true  // silently re-authenticates returning users
  });

  tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: GOOGLE_CLIENT_ID,
    scope: 'https://www.googleapis.com/auth/spreadsheets email profile',
    callback: handleTokenResponse
  });

  google.accounts.id.renderButton(
    document.getElementById('g-signin-btn'),
    { theme: 'outline', size: 'large', text: 'signin_with', locale: 'fr' }
  );

  // Show sign-in prompt
  google.accounts.id.prompt();
});

// ── Step 1: ID token callback (tells us who the user is) ─────────────────────
function handleIdToken(response) {
  // Decode the JWT payload (no verification needed client-side; server validates)
  var payload = JSON.parse(atob(response.credential.split('.')[1]));
  var email   = payload.email;

  if (!isAllowed(email)) {
    document.getElementById('auth-error').style.display = 'block';
    return;
  }

  currentUser = { email: email, name: payload.name, picture: payload.picture };
  updateUserUI();

  // Step 2: Request an access token for API calls
  tokenClient.requestAccessToken({ prompt: '' });
}

// ── Step 2: Access token callback (lets us call the Sheets API) ───────────────
function handleTokenResponse(response) {
  if (response.error) {
    console.error('Token error:', response.error);
    return;
  }
  accessToken = response.access_token;
  tokenExpiry  = Date.now() + (response.expires_in - 60) * 1000; // refresh 1 min early
  hideAuthOverlay();
  // Kick off initial data load
  loadInventory();
  loadHistorique();
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