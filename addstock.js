// ── Ajouter (add stock) ───────────────────────────────────────────────────────
// Two sections, each with multiple rows:
//   * Existing medications -> write an 'ajouter' transaction (A=TRUE) to the
//     Dispensation sheet, with column K = the row's Forfaitaire checkbox.
//   * New medications -> Product/Dose/Format picked from the Formulaire
//     (formulaireView), appended directly to the inventory sheet (Pharmacie or
//     Pharm FORF, per the Forfaitaire checkbox) following the Inventaire schema,
//     with the quantity supplied by an 'ajouter' transaction.
// Reuses makeSelGroup, parsePrixUnit, showToast, appendValues (dispensation.js),
// SHEET_ID/SHEET_TAB/SHEET_TAB_FORFAIT + inventoryView/forfaitView (inventory.js),
// DISP_SHEET_ID/DISP_SHEET_TAB (historique.js). Text hardcoded in French.

function findInProducts(list, product, dose, format) {
  for (var i = 0; i < list.length; i++) {
    var p = list[i];
    if (p.product === product && p.dose === dose && p.format === format) return p;
  }
  return null;
}

// Small labelled wrapper for a number input / checkbox.
function fieldWrap(labelText, input, width) {
  var wrap = document.createElement('div');
  wrap.style.cssText = 'display:flex;flex-direction:column;gap:3px;flex:0 0 ' + (width || '70px');
  var lbl = document.createElement('label');
  lbl.style.cssText = 'font-size:11px;font-weight:500;color:var(--color-text-secondary,#6b6b67)';
  lbl.textContent = labelText;
  wrap.appendChild(lbl);
  wrap.appendChild(input);
  return wrap;
}

function makeQtyInput(cls) {
  var qty = document.createElement('input');
  qty.type = 'number'; qty.min = '1'; qty.value = '1'; qty.className = cls;
  qty.style.cssText = 'padding:6px 4px;border:0.5px solid var(--color-border-secondary,rgba(0,0,0,.3));border-radius:6px;background:var(--color-background-primary,#fff);font-size:12px;font-family:inherit;width:100%';
  return qty;
}

function makeForfaitCheckbox(cls) {
  var c = document.createElement('input');
  c.type = 'checkbox'; c.className = cls; c.style.accentColor = '#185FA5';
  return c;
}

function makeRemoveBtn(div, container) {
  var b = document.createElement('button');
  b.className = 'remove-btn'; b.textContent = '×';
  b.onclick = function () { container.removeChild(div); };
  return b;
}

