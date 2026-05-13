// ── Config ────────────────────────────────────────────────────────────────────
var APPS_SCRIPT_URL = 'PASTE_YOUR_APPS_SCRIPT_URL_HERE';

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
    if (!selProd || !selProd.value) continue;

    var p         = getProductByPDF(selProd.value, selDose ? selDose.value : '', selFmt ? selFmt.value : '');
    var rawPrice  = p ? p.prixUnit || '' : '';
    var unitVal   = parsePrixUnit(rawPrice);
    var qtyVal    = parseInt(qty.value) || 0;
    var label     = selProd.value +
                    (selDose && selDose.value ? ' ' + selDose.value : '') +
                    (selFmt  && selFmt.value  ? ' (' + selFmt.value + ')' : '');

    if (unitVal !== null) {
      var lineTotal = unitVal * qtyVal;
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

  // ── Three cascading selects ──
  var prod = makeSelGroup(tr('lblMedProduct'), 'sel-product', tr('selectMedProduct'));
  var dose = makeSelGroup(tr('lblMedDose'),    'sel-dose',    tr('selectMedDose'));
  var fmt  = makeSelGroup(tr('lblMedFormat'),  'sel-format',  tr('selectMedFormat'));

  dose.sel.disabled = true;
  fmt.sel.disabled  = true;

  // Populate product names (sorted, unique)
  var productNames = [];
  products.forEach(function(p) {
    if (productNames.indexOf(p.product) === -1) productNames.push(p.product);
  });
  productNames.sort().forEach(function(name) {
    var o = document.createElement('option'); o.value = name; o.textContent = name;
    prod.sel.appendChild(o);
  });

  // Unit price tag
  var priceTag = document.createElement('span');
  priceTag.className = 'unit-price-tag';

  // Product → populate doses
  prod.sel.addEventListener('change', function() {
    // reset dose & format
    dose.sel.innerHTML = ''; fmt.sel.innerHTML = '';
    var defD = document.createElement('option'); defD.value = ''; defD.textContent = tr('selectMedDose'); dose.sel.appendChild(defD);
    var defF = document.createElement('option'); defF.value = ''; defF.textContent = tr('selectMedFormat'); fmt.sel.appendChild(defF);
    dose.sel.disabled = !prod.sel.value;
    fmt.sel.disabled  = true;
    priceTag.textContent = '';
    if (!prod.sel.value) { updateTotal(); return; }

    var doses = [];
    products.forEach(function(p) {
      if (p.product === prod.sel.value && doses.indexOf(p.dose) === -1) doses.push(p.dose);
    });
    doses.forEach(function(d) {
      var o = document.createElement('option'); o.value = d; o.textContent = d || '—'; dose.sel.appendChild(o);
    });
    // auto-select if only one option
    if (doses.length === 1) { dose.sel.value = doses[0]; dose.sel.dispatchEvent(new Event('change')); }
    else updateTotal();
  });

  // Dose → populate formats
  dose.sel.addEventListener('change', function() {
    fmt.sel.innerHTML = '';
    var defF = document.createElement('option'); defF.value = ''; defF.textContent = tr('selectMedFormat'); fmt.sel.appendChild(defF);
    fmt.sel.disabled = !dose.sel.value;
    priceTag.textContent = '';
    if (!dose.sel.value) { updateTotal(); return; }

    var fmts = [];
    products.forEach(function(p) {
      if (p.product === prod.sel.value && p.dose === dose.sel.value && fmts.indexOf(p.format) === -1) fmts.push(p.format);
    });
    fmts.forEach(function(f) {
      var o = document.createElement('option'); o.value = f; o.textContent = f || '—'; fmt.sel.appendChild(o);
    });
    // auto-select if only one option
    if (fmts.length === 1) { fmt.sel.value = fmts[0]; fmt.sel.dispatchEvent(new Event('change')); }
    else updateTotal();
  });

  // Format → show price
  fmt.sel.addEventListener('change', function() {
    var p   = getProductByPDF(prod.sel.value, dose.sel.value, fmt.sel.value);
    var raw = p ? p.prixUnit || '' : '';
    priceTag.textContent = raw ? tr('lblUnitPrice') + ' ' + raw : '';
    updateTotal();
  });

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

  // ── Forfaitaire ──
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

  // ── Remove button ──
  var removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '×';
  removeBtn.onclick = function() {
    if (container.children.length > 1) { container.removeChild(div); updateTotal(); }
  };

  div.appendChild(prod.wrap);
  div.appendChild(dose.wrap);
  div.appendChild(fmt.wrap);
  div.appendChild(qtyWrap);
  div.appendChild(priceTag);
  div.appendChild(forfaitWrap);
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

  var rows  = [];
  var valid = true;
  for (var i = 0; i < medRows.length; i++) {
    var selProd = medRows[i].querySelector('.sel-product');
    var selDose = medRows[i].querySelector('.sel-dose');
    var selFmt  = medRows[i].querySelector('.sel-format');
    var qty     = medRows[i].querySelector('.med-qty');
    var forfait = medRows[i].querySelector('.med-forfait');
    if (!selProd || !selProd.value) { valid = false; break; }

    var p         = getProductByPDF(selProd.value, selDose.value, selFmt.value);
    var unitVal   = parsePrixUnit(p ? p.prixUnit : '');
    var qtyVal    = parseInt(qty.value) || 0;
    var lineTotal = unitVal !== null ? unitVal * qtyVal : '';

    rows.push([
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

  if (!valid) { showToast(tr('toastValidate'), 'error'); return; }

  var btn = document.getElementById('btn-submit');
  btn.disabled = true;
  fetch(APPS_SCRIPT_URL, { method: 'POST', body: JSON.stringify(rows) })
    .then(function(res) { return res.json(); })
    .then(function(data) {
      if (data.status === 'ok') {
        showToast(tr('toastSuccess'), 'success');
        document.getElementById('inp-dossier').value = '';
        setDefaultDateTime();
        document.getElementById('med-rows').innerHTML = '';
        document.getElementById('total-section').style.display = 'none';
        addMedRow();
      } else {
        showToast(tr('toastError'), 'error');
      }
      btn.disabled = false;
    })
    .catch(function() {
      showToast(tr('toastError'), 'error');
      btn.disabled = false;
    });
}
