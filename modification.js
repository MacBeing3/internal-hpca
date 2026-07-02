// ── Modification (edit a medication's values, with an audit log) ───────────────
// Pick a medication (Stock Normal or Forfaitaire → product → dose → format),
// edit one or more of its values, give a reason (required), and confirm. The app
// updates the changed cells in the Pharmacie / Pharm FORF sheet and appends one
// line PER changed property to the "Modifications" tab of the Dispensation sheet:
//   Date · Heure · Utilisateur · Propriété modifiée · Ancienne valeur · Nouvelle valeur · Raison
// All lines from one confirmation share the same date/heure/user/reason.
// Text hardcoded in French.

// Canonical inventory columns (A:T) — the SINGLE source of truth for which sheet
// column each property lives in. The column is always looked up here by key, so
// editing MOD_FIELDS (add/remove/reorder) can never desync the columns.
var INV_COL = {
  category:'A', code:'B', product:'C', dose:'D', format:'E', dateExp:'F',
  stockInit:'G', pa:'H', prixUnit:'I', sorties:'J', change:'K', stockActuel:'L',
  obs:'M', consEstMo:'N', moRest:'O', quantMin:'P', valeur:'Q', etatsUnis:'R',
  essentiel:'S', famille:'T'
};

// Editable fields → { key: product-object property, label: French name }. 
// The sheet column is taken from INV_COL[key] (do NOT hardcode columns here).
var MOD_FIELDS = [
  { key: 'category',    label: 'Catégorie' },
  { key: 'product',     label: 'Produit' },
  { key: 'dose',        label: 'Dose' },
  { key: 'format',      label: 'Format' },
  { key: 'dateExp',     label: 'Exp' },
  { key: 'prixUnit',    label: 'Prix/u' },
  { key: 'change',      label: 'Pertes' },
  { key: 'consEstMo',   label: 'Cons mens' },
  { key: 'quantMin',    label: 'Quantité min' },
  { key: 'etatsUnis',   label: 'Système' },
  { key: 'essentiel',   label: 'Essentiel' },
  { key: 'famille',     label: 'Famille' }
];

var MOD_HEADER = ['Date', 'Heure', 'Utilisateur', 'Propriété modifiée', 'Ancienne valeur', 'Nouvelle valeur', 'Raison'];

var modDirection = 'normal';  // 'normal' | 'forfait'
var modSelected  = null;      // the chosen product object (has rowIndex + current values)

function modSourceView() { return modDirection === 'forfait' ? forfaitView : inventoryView; }
function modTargetTab()  { return modDirection === 'forfait' ? SHEET_TAB_FORFAIT : SHEET_TAB; }

function modFind(list, product, dose, format) {
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (p.product === product && p.dose === dose && p.format === format) return p;
  }
  return null;
}

function setModDirection(dir) {
  modDirection = dir;
  hideModFields();
  buildModPicker();
  refreshModSource();
}

// Auto-load the source stock if it isn't loaded yet, then rebuild the picker.
function refreshModSource() {
  var src    = modSourceView();
  var notice = document.getElementById('mod-no-data');
  var msg    = document.getElementById('mod-no-data-msg');
  if (msg) msg.textContent = modDirection === 'forfait' ? 'Chargement du forfait…' : 'Chargement de l\'inventaire…';
  if (src.products.length) { if (notice) notice.style.display = 'none'; return; }
  if (notice) notice.style.display = 'block';
  src.load(function () {
    if (notice) notice.style.display = src.products.length ? 'none' : 'block';
    if (msg && !src.products.length) msg.textContent = 'Impossible de charger le stock.';
    buildModPicker();
  });
}

function hideModFields() {
  modSelected = null;
  var fs = document.getElementById('mod-fields-section');
  var rs = document.getElementById('mod-reason-section');
  if (fs) fs.style.display = 'none';
  if (rs) rs.style.display = 'none';
}

