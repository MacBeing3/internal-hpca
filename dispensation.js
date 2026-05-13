// ── Config ────────────────────────────────────────────────────────────────────
var APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbxGjrl_I-p8hM66xbCMMZPDwg9cD32aTjQ4iXnzgsroLvPsC6u9kOhTjeCwnDJNZd8oZA/exec';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getProductByLabel(label) {
  for (var i = 0; i < products.length; i++) {
    var p = products[i];
    var l = p.product + (p.dose ? ' ' + p.dose : '') + (p.format ? ' (' + p.format + ')' : '');
    if (l === label) return p;
  }
  return null;
}

function parsePrixUnit(raw) {
  var n = parseFloat((raw || '').toString().replace(/[^0-9.,]/g, '').replace(',', '.'));
  return isNaN(n) ? null : n;
}

// ── Total section ─────────────────────────────────────────────────────────────
function updateTotal() {
  var container = document.getElementById('med-rows');
  var medRows   = container.children;
  var lines     = [];
  var grand     = 0;
  var hasPrice  = false;

  for (var i = 0; i < medRows.length; i++) {
    var sel     = medRows[i].querySelector('.med-select');
    var qty     = medRows[i].querySelector('.med-qty');
    if (!sel || !sel.value) continue;
    var p        = getProductByLabel(sel.value);
    var rawPrice = p ? p.prixUnit || '' : '';
    var unitVal  = parsePrixUnit(rawPrice);
    var qtyVal   = parseInt(qty.value) || 0;
    if (unitVal !== null) {
      var lineTotal = unitVal * qtyVal;
      grand += lineTotal;
      hasPrice = true;
      lines.push({ name: sel.value, qty: qtyVal, total: lineTotal });
    } else {
      lines.push({ name: sel.value, qty: qtyVal, total: null });
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
function populateMedSelect(sel) {
  var current = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  products.forEach(function(p) {
    var label = p.product + (p.dose ? ' ' + p.dose : '') + (p.format ? ' (' + p.format + ')' : '');
    var o = document.createElement('option');
    o.value = label; o.textContent = label;
    sel.appendChild(o);
  });
  if (current) sel.value = current;
}

function addMedRow() {
  var container = document.getElementById('med-rows');
  var div = document.createElement('div');
  div.className = 'med-row';

  // Medication select
  var selWrap = document.createElement('div');
  selWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:2;min-width:160px';
  var selLabel = document.createElement('label');
  selLabel.className = 'med-lbl-med';
  selLabel.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
  selLabel.textContent = tr('lblMed');
  var sel = document.createElement('select');
  sel.className = 'med-select';
  var defaultOpt = document.createElement('option');
  defaultOpt.value = ''; defaultOpt.textContent = tr('selectMed');
  sel.appendChild(defaultOpt);
  populateMedSelect(sel);
  selWrap.appendChild(selLabel);
  selWrap.appendChild(sel);

  // Quantity
  var qtyWrap = document.createElement('div');
  qtyWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:0 0 80px';
  var qtyLabel = document.createElement('label');
  qtyLabel.className = 'med-lbl-qty';
  qtyLabel.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
  qtyLabel.textContent = tr('lblQty');
  var qty = document.createElement('input');
  qty.type = 'number'; qty.min = '1'; qty.value = '1'; qty.className = 'med-qty';
  qtyWrap.appendChild(qtyLabel);
  qtyWrap.appendChild(qty);

  // Unit price display
  var priceTag = document.createElement('span');
  priceTag.className = 'unit-price-tag';

  // Forfaitaire
  var forfaitWrap = document.createElement('div');
  forfaitWrap.className = 'forfait-wrap';
  forfaitWrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;align-items:center';
  var forfaitLabel = document.createElement('label');
  forfaitLabel.className = 'med-lbl-forfait';
  forfaitLabel.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
  forfaitLabel.textContent = tr('lblForfait');
  var forfait = document.createElement('input');
  forfait.type = 'checkbox'; forfait.className = 'med-forfait';
  forfaitWrap.appendChild(forfaitLabel);
  forfaitWrap.appendChild(forfait);

  // Remove button
  var removeBtn = document.createElement('button');
  removeBtn.className = 'remove-btn';
  removeBtn.textContent = '×';
  removeBtn.onclick = function() {
    if (container.children.length > 1) { container.removeChild(div); updateTotal(); }
  };

  // Events
  sel.addEventListener('change', function() {
    var p   = getProductByLabel(sel.value);
    var raw = p ? p.prixUnit || '' : '';
    priceTag.textContent = raw ? tr('lblUnitPrice') + ' ' + raw : '';
    updateTotal();
  });
  qty.addEventListener('change', updateTotal);

  div.appendChild(selWrap);
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
    var sel     = medRows[i].querySelector('.med-select');
    var qty     = medRows[i].querySelector('.med-qty');
    var forfait = medRows[i].querySelector('.med-forfait');
    if (!sel.value) { valid = false; break; }

    var p         = getProductByLabel(sel.value);
    var product   = p ? p.product  : sel.value;
    var dose      = p ? p.dose     : '';
    var format    = p ? p.format   : '';
    var unitVal   = parsePrixUnit(p ? p.prixUnit : '');
    var qtyVal    = parseInt(qty.value) || 0;
    var lineTotal = unitVal !== null ? unitVal * qtyVal : '';

    rows.push([
      dossier, date, time,
      product, dose, format,
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
