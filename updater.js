// ── Auto-update checker ───────────────────────────────────────────────────────
// This app is a static site deployed from the `main` branch to GitHub Pages, so
// there's no server to push updates. Instead we poll GitHub's commits API for the
// latest SHA on `main`; when it differs from the SHA that was current when the page
// loaded, a newer version has been deployed.
//
// Polling is cheap: we send a conditional request (If-None-Match with the stored
// ETag). When nothing changed GitHub returns 304, which does NOT count against the
// unauthenticated rate limit — so 15-minute polling stays comfortably within limits
// even with many users behind one hospital IP.
//
// On update we never destroy in-progress work: we show a non-blocking banner with a
// Recharger button and auto-reload only when the user isn't mid-entry on a data-entry
// page (see isSafeToReload). Depends on the `currentPage` global from main.js, so this
// script must load AFTER main.js.

var UPDATE_REPO     = 'MacBeing3/internal-hpca';
var UPDATE_BRANCH   = 'main';
var UPDATE_INTERVAL = 15 * 60 * 1000;   // 15 minutes
var UPDATE_MIN_GAP  = 5  * 60 * 1000;   // throttle: min time between checks (focus spam)

(function () {
  // Skip on local/dev hosts — auto-reload only makes sense against the live site.
  var host = location.hostname;
  if (host === 'localhost' || host === '127.0.0.1' || host === '' || location.protocol === 'file:') return;

  var apiUrl      = 'https://api.github.com/repos/' + UPDATE_REPO + '/commits/' + UPDATE_BRANCH;
  var baselineSha = null;    // the running version's SHA (set on first successful check)
  var etag        = null;    // for conditional requests
  var lastCheck   = 0;       // timestamp of the last network check (for throttling)
  var handled     = false;   // an update has been detected and is being handled

  function check() {
    var now = Date.now();
    if (now - lastCheck < UPDATE_MIN_GAP) return;   // throttle rapid re-checks
    lastCheck = now;

    var headers = { 'Accept': 'application/vnd.github.sha' };  // response body = the SHA, as text
    if (etag) headers['If-None-Match'] = etag;

    fetch(apiUrl, { headers: headers, cache: 'no-store' })
      .then(function (res) {
        if (res.status === 304) return null;                 // unchanged
        var e = res.headers.get('ETag'); if (e) etag = e;
        return res.ok ? res.text() : null;
      })
      .then(function (sha) {
        if (!sha) return;
        sha = sha.trim();
        if (!baselineSha) { baselineSha = sha; return; }     // first run records running version
        if (sha !== baselineSha && !handled) onUpdateAvailable();
      })
      .catch(function () { /* offline or transient — ignore, try again next tick */ });
  }

  function onUpdateAvailable() {
    handled = true;
    if (isSafeToReload()) { reloadNow(); return; }
    // Not safe right now: show the banner and keep watching, so we reload
    // automatically the moment the user finishes / leaves the form.
    showBanner();
    var t = setInterval(function () {
      if (isSafeToReload()) { clearInterval(t); reloadNow(); }
    }, 30 * 1000);
  }

  // "Safe" = nothing half-entered that a reload would discard. Read-only pages
  // (inventory, forfait, formulaire, historique) are always safe. On the data-entry
  // pages we treat any non-empty text/number/select value as unsaved work; radios and
  // checkboxes are ignored (they carry defaults, not typed data). This errs toward
  // safety: when in doubt we keep the banner and wait for the user to click.
  function isSafeToReload() {
    var entryPages = ['dispensation', 'ajouter', 'mouvement', 'modification'];
    if (typeof currentPage === 'undefined' || entryPages.indexOf(currentPage) === -1) return true;
    var page = document.getElementById('page-' + currentPage);
    if (!page) return true;
    var fields = page.querySelectorAll('input, textarea, select');
    for (var i = 0; i < fields.length; i++) {
      var el = fields[i];
      if (el.type === 'radio' || el.type === 'checkbox') continue;
      if ((el.value || '').trim() !== '') return false;
    }
    return true;
  }

  function reloadNow() { location.reload(); }

  function showBanner() {
    if (document.getElementById('update-banner')) return;
    var bar = document.createElement('div');
    bar.id = 'update-banner';
    bar.innerHTML =
      '<span>Une nouvelle version est disponible.</span>' +
      '<button id="update-reload-btn" type="button">Recharger</button>';
    document.body.appendChild(bar);
    document.getElementById('update-reload-btn').addEventListener('click', reloadNow);
  }

  // Record the baseline immediately, then poll on a timer and whenever the tab
  // regains focus (throttled) so a returning user picks up updates promptly.
  check();
  setInterval(check, UPDATE_INTERVAL);
  window.addEventListener('focus', check);
})();
