// ── Mouvement (stock movement between Inventaire and Forfait) ──────────────────
// A movement writes TWO rows to the Dispensation sheet:
//   * a depense (A=FALSE) that removes stock from the SOURCE pool, and
//   * an ajouter (A=TRUE) that adds it to the DESTINATION pool.
// Column K (Forfait) marks the pool each row affects: TRUE = forfait stock,
// FALSE = inventaire stock. Prices follow the rule:
//   * Inventaire -> Forfait: the depense (leaving inventaire) is priced 0 — it is
//     "lost" stock; the ajouter keeps the noted price.
//   * Forfait -> Inventaire: both rows keep the noted price (inventaire gains value).
// Text is hardcoded in French (no translation wiring for this page).

var mvtDirection = 'inv2forf'; // 'inv2forf' = Inventaire -> Forfait, 'forf2inv' = reverse

// The source view (where the stock leaves from) for the current direction.
function mvtSourceView() { return mvtDirection === 'inv2forf' ? inventoryView : forfaitView; }
// The destination view / sheet tab (where the stock enters).
function mvtDestView()  { return mvtDirection === 'inv2forf' ? forfaitView : inventoryView; }
function mvtDestTab()   { return mvtDirection === 'inv2forf' ? SHEET_TAB_FORFAIT : SHEET_TAB; }

// Look up a product-dose-format match within a given products list.
function findInList(list, product, dose, format) {
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (p.product === product && p.dose === dose && p.format === format) return p;
  }
  return null;
}

function setMovementDirection(dir) {
  mvtDirection = dir;
  buildMovementRow();
  refreshMovementSource();
}

// Show the "load source first" notice if the source stock isn't loaded yet, and
// auto-load it (then rebuild the dropdown) so the user doesn't have to.
function refreshMovementSource() {
  var src = mvtSourceView();
  var dst = mvtDestView();
  if (!dst.loaded) dst.load();   // preload the destination for the submit-time existence check
  var notice = document.getElementById('mvt-no-data');
  var msg    = document.getElementById('mvt-no-data-msg');
  if (msg) {
    msg.textContent = mvtDirection === 'inv2forf'
      ? "Chargement de l'inventaire…"
      : 'Chargement du forfait…';
  }
  if (src.products.length) {
    if (notice) notice.style.display = 'none';
    return;
  }
  if (notice) notice.style.display = 'block';
  src.load(function () {
    if (notice) notice.style.display = src.products.length ? 'none' : 'block';
    if (msg && !src.products.length) {
      msg.textContent = mvtDirection === 'inv2forf'
        ? "Impossible de charger l'inventaire."
        : 'Impossible de charger le forfait.';
    }
    buildMovementRow();
  });
}

