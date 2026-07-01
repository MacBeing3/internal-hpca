

// Append rows to ANY spreadsheet/tab using the SIGNED-IN USER's OAuth token
// (granted at login via the 'spreadsheets' scope). Because the write is made with
// the user's own credentials, the edit is attributed to THEM in version history.
// Requires each allowed user to have Editor access to the target spreadsheet.
function appendValues(spreadsheetId, tab, rows, callback) {
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId +
            '/values/' + encodeURIComponent(tab) +
            '!A1:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS';
  ensureFreshToken(function () {
    authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ values: rows })
    })
      .then(function (res) {
        // Success is determined by the HTTP status alone — don't require the
        // body to parse (a parse hiccup must not masquerade as a failed write).
        // 403 means the user has read-only access to the sheet -> 'forbidden'.
        if (res.ok) { callback(true, ''); return; }
        return res.text().then(function (t) {
          console.error('Sheets append failed:', res.status, t);
          callback(false, res.status === 403 ? 'forbidden' : 'error');
        });
      })
      .catch(function (err) {
        console.error('Sheets append error:', err);
        callback(false, 'error');
      });
  });
}

// Shown when a write is rejected because the signed-in user only has read access.
var MSG_NO_WRITE_ACCESS = "Accès refusé : vous n'avez pas les droits d'écriture sur la feuille. Contactez l'administrateur pour obtenir un accès « Éditeur ».";