// ── Existing-medication row ──
function addExistingStockRow() {
  var container = document.getElementById('add-existing-rows');
  if (!container) return;
  var div = document.createElement('div');
  div.className = 'med-row';
  div.style.alignItems = 'flex-end';

  var prod = makeProductCombo('Produit', 'add-ex-product', '-- Produit --');
  var dose = makeSelGroup('Dose',    'add-ex-dose',    '-- Dose --');
  var fmt  = makeSelGroup('Format',  'add-ex-format',  '-- Format --');
  dose.sel.disabled = true; fmt.sel.disabled = true;
  var priceTag = document.createElement('span');
  priceTag.className = 'unit-price-tag';

  var qty   = makeQtyInput('add-ex-qty');
  var forf  = makeForfaitCheckbox('add-ex-forfait');

  // Source pool depends on the Forfaitaire checkbox: forfait stock vs normal stock.
  function currentList() { return forf.checked ? forfaitView.products : inventoryView.products; }

  function fillProducts() {
    var names = [];
    currentList().forEach(function (p) { if (names.indexOf(p.product) === -1) names.push(p.product); });
    prod.setOptions(names.sort());
    dose.sel.innerHTML = '<option value="">-- Dose --</option>';   dose.sel.disabled = true;
    fmt.sel.innerHTML  = '<option value="">-- Format --</option>'; fmt.sel.disabled  = true;
    priceTag.textContent = '';
  }

  prod.onChange(function () {
    dose.sel.innerHTML = '<option value="">-- Dose --</option>';
    fmt.sel.innerHTML  = '<option value="">-- Format --</option>';
    dose.sel.disabled = !prod.sel.value; fmt.sel.disabled = true; priceTag.textContent = '';
    if (!prod.sel.value) return;
    var doses = [];
    currentList().forEach(function (p) { if (p.product === prod.sel.value && doses.indexOf(p.dose) === -1) doses.push(p.dose); });
    doses.forEach(function (d) { var o = document.createElement('option'); o.value = d; o.textContent = d || '—'; dose.sel.appendChild(o); });
    // Select by index (1 = first real option), so a single blank dose ('') selects
    // the real option rather than falling back to the placeholder.
    if (doses.length === 1) { dose.sel.selectedIndex = 1; dose.sel.dispatchEvent(new Event('change')); }
  });
  dose.sel.addEventListener('change', function () {
    fmt.sel.innerHTML = '<option value="">-- Format --</option>';
    // "Chosen" = a real option (index > 0), even a blank dose — so an empty dose
    // still enables the Format dropdown.
    var doseChosen = dose.sel.selectedIndex > 0;
    fmt.sel.disabled = !doseChosen; priceTag.textContent = '';
    if (!doseChosen) return;
    var fmts = [];
    currentList().forEach(function (p) { if (p.product === prod.sel.value && p.dose === dose.sel.value && fmts.indexOf(p.format) === -1) fmts.push(p.format); });
    fmts.forEach(function (f) { var o = document.createElement('option'); o.value = f; o.textContent = f || '—'; fmt.sel.appendChild(o); });
    if (fmts.length === 1) { fmt.sel.selectedIndex = 1; fmt.sel.dispatchEvent(new Event('change')); }
  });
  fmt.sel.addEventListener('change', function () {
    var p = findInProducts(currentList(), prod.sel.value, dose.sel.value, fmt.sel.value);
    var raw = p ? p.prixUnit || '' : '';
    priceTag.textContent = raw ? 'Prix/u : ' + raw : '';
  });

  forf.addEventListener('change', fillProducts);
  fillProducts();

  div.appendChild(fieldWrap('Forfaitaire', forf, 'auto'));
  div.appendChild(prod.wrap);
  div.appendChild(dose.wrap);
  div.appendChild(fmt.wrap);
  div.appendChild(priceTag);
  div.appendChild(fieldWrap('Quantité', qty, '60px'));
  div.appendChild(makeRemoveBtn(div, container));
  container.appendChild(div);
}

// Category (inventory col A) = formulary Système, famille (col T) = formulary
// Famille — first non-empty value across the product's formulary rows.
function formClassification(product) {
  var cat = '', fam = '';
  formulaireView.products.forEach(function (fp) {
    if (fp.product !== product) return;
    if (!cat) cat = fp.systeme;
    if (!fam) fam = fp.famille;
  });
  return { category: cat, famille: fam };
}

// Read-only value shown in a labelled field (styled like a disabled input).
function makeReadOnlyValue(cls) {
  var s = document.createElement('div');
  s.className = cls; s.textContent = '—';
  s.style.cssText = 'padding:6px 8px;border:0.5px solid var(--color-border-tertiary,rgba(0,0,0,.15));border-radius:6px;background:var(--color-background-secondary,#f5f5f3);color:var(--color-text-secondary,#6b6b67);font-size:12px;min-height:28px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis';
  return s;
}