// Build the cascading product -> dose -> format dropdowns from the source stock.
function buildMovementRow() {
  var container = document.getElementById('mvt-row');
  if (!container) return;
  container.innerHTML = '';
  // You can only move FROM meds that are in stock (the destination check later
  // still uses the full list, so you can move TO a 0-stock med).
  var list = mvtSourceView().products.filter(hasStock);

  var prod = makeProductCombo('Produit', 'mvt-sel-product', '-- Produit --');
  var dose = makeSelGroup('Dose',    'mvt-sel-dose',    '-- Dose --');
  var fmt  = makeSelGroup('Format',  'mvt-sel-format',  '-- Format --');
  dose.sel.disabled = true;
  fmt.sel.disabled  = true;

  var priceTag = document.createElement('span');
  priceTag.className = 'unit-price-tag';

  var names = [];
  list.forEach(function (p) { if (names.indexOf(p.product) === -1) names.push(p.product); });
  prod.setOptions(names.sort());

  prod.onChange(function () {
    dose.sel.innerHTML = ''; fmt.sel.innerHTML = '';
    var dd = document.createElement('option'); dd.value = ''; dd.textContent = '-- Dose --';   dose.sel.appendChild(dd);
    var df = document.createElement('option'); df.value = ''; df.textContent = '-- Format --'; fmt.sel.appendChild(df);
    dose.sel.disabled = !prod.sel.value;
    fmt.sel.disabled  = true;
    priceTag.textContent = '';
    if (!prod.sel.value) return;

    var doses = [];
    list.forEach(function (p) {
      if (p.product === prod.sel.value && doses.indexOf(p.dose) === -1) doses.push(p.dose);
    });
    doses.forEach(function (d) {
      var o = document.createElement('option'); o.value = d; o.textContent = d || '—'; dose.sel.appendChild(o);
    });
    // Select by index (1 = first real option), so a single blank dose ('') selects
    // the real option rather than falling back to the placeholder.
    if (doses.length === 1) { dose.sel.selectedIndex = 1; dose.sel.dispatchEvent(new Event('change')); }
  });

  dose.sel.addEventListener('change', function () {
    fmt.sel.innerHTML = '';
    var df = document.createElement('option'); df.value = ''; df.textContent = '-- Format --'; fmt.sel.appendChild(df);
    // "Chosen" = a real option (index > 0), even a blank dose — so an empty dose
    // still enables the Format dropdown.
    var doseChosen = dose.sel.selectedIndex > 0;
    fmt.sel.disabled = !doseChosen;
    priceTag.textContent = '';
    if (!doseChosen) return;

    var fmts = [];
    list.forEach(function (p) {
      if (p.product === prod.sel.value && p.dose === dose.sel.value && fmts.indexOf(p.format) === -1) fmts.push(p.format);
    });
    fmts.forEach(function (f) {
      var o = document.createElement('option'); o.value = f; o.textContent = f || '—'; fmt.sel.appendChild(o);
    });
    if (fmts.length === 1) { fmt.sel.selectedIndex = 1; fmt.sel.dispatchEvent(new Event('change')); }
  });

  fmt.sel.addEventListener('change', function () {
    var p   = findInList(list, prod.sel.value, dose.sel.value, fmt.sel.value);
    var raw = p ? p.prixUnit || '' : '';
    priceTag.textContent = raw ? 'Prix/u : ' + raw : '';
  });

  container.appendChild(prod.wrap);
  container.appendChild(dose.wrap);
  container.appendChild(fmt.wrap);
  container.appendChild(priceTag);
}

function submitMovement() {
  var list = mvtSourceView().products;
  if (!list.length) { showToast('Chargez d\'abord le stock source.', 'error'); return; }

  var prodSel = document.querySelector('.mvt-sel-product');
  var doseSel = document.querySelector('.mvt-sel-dose');
  var fmtSel  = document.querySelector('.mvt-sel-format');
  if (!prodSel || !prodSel.value) { showToast('Veuillez sélectionner un médicament.', 'error'); return; }

  var p = findInList(list, prodSel.value, doseSel ? doseSel.value : '', fmtSel ? fmtSel.value : '');
  if (!p) { showToast('Veuillez préciser la dose et le format.', 'error'); return; }

  var qty = parseInt(document.getElementById('mvt-qty').value, 10) || 0;
  if (qty <= 0) { showToast('Veuillez saisir une quantité valide.', 'error'); return; }

  var btn = document.getElementById('btn-mvt-submit');
  btn.disabled = true;

  // Need the destination stock loaded to know whether the med already exists there.
  var dest = mvtDestView();
  if (dest.loaded) finishMovement(p, qty, btn);
  else dest.load(function () { finishMovement(p, qty, btn); });
}

// Inventaire row (A:T) for a med that must be created in the destination stock.
// Metadata is copied from the source med; Stock initial = 0 and ledger/computed
// columns are blank — the quantity comes from the ajouter transaction.
function buildDestInvRow(m) {
  var v = function (key) { var x = m[key]; return (x === '' || x === null || x === undefined) ? '' : x; };
  return [
    v('category'), v('code'), v('product'), v('dose'), v('format'), v('dateExp'),
    0, v('pa'), v('prixUnit'), '', '', '', '', '', '', v('quantMin'), '',
    v('etatsUnis'), v('essentiel'), v('famille')
  ];
}