// Convenience wrapper: append transaction rows to the Dispensation sheet.
// DISP_SHEET_ID / DISP_SHEET_TAB are defined in historique.js (available at call time).
function appendRowsToSheet(rows, callback) {
  appendValues(DISP_SHEET_ID, DISP_SHEET_TAB, rows, callback);
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function parsePrixUnit(raw) {
  var n = parseFloat((raw || '').toString().replace(/[^0-9.,]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

function getProductByPDF(product, dose, format) {
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    if (p.product === product && p.dose === dose && p.format === format) return p;
  }
  return null;
}

// A dispensation line draws from the forfait stock when its Forfaitaire box is
// checked, otherwise from the normal stock. `products` is the normal (inventory)
// list; forfaitView.products is the forfait list.
function rowProducts(forfChecked) { return forfChecked ? forfaitView.products : products; }

function lookupIn(list, product, dose, format) {
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (p.product === product && p.dose === dose && p.format === format) return p;
  }
  return null;
}

// ── Total section ─────────────────────────────────────────────────────────────
function updateTotal() {
  var container = document.getElementById('med-rows');
  var medRows   = container.children;
  var lines     = [];
  var grand     = 0;
  var hasPrice  = false;

  for (var i = 0; i < medRows.length; i++) {
    var selProd = medRows[i].querySelector('.sel-product');
    var selDose = medRows[i].querySelector('.sel-dose');
    var selFmt  = medRows[i].querySelector('.sel-format');
    var qty     = medRows[i].querySelector('.med-qty');
    var forf    = medRows[i].querySelector('.med-forfait');

    if (!selProd || !selProd.value) continue;

    var p         = lookupIn(rowProducts(forf.checked), selProd.value, selDose ? selDose.value : '', selFmt ? selFmt.value : '');
    var rawPrice  = p ? p.prixUnit || '' : '';
    var unitVal   = parsePrixUnit(rawPrice);
    var qtyVal    = parseInt(qty.value) || 0;
    var label     = selProd.value +
                    (selDose && selDose.value ? ' ' + selDose.value : '') +
                    (selFmt  && selFmt.value  ? ' (' + selFmt.value + ')' : '');

    if (unitVal !== null) {
      var lineTotal = unitVal * qtyVal;
      if(forf.checked){lineTotal=0;}
      grand += lineTotal;
      hasPrice = true;
      lines.push({ name: label, qty: qtyVal, total: lineTotal });
    } else {
      lines.push({ name: label, qty: qtyVal, total: null });
    }
  }

  var totalSection = document.getElementById('total-section');
  if (lines.length === 0) { totalSection.style.display = 'none'; return; }

  totalSection.style.display = 'block';
  var html = '';
  lines.forEach(function(l) {
    html += '<div class="total-line">' +
      '<span class="total-line-med">' + l.name + ' × ' + l.qty + '</span>' +
      '<span class="total-line-val">' + (l.total !== null ? l.total.toLocaleString() + ' FCFA' : tr('lblNoPrice')) + '</span>' +
    '</div>';
  });
  if (hasPrice) {
    html += '<div class="total-line">' +
      '<span>' + tr('lblGrandTotal') + '</span>' +
      '<span class="total-line-val">' + grand.toLocaleString() + ' FCFA</span>' +
    '</div>';
  }
  document.getElementById('total-rows').innerHTML = html;
}

// ── Med row builder ───────────────────────────────────────────────────────────
function makeSelGroup(labelText, cls, placeholder) {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:1;min-width:110px;max-width:200px';

  var lbl = document.createElement('label');
  lbl.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
  lbl.textContent = labelText;

  var sel = document.createElement('select');
  sel.className = 'med-select ' + cls;
  var def = document.createElement('option');
  def.value = ''; def.textContent = placeholder;
  sel.appendChild(def);

  wrap.appendChild(lbl);
  wrap.appendChild(sel);
  return { wrap: wrap, sel: sel, lbl: lbl };
}

function addMedRow() {
  var container = document.getElementById('med-rows');
  var div = document.createElement('div');
  div.className = 'med-row';
  div.style.alignItems = 'flex-end';

  // ── Forfaitaire (placed first; also chooses which stock the dropdowns draw from) ──
  var forfaitWrap = document.createElement('div');
  forfaitWrap.className = 'forfait-wrap';
  forfaitWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;align-items:center;flex:0 0 auto';
  var forfaitLabel = document.createElement('label');
  forfaitLabel.className = 'med-lbl-forfait';
  forfaitLabel.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
  forfaitLabel.textContent = tr('lblForfait');
  var forfait = document.createElement('input');
  forfait.type = 'checkbox'; forfait.className = 'med-forfait'; forfait.style.accentColor = '#185FA5';
  forfaitWrap.appendChild(forfaitLabel);
  forfaitWrap.appendChild(forfait);

  // ── Three cascading selects ──
  var prod = makeSelGroup(tr('lblMedProduct'), 'sel-product', tr('selectMedProduct'));
  var dose = makeSelGroup(tr('lblMedDose'),    'sel-dose',    tr('selectMedDose'));
  var fmt  = makeSelGroup(tr('lblMedFormat'),  'sel-format',  tr('selectMedFormat'));
  dose.sel.disabled = true;
  fmt.sel.disabled  = true;

  // Unit price tag
  var priceTag = document.createElement('span');
  priceTag.className = 'unit-price-tag';

  // Source list depends on the Forfaitaire checkbox (forfait stock vs normal stock).
  function currentList() { return rowProducts(forfait.checked); }

  // (Re)populate the product dropdown from the current source and reset the rest.
  function fillProducts() {
    prod.sel.innerHTML = '';
    var def = document.createElement('option'); def.value = ''; def.textContent = tr('selectMedProduct'); prod.sel.appendChild(def);
    var names = [];
    currentList().forEach(function(p) { if (names.indexOf(p.product) === -1) names.push(p.product); });
    names.sort().forEach(function(name) { var o = document.createElement('option'); o.value = name; o.textContent = name; prod.sel.appendChild(o); });
    dose.sel.innerHTML = '<option value="">' + tr('selectMedDose') + '</option>';   dose.sel.disabled = true;
    fmt.sel.innerHTML  = '<option value="">' + tr('selectMedFormat') + '</option>'; fmt.sel.disabled  = true;
    priceTag.textContent = '';
  }

  // Product → populate doses
  prod.sel.addEventListener('change', function() {
    dose.sel.innerHTML = ''; fmt.sel.innerHTML = '';
    var defD = document.createElement('option'); defD.value = ''; defD.textContent = tr('selectMedDose'); dose.sel.appendChild(defD);
    var defF = document.createElement('option'); defF.value = ''; defF.textContent = tr('selectMedFormat'); fmt.sel.appendChild(defF);
    dose.sel.disabled = !prod.sel.value;
    fmt.sel.disabled  = true;
    priceTag.textContent = '';
    if (!prod.sel.value) { updateTotal(); return; }

    var doses = [];
    currentList().forEach(function(p) {
      if (p.product === prod.sel.value && doses.indexOf(p.dose) === -1) doses.push(p.dose);
    });
    doses.forEach(function(d) {
      var o = document.createElement('option'); o.value = d; o.textContent = d || '—'; dose.sel.appendChild(o);
    });
    // Select by index (1 = first real option) not by value, so a single blank
    // dose ('') selects the real option instead of falling back to the placeholder.
    if (doses.length === 1) { dose.sel.selectedIndex = 1; dose.sel.dispatchEvent(new Event('change')); }
    else updateTotal();
  });

  // Dose → populate formats
  dose.sel.addEventListener('change', function() {
    fmt.sel.innerHTML = '';
    var defF = document.createElement('option'); defF.value = ''; defF.textContent = tr('selectMedFormat'); fmt.sel.appendChild(defF);
    // A dose is "chosen" when a real option (index > 0) is selected — even a blank
    // one. Testing the value would treat an empty dose ('') as "nothing picked"
    // and wrongly keep the format dropdown disabled even though a format is needed.
    var doseChosen = dose.sel.selectedIndex > 0;
    fmt.sel.disabled = !doseChosen;
    priceTag.textContent = '';
    if (!doseChosen) { updateTotal(); return; }

    var fmts = [];
    currentList().forEach(function(p) {
      if (p.product === prod.sel.value && p.dose === dose.sel.value && fmts.indexOf(p.format) === -1) fmts.push(p.format);
    });
    fmts.forEach(function(f) {
      var o = document.createElement('option'); o.value = f; o.textContent = f || '—'; fmt.sel.appendChild(o);
    });
    if (fmts.length === 1) { fmt.sel.selectedIndex = 1; fmt.sel.dispatchEvent(new Event('change')); }
    else updateTotal();
  });

  // Format → show price
  fmt.sel.addEventListener('change', function() {
    var p   = lookupIn(currentList(), prod.sel.value, dose.sel.value, fmt.sel.value);
    var raw = p ? p.prixUnit || '' : '';
    priceTag.textContent = raw ? tr('lblUnitPrice') + ' ' + raw : '';
    updateTotal();
  });

  // Toggling Forfaitaire switches the source list (loading forfait stock if needed).
  forfait.addEventListener('change', function() {
    if (forfait.checked && !forfaitView.products.length) {
      forfaitView.load(function() { fillProducts(); updateTotal(); });
    } else {
      fillProducts();
    }
    updateTotal();
  });

  fillProducts();

  // ── Quantity ──
  var qtyWrap = document.createElement('div');
  qtyWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:0 0 60px';
  var qtyLabel = document.createElement('label');
  qtyLabel.className = 'med-lbl-qty';
  qtyLabel.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
  qtyLabel.textContent = tr('lblQty');
  var qty = document.createElement('input');
  qty.type = 'number'; qty.min = '1'; qty.value = '1'; qty.className = 'med-qty';
  qty.style.cssText = 'padding:6px 4px;border:0.5px solid var(--color-border-secondary,rgba(0,0,0,.3));border-radius:6px;background:var(--color-background-primary,#fff);font-size:12px;font-family:inherit;width:100%';
  qty.addEventListener('change', updateTotal);
  qtyWrap.appendChild(qtyLabel);
  qtyWrap.appendChild(qty);

  // ── Remove button ──
  var removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '×';
  removeBtn.onclick = function() {
    if (container.children.length > 1) { container.removeChild(div); updateTotal(); }
  };

  // Order: Forfaitaire, Product, Dose, Format, Quantity, price, remove.
  div.appendChild(forfaitWrap);
  div.appendChild(prod.wrap);
  div.appendChild(dose.wrap);
  div.appendChild(fmt.wrap);
  div.appendChild(qtyWrap);
  div.appendChild(priceTag);
  div.appendChild(removeBtn);
  container.appendChild(div);
}

// ── Date/time defaults ────────────────────────────────────────────────────────
function setDefaultDateTime() {
  var now = new Date();
  var pad = function(n) { return String(n).padStart(2, '0'); };
  document.getElementById('inp-date').value = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  document.getElementById('inp-time').value = pad(now.getHours()) + ':' + pad(now.getMinutes());
}

// ── Toast ─────────────────────────────────────────────────────────────────────
function showToast(msg, type) {
  var t = document.getElementById('toast');
  t.textContent = msg;
  t.className = 'toast ' + type + ' show';
  setTimeout(function() { t.className = 'toast'; }, 3500);
}

// ── Submit ────────────────────────────────────────────────────────────────────
function submitDispensation() {
  var dossier = document.getElementById('inp-dossier').value.trim();
  var date    = document.getElementById('inp-date').value;
  var time    = document.getElementById('inp-time').value;
  if (!dossier || !date || !time) { showToast(tr('toastValidate'), 'error'); return; }

  var medRows = document.getElementById('med-rows').children;
  if (!medRows.length) { showToast(tr('toastNoMeds'), 'error'); return; }

  var rows   = [];
  var valid  = true;
  var errMsg = 'toastValidate';
  for (var i = 0; i < medRows.length; i++) {
    var selProd = medRows[i].querySelector('.sel-product');
    var selDose = medRows[i].querySelector('.sel-dose');
    var selFmt  = medRows[i].querySelector('.sel-format');
    var qty     = medRows[i].querySelector('.med-qty');
    var forfait = medRows[i].querySelector('.med-forfait'); 
    if (!selProd || !selProd.value) { valid = false; break; }

    // Require a real product-dose-format match in the row's stock (normal or
    // forfait). This blocks lines where the product has several doses/formats but
    // the user left those dropdowns on their placeholder, which would create rows
    // not linkable to a product.
    var p         = lookupIn(rowProducts(forfait.checked), selProd.value, selDose.value, selFmt.value);
    if (!p) { valid = false; errMsg = 'toastSpecify'; break; }
    var unitVal   = parsePrixUnit(p ? p.prixUnit : '');
    var qtyVal    = parseInt(qty.value) || 0;
    var lineTotal = unitVal !== null ? unitVal * qtyVal : '';

    // Dispensation sheet schema (11 cols): A IsAddition (FALSE = dispensation),
    // B Dossier, C Date, D Time, E Product, F Dose, G Format, H UnitPrice, I Qty,
    // J LineTotal, K Forfait. Stock additions (Add-stock tab) write 'TRUE' in col A.
    rows.push([
      'FALSE',
      dossier, date, time,
      selProd.value,
      selDose.value,
      selFmt.value,
      unitVal !== null ? unitVal : '',
      qtyVal,
      lineTotal,
      forfait.checked ? 'TRUE' : 'FALSE'
    ]);
  }

  if (!valid) { showToast(tr(errMsg), 'error'); return; }

  var btn = document.getElementById('btn-submit');
  btn.disabled = true;
  appendRowsToSheet(rows, function (ok, reason) {
    if (ok) {
      showToast(tr('toastSuccess'), 'success');
      document.getElementById('inp-dossier').value = '';
      setDefaultDateTime();
      document.getElementById('med-rows').innerHTML = '';
      document.getElementById('total-section').style.display = 'none';
      addMedRow();
    } else {
      showToast(reason === 'forbidden' ? MSG_NO_WRITE_ACCESS : tr('toastError'), 'error');
    }
    btn.disabled = false;

    setTimeout(() => {
        inventoryView.load();
        forfaitView.load();
        console.log("inventory refreshed")
      }, 10000); //10 seconds


  });
}
