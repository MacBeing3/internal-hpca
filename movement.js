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
  var list = mvtSourceView().products;

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

  var product = prodSel.value;
  var dose    = doseSel ? doseSel.value : '';
  var format  = fmtSel  ? fmtSel.value  : '';
  var p = findInList(list, product, dose, format);
  if (!p) { showToast('Veuillez préciser la dose et le format.', 'error'); return; }

  var qty = parseInt(document.getElementById('mvt-qty').value, 10) || 0;
  if (qty <= 0) { showToast('Veuillez saisir une quantité valide.', 'error'); return; }

  var notedPrice = parsePrixUnit(p.prixUnit);
  if (notedPrice === null) notedPrice = '';

  var toForfait = (mvtDirection === 'inv2forf');

  // Column K (Forfait): the row touching the forfait pool = 'TRUE', inventaire = 'FALSE'.
  var sourceForfait = toForfait ? 'FALSE' : 'TRUE'; // depense leaves the source pool
  var destForfait   = toForfait ? 'TRUE'  : 'FALSE'; // ajouter enters the destination pool

  // Depense price: 0 only when leaving Inventaire toward Forfait ("lost" stock).
  var depensePrice = toForfait ? 0 : notedPrice;
  var depenseTotal = (depensePrice === '' ) ? '' : depensePrice * qty;
  // Ajouter always keeps the noted price; its line total is price x qty.
  var ajouterTotal = (notedPrice === '') ? '' : notedPrice * qty;

  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var time = pad(now.getHours()) + ':' + pad(now.getMinutes());

  // Schema (11 cols): A IsAddition, B Dossier, C Date, D Time, E Product, F Dose,
  // G Format, H UnitPrice, I Qty, J LineTotal, K Forfait.
  var depenseRow = ['FALSE', '', date, time, product, dose, format, depensePrice, qty, depenseTotal, sourceForfait];
  var ajouterRow = ['TRUE',  '', date, time, product, dose, format, notedPrice,   qty, ajouterTotal, destForfait];

  var btn = document.getElementById('btn-mvt-submit');
  btn.disabled = true;
  appendRowsToSheet([depenseRow, ajouterRow], function (ok, reason) {
    if (ok) {
      showToast('Mouvement enregistré avec succès.', 'success');
      document.getElementById('mvt-qty').value = '1';
      // Reload both stocks (and history) so balances reflect the movement.
      loadInventory();
      loadForfait();
      loadHistorique();
      buildMovementRow();
    } else {
      showToast(reason === 'forbidden' ? MSG_NO_WRITE_ACCESS : 'Erreur lors du mouvement. Veuillez réessayer.', 'error');
    }
    btn.disabled = false;
  });
}