// ── New-medication row ──
function addNewStockRow() {
  var container = document.getElementById('add-new-rows');
  if (!container) return;
  var div = document.createElement('div');
  div.className = 'med-row';
  div.style.alignItems = 'flex-end';

  // Product / Dose / Format are picked from the Formulaire (not free text), one
  // formulary row per product+dose+format, cascading like the existing-med row.
  var prod = makeProductCombo('Produit', 'add-new-product', '-- Produit --');
  var dose = makeSelGroup('Dose',    'add-new-dose',    '-- Dose --');
  var fmt  = makeSelGroup('Format',  'add-new-format',  '-- Format --');
  dose.sel.disabled = true; fmt.sel.disabled = true;

  // Catégorie / Famille are filled from the formulary and shown, not editable.
  var catView = makeReadOnlyValue('add-new-category');
  var famView = makeReadOnlyValue('add-new-famille');
  function showClassification() {
    var c = prod.sel.value ? formClassification(prod.sel.value) : { category: '', famille: '' };
    catView.textContent = c.category || '—'; catView.title = c.category;
    famView.textContent = c.famille  || '—'; famView.title = c.famille;
  }

  // Distinct values of `field` among formulary rows for the chosen product
  // (and, for formats, the chosen dose).
  function valuesFor(field) {
    var out = [];
    formulaireView.products.forEach(function (p) {
      if (p.product !== prod.sel.value) return;
      if (field === 'formats' && p.doses !== dose.sel.value) return;
      if (out.indexOf(p[field]) === -1) out.push(p[field]);
    });
    return out;
  }

  function fillSel(g, placeholder, values) {
    g.sel.innerHTML = '<option value="">' + placeholder + '</option>';
    values.forEach(function (v) { var o = document.createElement('option'); o.value = v; o.textContent = v || '—'; g.sel.appendChild(o); });
    // Select by index so a single blank value selects the real option.
    if (values.length === 1) { g.sel.selectedIndex = 1; g.sel.dispatchEvent(new Event('change')); }
  }

  function fillProducts() {
    var names = [];
    formulaireView.products.forEach(function (p) { if (names.indexOf(p.product) === -1) names.push(p.product); });
    prod.setOptions(names.sort(function (a, b) { return a.localeCompare(b, 'fr', { sensitivity: 'base' }); }));
    dose.sel.innerHTML = '<option value="">-- Dose --</option>';   dose.sel.disabled = true;
    fmt.sel.innerHTML  = '<option value="">-- Format --</option>'; fmt.sel.disabled  = true;
    showClassification();
  }
  // Lets ensureStockLoadedForAjouter refill rows created before the formulary loaded.
  div.fillProducts = fillProducts;

  prod.onChange(function () {
    dose.sel.innerHTML = '<option value="">-- Dose --</option>';
    fmt.sel.innerHTML  = '<option value="">-- Format --</option>';
    dose.sel.disabled = !prod.sel.value; fmt.sel.disabled = true;
    showClassification();
    if (prod.sel.value) fillSel(dose, '-- Dose --', valuesFor('doses'));
  });
  dose.sel.addEventListener('change', function () {
    fmt.sel.innerHTML = '<option value="">-- Format --</option>';
    var doseChosen = dose.sel.selectedIndex > 0;
    fmt.sel.disabled = !doseChosen;
    if (doseChosen) fillSel(fmt, '-- Format --', valuesFor('formats'));
  });

  fillProducts();

  var price   = document.createElement('input');
  price.type = 'number'; price.min = '0'; price.step = 'any'; price.className = 'add-new-price';
  price.style.cssText = 'padding:6px 8px;border:0.5px solid var(--color-border-secondary,rgba(0,0,0,.3));border-radius:6px;background:var(--color-background-primary,#fff);font-size:12px;font-family:inherit;width:100%';
  var qty  = makeQtyInput('add-new-qty');
  var forf = makeForfaitCheckbox('add-new-forfait');

  div.appendChild(fieldWrap('Forfaitaire', forf, 'auto'));
  div.appendChild(prod.wrap);
  div.appendChild(dose.wrap);
  div.appendChild(fmt.wrap);
  div.appendChild(fieldWrap('Prix unitaire', price, '90px'));
  div.appendChild(fieldWrap('Quantité', qty, '60px'));
  div.appendChild(makeRemoveBtn(div, container));
  // Catégorie / Famille on their own line (a full-width item forces the wrap) so
  // the Produit-Dose-Format line matches the existing-medication rows.
  var line2 = document.createElement('div');
  line2.style.cssText = 'flex:0 0 100%;display:flex;gap:12px';
  line2.appendChild(fieldWrap('Catégorie', catView, '200px'));
  line2.appendChild(fieldWrap('Famille', famView, '200px'));
  div.appendChild(line2);
  container.appendChild(div);
}