// Product → dose → format picker that pins one inventory row.
function buildModPicker() {
  var container = document.getElementById('mod-picker');
  if (!container) return;
  container.innerHTML = '';
  var list = modSourceView().products;

  var prod = makeProductCombo('Produit', 'mod-sel-product', '-- Produit --');
  var dose = makeSelGroup('Dose',   'mod-sel-dose',   '-- Dose --');
  var fmt  = makeSelGroup('Format', 'mod-sel-format', '-- Format --');
  dose.sel.disabled = true;
  fmt.sel.disabled  = true;

  var names = [];
  list.forEach(function (p) { if (names.indexOf(p.product) === -1) names.push(p.product); });
  prod.setOptions(names.sort());

  prod.onChange(function () {
    dose.sel.innerHTML = ''; fmt.sel.innerHTML = '';
    var dd = document.createElement('option'); dd.value = ''; dd.textContent = '-- Dose --';   dose.sel.appendChild(dd);
    var df = document.createElement('option'); df.value = ''; df.textContent = '-- Format --'; fmt.sel.appendChild(df);
    dose.sel.disabled = !prod.sel.value; fmt.sel.disabled = true;
    hideModFields();
    if (!prod.sel.value) return;
    var doses = [];
    list.forEach(function (p) { if (p.product === prod.sel.value && doses.indexOf(p.dose) === -1) doses.push(p.dose); });
    doses.forEach(function (d) { var o = document.createElement('option'); o.value = d; o.textContent = d || '—'; dose.sel.appendChild(o); });
    if (doses.length === 1) { dose.sel.selectedIndex = 1; dose.sel.dispatchEvent(new Event('change')); }
  });

  dose.sel.addEventListener('change', function () {
    fmt.sel.innerHTML = '';
    var df = document.createElement('option'); df.value = ''; df.textContent = '-- Format --'; fmt.sel.appendChild(df);
    var doseChosen = dose.sel.selectedIndex > 0;
    fmt.sel.disabled = !doseChosen;
    hideModFields();
    if (!doseChosen) return;
    var fmts = [];
    list.forEach(function (p) { if (p.product === prod.sel.value && p.dose === dose.sel.value && fmts.indexOf(p.format) === -1) fmts.push(p.format); });
    fmts.forEach(function (f) { var o = document.createElement('option'); o.value = f; o.textContent = f || '—'; fmt.sel.appendChild(o); });
    if (fmts.length === 1) { fmt.sel.selectedIndex = 1; fmt.sel.dispatchEvent(new Event('change')); }
  });

  fmt.sel.addEventListener('change', function () {
    if (fmt.sel.selectedIndex <= 0) { hideModFields(); return; }
    var p = modFind(list, prod.sel.value, dose.sel.value, fmt.sel.value);
    if (p) selectMed(p); else hideModFields();
  });

  container.appendChild(prod.wrap);
  container.appendChild(dose.wrap);
  container.appendChild(fmt.wrap);
}

// Load the selected medication's current values into editable inputs.
function selectMed(p) {
  modSelected = p;
  var container = document.getElementById('mod-fields');
  container.innerHTML = '';
  MOD_FIELDS.forEach(function (f) {
    var wrap = document.createElement('div');
    wrap.className = 'form-group';
    var lbl = document.createElement('label');
    lbl.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
    lbl.textContent = f.label;
    var input = document.createElement('input');
    input.type = 'text';
    input.className = 'mod-field mod-field-' + f.key;
    input.style.cssText = 'padding:6px 8px;border:0.5px solid var(--color-border-secondary,rgba(0,0,0,.3));border-radius:6px;background:var(--color-background-primary,#fff);color:var(--color-text-primary,#1a1a18);font-size:12px;font-family:inherit;width:100%';
    var v = p[f.key];
    input.value = (v === '' || v === null || v === undefined) ? '' : v;
    input.setAttribute('data-key', f.key);
    wrap.appendChild(lbl);
    wrap.appendChild(input);
    container.appendChild(wrap);
  });
  document.getElementById('mod-fields-section').style.display = 'block';
  document.getElementById('mod-reason-section').style.display = 'block';
  document.getElementById('mod-reason').value = '';
}

// ── Sheets API: batch-update several cells (values.batchUpdate) ──
function modUpdateCells(updates, callback) {
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID + '/values:batchUpdate';
  var body = { valueInputOption: 'USER_ENTERED', data: updates };
  ensureFreshToken(function () {
    authFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body)
    })
      .then(function (res) {
        if (res.ok) { callback(true, ''); return; }
        return res.text().then(function (t) {
          console.error('Modification update failed:', res.status, t);
          callback(false, res.status === 403 ? 'forbidden' : 'error');
        });
      })
      .catch(function (err) { console.error('Modification update error:', err); callback(false, 'error'); });
  });
}

// Append log rows to the Modifications tab, writing the header first if it's empty.
function appendModLog(logRows, callback) {
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + DISP_SHEET_ID +
            '/values/' + encodeURIComponent('Modifications');
  ensureFreshToken(function () {
    authFetch(url)
      .then(function (res) { return res.json().then(function (d) { return { ok: res.ok, data: d }; }); })
      .then(function (r) {
        var hasRows  = r.ok && r.data && r.data.values && r.data.values.length > 0;
        var toAppend = hasRows ? logRows : [MOD_HEADER].concat(logRows);
        appendValues(DISP_SHEET_ID, 'Modifications', toAppend, callback);
      })
      .catch(function () { appendValues(DISP_SHEET_ID, 'Modifications', logRows, callback); });
  });
}

