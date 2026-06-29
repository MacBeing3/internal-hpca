// ── Add stock ───────────────────────────────────────────────────────────────
// Records a stock addition into the same "Dispensation" sheet used by
// dispensation.js, via the same Apps Script (APPS_SCRIPT_URL, action 'append').
// The row is flagged in column A with 'TRUE' (IsAddition) so the sheet's own
// formulas can treat additions as +qty and dispensations as -qty.
//
// Reuses helpers from dispensation.js: makeSelGroup, getProductByPDF,
// parsePrixUnit, showToast, APPS_SCRIPT_URL, and the global `products` list.

// Toggle the visible fields for the chosen mode ('existing' | 'new').
function setAddMode(mode) {
  document.getElementById('add-existing-section').style.display = mode === 'existing' ? 'block' : 'none';
  document.getElementById('add-new-section').style.display      = mode === 'new'      ? 'block' : 'none';
}

// Build the cascading product -> dose -> format selects for an existing med.
function buildAddExistingRow() {
  var container = document.getElementById('add-existing-row');
  if (!container) return;
  container.innerHTML = '';

  var prod = makeSelGroup(tr('lblMedProduct'), 'add-sel-product', tr('selectMedProduct'));
  var dose = makeSelGroup(tr('lblMedDose'),    'add-sel-dose',    tr('selectMedDose'));
  var fmt  = makeSelGroup(tr('lblMedFormat'),  'add-sel-format',  tr('selectMedFormat'));
  dose.sel.disabled = true;
  fmt.sel.disabled  = true;

  var priceTag = document.createElement('span');
  priceTag.className = 'unit-price-tag';

  // Unique, sorted product names from the loaded inventory.
  var names = [];
  products.forEach(function (p) { if (names.indexOf(p.product) === -1) names.push(p.product); });
  names.sort().forEach(function (n) {
    var o = document.createElement('option'); o.value = n; o.textContent = n; prod.sel.appendChild(o);
  });

  prod.sel.addEventListener('change', function () {
    dose.sel.innerHTML = ''; fmt.sel.innerHTML = '';
    var dd = document.createElement('option'); dd.value = ''; dd.textContent = tr('selectMedDose');   dose.sel.appendChild(dd);
    var df = document.createElement('option'); df.value = ''; df.textContent = tr('selectMedFormat'); fmt.sel.appendChild(df);
    dose.sel.disabled = !prod.sel.value;
    fmt.sel.disabled  = true;
    priceTag.textContent = '';
    if (!prod.sel.value) return;

    var doses = [];
    products.forEach(function (p) {
      if (p.product === prod.sel.value && doses.indexOf(p.dose) === -1) doses.push(p.dose);
    });
    doses.forEach(function (d) {
      var o = document.createElement('option'); o.value = d; o.textContent = d || '—'; dose.sel.appendChild(o);
    });
    if (doses.length === 1) { dose.sel.value = doses[0]; dose.sel.dispatchEvent(new Event('change')); }
  });

  dose.sel.addEventListener('change', function () {
    fmt.sel.innerHTML = '';
    var df = document.createElement('option'); df.value = ''; df.textContent = tr('selectMedFormat'); fmt.sel.appendChild(df);
    fmt.sel.disabled = !dose.sel.value;
    priceTag.textContent = '';
    if (!dose.sel.value) return;

    var fmts = [];
    products.forEach(function (p) {
      if (p.product === prod.sel.value && p.dose === dose.sel.value && fmts.indexOf(p.format) === -1) fmts.push(p.format);
    });
    fmts.forEach(function (f) {
      var o = document.createElement('option'); o.value = f; o.textContent = f || '—'; fmt.sel.appendChild(o);
    });
    if (fmts.length === 1) { fmt.sel.value = fmts[0]; fmt.sel.dispatchEvent(new Event('change')); }
  });

  fmt.sel.addEventListener('change', function () {
    var p   = getProductByPDF(prod.sel.value, dose.sel.value, fmt.sel.value);
    var raw = p ? p.prixUnit || '' : '';
    priceTag.textContent = raw ? tr('lblUnitPrice') + ' ' + raw : '';
  });

  container.appendChild(prod.wrap);
  container.appendChild(dose.wrap);
  container.appendChild(fmt.wrap);
  container.appendChild(priceTag);
}

function resetAddForm() {
  var q = document.getElementById('add-qty'); if (q) q.value = '1';
  ['add-new-product', 'add-new-dose', 'add-new-format', 'add-new-price'].forEach(function (id) {
    var el = document.getElementById(id); if (el) el.value = '';
  });
  buildAddExistingRow();
}

function submitAddStock() {
  var modeEl = document.querySelector('input[name="add-mode"]:checked');
  var mode   = modeEl ? modeEl.value : 'existing';
  var qty    = parseInt(document.getElementById('add-qty').value, 10) || 0;
  if (qty <= 0) { showToast(tr('addToastQty'), 'error'); return; }

  var product, dose, format, unitPrice;

  if (mode === 'existing') {
    var prodSel = document.querySelector('.add-sel-product');
    var doseSel = document.querySelector('.add-sel-dose');
    var fmtSel  = document.querySelector('.add-sel-format');
    if (!prodSel || !prodSel.value) { showToast(tr('addToastSelect'), 'error'); return; }
    product = prodSel.value;
    dose    = doseSel ? doseSel.value : '';
    format  = fmtSel  ? fmtSel.value  : '';
    // Require a real product-dose-format match (dose/format must be chosen when
    // the product has several options), so the addition is linkable to a product.
    var p   = getProductByPDF(product, dose, format);
    if (!p) { showToast(tr('toastSpecify'), 'error'); return; }
    var up  = parsePrixUnit(p ? p.prixUnit : '');
    unitPrice = up !== null ? up : '';
  } else {
    product = (document.getElementById('add-new-product').value || '').trim();
    dose    = (document.getElementById('add-new-dose').value    || '').trim();
    format  = (document.getElementById('add-new-format').value  || '').trim();
    var np  = parsePrixUnit(document.getElementById('add-new-price').value);
    unitPrice = np !== null ? np : '';
    if (!product) { showToast(tr('addToastProduct'), 'error'); return; }
  }

  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var time = pad(now.getHours()) + ':' + pad(now.getMinutes());

  // Dispensation sheet schema (11 cols): A IsAddition, B Dossier, C Date, D Time,
  // E Product, F Dose, G Format, H UnitPrice, I Qty, J LineTotal, K Forfait.
  var row = ['TRUE', '', date, time, product, dose, format, unitPrice, qty, '', 'FALSE'];

  var btn = document.getElementById('btn-add-submit');
  btn.disabled = true;
  // Writes as the signed-in user (Sheets API), so the addition is attributed to
  // them in the sheet's version history. Helper lives in dispensation.js.
  appendRowsToSheet([row], function (ok) {
    if (ok) {
      showToast(tr('addToastSuccess'), 'success');
      resetAddForm();
      loadInventory();
      loadHistorique();
    } else {
      showToast(tr('addToastError'), 'error');
    }
    btn.disabled = false;
  });
}