function resetAddStock() {
  document.getElementById('add-existing-rows').innerHTML = '';
  document.getElementById('add-new-rows').innerHTML = '';
  addExistingStockRow();
}

// Run several append tasks ({id, tab, rows}); report success only if all succeed.
// Surfaces a 'forbidden' reason if any task was rejected for lack of write access.
function runAppends(tasks, callback) {
  if (!tasks.length) { callback(true, ''); return; }
  var remaining = tasks.length, allOk = true, reason = '';
  tasks.forEach(function (t) {
    appendValues(t.id, t.tab, t.rows, function (ok, r) {
      if (!ok) { allOk = false; if (r === 'forbidden') reason = 'forbidden'; else if (!reason) reason = r; }
      if (--remaining === 0) callback(allOk, reason);
    });
  });
}

// Ensure both stocks are loaded so the existing-med dropdowns have data, and add
// the first existing row once data is ready.
function ensureStockLoadedForAjouter() {
  var notice = document.getElementById('add-no-inv');
  function done() {
    if (notice) notice.style.display = (inventoryView.products.length || forfaitView.products.length) ? 'none' : 'block';
    var c = document.getElementById('add-existing-rows');
    if (c && c.children.length === 0) addExistingStockRow();
  }
  var triggered = false;
  if (!inventoryView.products.length) { triggered = true; inventoryView.load(done); }
  if (!forfaitView.products.length)   { triggered = true; forfaitView.load(done); }
  if (!triggered) done();

  // New-medication dropdowns come from the Formulaire; load it if needed, then
  // refill any new-med rows that were created (empty) before it arrived.
  if (!formulaireView.products.length) {
    formulaireView.load(function () {
      var rows = document.querySelectorAll('#add-new-rows .med-row');
      for (var i = 0; i < rows.length; i++) {
        if (rows[i].fillProducts && !rows[i].querySelector('.add-new-product').value) rows[i].fillProducts();
      }
    });
  }
}