function finishMovement(p, qty, btn) {
  var product = p.product, dose = p.dose, format = p.format;
  var notedPrice = parsePrixUnit(p.prixUnit);
  if (notedPrice === null) notedPrice = '';

  var toForfait = (mvtDirection === 'inv2forf');
  // Column K (Forfait): the row touching the forfait pool = 'TRUE', inventaire = 'FALSE'.
  var sourceForfait = toForfait ? 'FALSE' : 'TRUE'; // depense leaves the source pool
  var destForfait   = toForfait ? 'TRUE'  : 'FALSE'; // ajouter enters the destination pool

  // Depense price: 0 only when leaving Inventaire toward Forfait ("lost" stock).
  var depensePrice = toForfait ? 0 : notedPrice;
  var depenseTotal = (depensePrice === '') ? '' : depensePrice * qty;
  var ajouterTotal = (notedPrice === '')  ? '' : notedPrice * qty;

  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var date   = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var time   = pad(now.getHours()) + ':' + pad(now.getMinutes());
  var caisse = cashDateStr();

  // Schema (12 cols): A IsAddition, B Dossier, C Date de Caisse, D Date, E Time,
  // F Product, G Dose, H Format, I UnitPrice, J Qty, K LineTotal, L Forfait.
  var depenseRow = ['FALSE', '', caisse, date, time, product, dose, format, depensePrice, qty, depenseTotal, sourceForfait];
  var ajouterRow = ['TRUE',  '', caisse, date, time, product, dose, format, notedPrice,   qty, ajouterTotal, destForfait];

  var tasks = [ { id: DISP_SHEET_ID, tab: DISP_SHEET_TAB, rows: [depenseRow, ajouterRow] } ];

  // If the med doesn't exist in the destination stock, create it there (like a new
  // medication) so the ajouter transaction has a row to aggregate against. Only do
  // this when the destination is confirmed loaded, to avoid creating a duplicate.
  var dest = mvtDestView();
  var newRowCreated = dest.loaded && !findInList(dest.products, product, dose, format);
  if (newRowCreated) {
    tasks.push({ id: SHEET_ID, tab: mvtDestTab(), rows: [ buildDestInvRow(p) ] });
  }

  var user      = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.email : '';
  var direction = toForfait ? 'Inventaire → Forfait' : 'Forfait → Inventaire';
  // Log row: Date, Heure, Utilisateur, Direction, Produit, Dose, Format, Quantité, Nouvelle ligne.
  var logRow = [date, time, user, direction, product, dose, format, qty, newRowCreated ? 'TRUE' : 'FALSE'];

  runAppends(tasks, function (ok, reason) {
    if (!ok) {
      showToast(reason === 'forbidden' ? MSG_NO_WRITE_ACCESS : 'Erreur lors du mouvement. Veuillez réessayer.', 'error');
      btn.disabled = false;
      return;
    }
    // Movement applied — now record it in the Mouvements log.
    appendMvtLog(logRow, function (ok2, reason2) {
      if (ok2) {
        showToast('Mouvement enregistré avec succès.', 'success');
      } else {
        showToast(reason2 === 'forbidden' ? MSG_NO_WRITE_ACCESS
          : 'Mouvement appliqué, mais le journal a échoué (vérifiez l\'onglet « Mouvements »).', 'error');
      }
      document.getElementById('mvt-qty').value = '1';
      loadInventory();
      loadForfait();
      loadHistorique();
      buildMovementRow();
      btn.disabled = false;
    });
  });
}

// ── Mouvements audit log (a tab in the Dispensation sheet) ──
var MVT_LOG_HEADER = ['Date', 'Heure', 'Utilisateur', 'Direction', 'Produit', 'Dose', 'Format', 'Quantité', 'Nouvelle ligne'];

// Append a movement log row, writing the header first if the tab is empty.
function appendMvtLog(logRow, callback) {
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + DISP_SHEET_ID +
            '/values/' + encodeURIComponent('Mouvements');
  ensureFreshToken(function () {
    authFetch(url)
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        var hasRows  = r.ok && r.data && r.data.values && r.data.values.length > 0;
        var toAppend = hasRows ? [logRow] : [MVT_LOG_HEADER, logRow];
        appendValues(DISP_SHEET_ID, 'Mouvements', toAppend, callback);
      })
      .catch(function () { appendValues(DISP_SHEET_ID, 'Mouvements', [logRow], callback); });
  });
}