function submitModification() {
  if (!modSelected) { showToast('Veuillez sélectionner un médicament.', 'error'); return; }
  var reason = (document.getElementById('mod-reason').value || '').trim();
  if (!reason) { showToast('Veuillez indiquer une raison pour la modification.', 'error'); return; }

  // Collect changed fields (input value differs from the current value).
  var changes = [];
  MOD_FIELDS.forEach(function (f) {
    var input = document.querySelector('.mod-field-' + f.key);
    if (!input) return;
    var newVal = (input.value || '').trim();
    var raw    = modSelected[f.key];
    var oldVal = (raw === '' || raw === null || raw === undefined) ? '' : String(raw);
    if (newVal !== oldVal) changes.push({ label: f.label, col: INV_COL[f.key], oldVal: oldVal, newVal: newVal });
  });
  if (!changes.length) { showToast('Aucune modification à enregistrer.', 'error'); return; }

  // ── Identity-change handling (Produit / Dose / Format / Exp) ──
  var valOf    = function (obj, key) { var v = obj[key]; return (v === '' || v === null || v === undefined) ? '' : String(v); };
  var fieldVal = function (key) { var el = document.querySelector('.mod-field-' + key); return el ? (el.value || '').trim() : valOf(modSelected, key); };
  var newProduct = fieldVal('product'), newDose = fieldVal('dose'), newFormat = fieldVal('format'), newExp = fieldVal('dateExp');
  var pdfChanged = newProduct !== valOf(modSelected, 'product') ||
                   newDose    !== valOf(modSelected, 'dose')    ||
                   newFormat  !== valOf(modSelected, 'format');
  var idChanged  = pdfChanged || newExp !== valOf(modSelected, 'dateExp');

  if (idChanged) {
    // Block if the new Produit-Dose-Format-Exp already exists on a different row.
    var list = modSourceView().products;
    for (var i = 0; i < list.length; i++) {
      var p = list[i];
      if (p.rowIndex === modSelected.rowIndex) continue;
      if (valOf(p, 'product') === newProduct && valOf(p, 'dose') === newDose &&
          valOf(p, 'format') === newFormat && valOf(p, 'dateExp') === newExp) {
        showToast('Une autre entrée avec ce Produit / Dose / Format / Exp existe déjà — modification bloquée.', 'error');
        return;
      }
    }
  }

  if (pdfChanged) {
    // Changing Produit/Dose/Format desyncs this row from its past transactions
    // (which match on those fields), so rebaseline it for a clean "day one":
    //   Stock initial ← Stock actuel, and Change ("Pertes") ← 0.
    // Both feed the Stock actuel formula, so both must reset. (Exp is excluded —
    // it isn't part of transaction matching, so resetting on it would double-count.)
    // The reset overrides any manual edit to these two columns in this same change.
    changes = changes.filter(function (c) { return c.col !== INV_COL.stockInit && c.col !== INV_COL.change; });
    var actuelStr = valOf(modSelected, 'stockActuel');
    var initStr   = valOf(modSelected, 'stockInit');
    if (actuelStr !== initStr) {
      changes.push({ label: 'Stock initial', col: INV_COL.stockInit, oldVal: initStr, newVal: actuelStr });
    }
    // Change ("Pertes"): the old value is now absorbed into the rebaselined Stock
    // initial, so keep only the DELTA the user submitted (submitted − old). With no
    // manual edit that delta is 0 (a plain reset); with an edit it preserves the
    // adjustment instead of silently dropping it.
    var oldChange = parseFloat(valOf(modSelected, 'change')); if (isNaN(oldChange)) oldChange = 0;
    var subChange = parseFloat(fieldVal('change'));           if (isNaN(subChange)) subChange = 0;
    var newChange = subChange - oldChange;
    if (newChange !== oldChange) {
      changes.push({ label: 'Pertes', col: INV_COL.change, oldVal: valOf(modSelected, 'change'), newVal: String(newChange) });
    }
  }

  var now  = new Date();
  var pad  = function (n) { return String(n).padStart(2, '0'); };
  var date = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var heure = pad(now.getHours()) + ':' + pad(now.getMinutes());
  var user  = (typeof currentUser !== 'undefined' && currentUser) ? currentUser.email : '';

  var tab = modTargetTab();
  var updates = changes.map(function (c) {
    return { range: "'" + tab + "'!" + c.col + modSelected.rowIndex, values: [[c.newVal]] };
  });
  var logRows = changes.map(function (c) {
    return [date, heure, user, c.label, c.oldVal, c.newVal, reason];
  });

  var btn = document.getElementById('btn-mod-submit');
  btn.disabled = true;
  modUpdateCells(updates, function (ok, why) {
    if (!ok) {
      showToast(why === 'forbidden' ? MSG_NO_WRITE_ACCESS : 'Erreur lors de la modification. Veuillez réessayer.', 'error');
      btn.disabled = false;
      return;
    }
    appendModLog(logRows, function (ok2, why2) {
      if (ok2) {
        showToast('Modification enregistrée avec succès.', 'success');
        hideModFields();
        buildModPicker();
        loadInventory();
        loadForfait();
      } else {
        // Cells were changed but the log failed (e.g. missing "Modifications" tab).
        showToast(why2 === 'forbidden' ? MSG_NO_WRITE_ACCESS
          : 'Modification appliquée, mais le journal a échoué (vérifiez l\'onglet « Modifications »).', 'error');
        loadInventory();
        loadForfait();
      }
      btn.disabled = false;
    });
  });
}