function submitAddStock() {
  var now = new Date();
  var pad = function (n) { return String(n).padStart(2, '0'); };
  var date   = now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  var time   = pad(now.getHours()) + ':' + pad(now.getMinutes());
  var caisse = cashDateStr();   // Date de Caisse (col C)

  var transactions = []; // existing meds -> Dispensation sheet (ajouter rows)
  var normalInv    = []; // new meds -> Pharmacie (Stock Normal)
  var forfaitInv   = []; // new meds -> Pharm FORF (Stock Forfaitaire)

  // ── Existing medications ──
  var exRows = document.querySelectorAll('#add-existing-rows .med-row');
  for (var i = 0; i < exRows.length; i++) {
    var ps = exRows[i].querySelector('.add-ex-product');
    if (!ps || !ps.value) continue; // skip untouched rows
    var ds = exRows[i].querySelector('.add-ex-dose');
    var fs = exRows[i].querySelector('.add-ex-format');
    var forf = exRows[i].querySelector('.add-ex-forfait').checked;
    var list = forf ? forfaitView.products : inventoryView.products;
    var p = findInProducts(list, ps.value, ds ? ds.value : '', fs ? fs.value : '');
    if (!p) { showToast('Veuillez préciser la dose et le format de chaque médicament.', 'error'); return; }
    var qa = parseInt(exRows[i].querySelector('.add-ex-qty').value, 10) || 0;
    if (qa <= 0) { showToast('Veuillez saisir une quantité valide.', 'error'); return; }
    var up = parsePrixUnit(p.prixUnit); up = (up !== null) ? up : '';
    var lt = (up === '') ? '' : up * qa;
    // Schema (11 cols): A IsAddition, B Dossier, C Date, D Time, E Product, F Dose,
    // G Format, H UnitPrice, I Qty, J LineTotal, K Forfait.
    transactions.push(['TRUE', '', caisse, date, time, p.product, p.dose, p.format, up, qa, lt, forf ? 'TRUE' : 'FALSE']);
  }

  // ── New medications ──
  var nwRows = document.querySelectorAll('#add-new-rows .med-row');
  for (var j = 0; j < nwRows.length; j++) {
    var product = (nwRows[j].querySelector('.add-new-product').value || '').trim();
    if (!product) continue; // skip empty rows
    var dSel = nwRows[j].querySelector('.add-new-dose');
    var fSel = nwRows[j].querySelector('.add-new-format');
    // A real option (index > 0) must be chosen, even if it is the blank one.
    if (dSel.selectedIndex <= 0 || fSel.selectedIndex <= 0) {
      showToast('Veuillez préciser la dose et le format de chaque médicament.', 'error'); return;
    }
    var dose   = dSel.value;
    var format = fSel.value;
    var np = parsePrixUnit(nwRows[j].querySelector('.add-new-price').value); np = (np !== null) ? np : '';
    var qn = parseInt(nwRows[j].querySelector('.add-new-qty').value, 10) || 0;
    if (qn <= 0) { showToast('Veuillez saisir une quantité valide.', 'error'); return; }
    var nForf = nwRows[j].querySelector('.add-new-forfait').checked;
    // Inventaire schema (A:T, 20 cols): A category, B code, C product, D dose,
    // E format, F dateExp, G stockInit, H pa, I prixUnit, J sorties, K change,
    // L stockActuel, M obs, N consEstMo, O moRest, P quantMin, Q valeur,
    // R etatsUnis, S essentiel, T famille. Initial stock is 0; the quantity is
    // supplied by an ajouter transaction (below) so Stock Actuel reflects it and
    // there is a clear record of the addition in the history.
    var cls = formClassification(product);
    var invRow = [cls.category, '', product, dose, format, '', 0, '', np, '', '', '', '', '', '', '', '', '', '', cls.famille];
    if (nForf) forfaitInv.push(invRow); else normalInv.push(invRow);
    var nlt = (np === '') ? '' : np * qn;
    transactions.push(['TRUE', '', caisse, date, time, product, dose, format, np, qn, nlt, nForf ? 'TRUE' : 'FALSE']);
  }

  if (!transactions.length && !normalInv.length && !forfaitInv.length) {
    showToast('Aucun médicament à ajouter.', 'error');
    return;
  }

  var tasks = [];
  if (transactions.length) tasks.push({ id: DISP_SHEET_ID, tab: DISP_SHEET_TAB,     rows: transactions });
  if (normalInv.length)    tasks.push({ id: SHEET_ID,      tab: SHEET_TAB,           rows: normalInv });
  if (forfaitInv.length)   tasks.push({ id: SHEET_ID,      tab: SHEET_TAB_FORFAIT,   rows: forfaitInv });

  var btn = document.getElementById('btn-add-submit');
  btn.disabled = true;
  runAppends(tasks, function (ok, reason) {
    if (ok) {
      showToast('Stock ajouté avec succès.', 'success');
      resetAddStock();
      loadInventory();
      loadForfait();
      loadHistorique();
    } else {
      showToast(reason === 'forbidden' ? MSG_NO_WRITE_ACCESS : "Erreur lors de l'ajout. Veuillez réessayer.", 'error');
    }
    btn.disabled = false;
  });
}
