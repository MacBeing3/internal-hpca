// ── Config ──────────────────────────────────────────────────────────────────
var SHEET_ID  = '1jFJRHFhyADBya4Ei9x0vOFSmhqX3eSaViZhuoweVfF8';
var SHEET_TAB = 'Pharmacie';
var SHEET_TAB_FORFAIT = 'Pharm FORF';

// Legacy global: the INVENTORY product list. dispensation.js reads this to build
// its medication dropdowns, so it must always reflect the inventory view (never
// Forfait). It is kept in sync by the inventory view (cfg.syncGlobal below).
var products = [];

// ── Pure helpers (no state, no DOM — shared by every view) ─────────────────────
function isHeaderRow(r) {
  var v = (r[2] || '').toLowerCase().trim();
  return v === 'produit' || v === 'product' || v === 'produits';
}

function parseNum(v) {
  var n = parseFloat((v || '').toString().replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? '' : n;
}

function fmt(v) { return (v === '' || v === null || v === undefined) ? '—' : v; }

function getStockStatus(p) {
  if (p.moRest !== '' && p.moRest <= 1) return 'critical';
  if (p.moRest !== '' && p.moRest < 6)  return 'low';
  if (p.stockActuel !== '' && p.stockInit !== '' && p.stockInit > 0 &&
      (p.stockActuel / p.stockInit) < 0.1) return 'critical';
  return 'ok';
}

function stockBar(p) {
  if (p.stockInit === '' || p.stockActuel === '') return '';
  var pct   = p.stockInit > 0 ? Math.min(100, Math.round(p.stockActuel / p.stockInit * 100)) : 0;
  var s     = getStockStatus(p);
  var pct   = s === 'critical' ? 10 : s === 'low' ? 45 : 85;
  var color = s === 'critical' ? '#E24B4A' : s === 'low' ? '#EF9F27' : '#639922';
  return '<div class="stock-bar-wrap"><div class="stock-bar"><div class="stock-fill" style="width:' +
         pct + '%;background:' + color + '"></div></div></div>';
}

function statusBadge(p) {
  var s = getStockStatus(p);
  if (s === 'critical') return '<span class="badge badge-danger">' + tr('statusCritical') + '</span>';
  if (s === 'low')      return '<span class="badge badge-warn">'   + tr('statusLow')      + '</span>';
  return '<span class="badge badge-ok">' + tr('statusOk') + '</span>';
}

function expBadge(ds) {
  if (!ds) return '—';
  var parts = ds.split('/');
  if (parts.length < 2) return ds;
  var d  = new Date(parseInt(parts[1]), parseInt(parts[0]) - 1, 1);
  var mo = (d.getFullYear() - new Date().getFullYear()) * 12 + (d.getMonth() - new Date().getMonth());
  if (mo <= 6)  return '<span class="badge badge-danger">'  + ds + '</span>';
  if (mo <= 12) return '<span class="badge badge-warn">'    + ds + '</span>';
  return '<span class="badge badge-neutral">' + ds + '</span>';
}

// ── View factory ───────────────────────────────────────────────────────────────
// One sheet-backed inventory view. Each instance owns its own data + DOM, found by
// suffixing the shared base ids (''  -> inventory page,  '-forf' -> forfait page).
function createSheetView(cfg) {
  var suffix = cfg.suffix || '';
  function $(base) { return document.getElementById(base + suffix); }

  var view = { tab: cfg.tab, products: [], sortCol: null, sortDir: 1 };

  // ── UI state helpers ──
  function showState(html) {
    var el = $('main-state');
    el.style.display = 'block';
    el.innerHTML = '<div class="state-box">' + html + '</div>';
  }
  function hideAll() {
    ['meta-bar', 'stats-row', 'filter-bar', 'table-section'].forEach(function (b) {
      var el = $(b); if (el) el.style.display = 'none';
    });
  }
  function showTable() {
    $('main-state').style.display    = 'none';
    $('meta-bar').style.display      = 'flex';
    $('stats-row').style.display     = 'grid';
    $('filter-bar').style.display    = 'flex';
    $('table-section').style.display = 'block';
  }

  // ── Load ──
  // onDone (optional) runs after the data is loaded (or after an error), so other
  // pages — e.g. Mouvement — can rebuild their dropdowns once products are ready.
  view.load = function (onDone) {
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID +
              '/values/' + cfg.tab + '!A:T';
    showState('<div class="spinner"></div><div style="margin-top:12px">Chargement...</div>');
    hideAll();

    ensureFreshToken(function () {
      authFetch(url)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          var dataRows = (data.values || []).filter(function (r) {
            return r.length >= 3 && r[2] && r[2].trim() && !isHeaderRow(r);
          });
          processRows(dataRows);
          if (typeof onDone === 'function') onDone();
        })
        .catch(function () {
          showState('<div style="font-size:32px">❌</div><div>' + tr('errEmpty') + '</div>');
          if (typeof onDone === 'function') onDone();
        });
    });
  };

  function processRows(rows) {
    if (!rows.length) {
      showState('<div style="font-size:32px">⚠️</div><div>' + tr('errEmpty') + '</div>');
      return;
    }
    view.products = rows.map(function (r) {
      return {
        category:   (r[0]  || '').trim(),
        code:       (r[1]  || '').trim(),
        product:    (r[2]  || '').trim(),
        dose:       (r[3]  || '').trim(),
        format:     (r[4]  || '').trim(),
        dateExp:    (r[5]  || '').trim(),
        stockInit:  parseNum(r[6]),
        pa:         (r[7]  || '').trim(),
        prixUnit:   (r[8]  || '').trim(),
        sorties:    parseNum(r[9]),
        change:     parseNum(r[10]),
        stockActuel:parseNum(r[11]),
        obs:        (r[12] || '').trim(),
        consEstMo:  parseNum(r[13]),
        moRest:     parseNum(r[14]),
        quantMin:   (r[15] || '').trim(),
        valeur:     parseNum(r[16]),
        etatsUnis:  (r[17] || '').trim(),
        essentiel:  (r[18] || '').trim(),
        famille:    (r[19] || '').trim()
      };
    });

    // Keep the legacy global in sync (inventory only) so dispensation.js works.
    if (cfg.syncGlobal) {
      products = view.products;
      var noInv = document.getElementById('disp-no-inv');
      if (noInv) noInv.style.display = 'none';
    }

    buildFamilyFilter();
    buildCategoryFilter();
    updateStats();
    showTable();
    view.render();
  }

  // ── Stats & filters ──
  function updateStats() {
    var n    = view.products.length;
    var low  = view.products.filter(function (p) { return getStockStatus(p) === 'low';      }).length;
    var crit = view.products.filter(function (p) { return getStockStatus(p) === 'critical'; }).length;
    $('sv-total').textContent    = n;
    $('sv-low').textContent      = low;
    $('sv-critical').textContent = crit;

    // Total inventory value = sum of (unit price × current stock) over all meds.
    var totalValue = 0;
    view.products.forEach(function (p) {
      var price = parsePrixUnit(p.prixUnit);
      if (price !== null && p.stockActuel !== '' && !isNaN(p.stockActuel)) {
        totalValue += price * p.stockActuel;
      }
    });
    $('meta-value').textContent = 'Valeur totale : ' + Math.round(totalValue).toLocaleString() + ' FCFA';
  }

  function buildCategoryFilter() {
    var sel = $('category-filter');
    while (sel.options.length > 1) sel.remove(1);
    var cats = [];
    view.products.forEach(function (p) { if (p.category && cats.indexOf(p.category) === -1) cats.push(p.category); });
    cats.sort().forEach(function (c) {
      var o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o);
    });
  }

  function buildFamilyFilter() {
    var sel = $('family-filter');
    while (sel.options.length > 1) sel.remove(1);
    var fams = [];
    view.products.forEach(function (p) { if (p.famille && fams.indexOf(p.famille) === -1) fams.push(p.famille); });
    fams.sort().forEach(function (f) {
      var o = document.createElement('option'); o.value = f; o.textContent = f; sel.appendChild(o);
    });
  }

  // ── Table render ──
  view.render = function () {
    var q  = ($('search-input').value || '').toLowerCase();
    var sf = $('stock-filter').value;
    var ff = $('family-filter').value;
    var cf = $('category-filter').value;

    var rows = view.products.filter(function (p) {
      var s = getStockStatus(p);
      if (sf !== 'all' && s !== sf) return false;
      if (ff !== 'all' && p.famille  !== ff) return false;
      if (cf !== 'all' && p.category !== cf) return false;
      if (q && !(p.code + ' ' + p.product + ' ' + p.dose + ' ' + p.famille).toLowerCase().includes(q)) return false;
      return true;
    });

    if (view.sortCol) {
      rows = rows.slice().sort(function (a, b) {
        var av = a[view.sortCol], bv = b[view.sortCol];
        if (av === '' || av === undefined) av = view.sortDir > 0 ?  Infinity : -Infinity;
        if (bv === '' || bv === undefined) bv = view.sortDir > 0 ?  Infinity : -Infinity;
        return av < bv ? -view.sortDir : av > bv ? view.sortDir : 0;
      });
    }

    var cats = [];
    rows.forEach(function (p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });

    var html = '';
    cats.forEach(function (cat) {
      var catRows = rows.filter(function (p) { return p.category === cat; });
      if (cat) html += '<tr class="cat-row"><td colspan="13">' + cat + '</td></tr>';
      catRows.forEach(function (p) {
        var s  = getStockStatus(p);
        var rb = s === 'critical' ? 'background:#FFF5F5' : s === 'low' ? 'background:#FFFBF0' : '';
        // Reduced column set (12), order must match the <thead> in index.html:
        // produit, dose, format, exp, stock actuel, statut, système, famille,
        // cons mens, mois, quantité min, essentiel.
        html += '<tr style="' + rb + '">' +
          '<td class="product-cell">' + fmt(p.product)  + '</td>' +
          '<td>'  + fmt(p.dose)   + '</td>' +
          '<td>'  + (p.format ? '<span class="badge badge-neutral">' + p.format + '</span>' : '—') + '</td>' +
          '<td>'  + expBadge(p.dateExp) + '</td>' +
          '<td class="num-cell">' + fmt(p.stockActuel) + stockBar(p) + '</td>' +
          '<td>'  + statusBadge(p) + '</td>' +
          '<td>'  + (p.etatsUnis ? '<span class="badge badge-info">' + p.etatsUnis + '</span>' : '—') + '</td>' +
          '<td>'  + fmt(p.famille)   + '</td>' +
          '<td class="num-cell">' + fmt(p.prixUnit)   + '</td>' +
          '<td class="num-cell">' + fmt(p.consEstMo)  + '</td>' +
          '<td class="num-cell">' + (p.moRest !== '' ? Number(p.moRest).toFixed(1) : '—') + '</td>' +
          '<td class="num-cell">' + fmt(p.quantMin)   + '</td>' +
          '<td>'  + fmt(p.essentiel) + '</td>' +
        '</tr>';
      });
    });

    $('table-body').innerHTML =
      html || '<tr><td colspan="13" style="text-align:center;padding:24px;color:var(--color-text-secondary,#6b6b67)">' +
              tr('noResults') + '</td></tr>';
  };

  // ── Translation (this view's own labels/headers) ──
  view.applyLang = function () {
    var setText = function (base, key) { var el = $(base); if (el) el.textContent = tr(key); };
    setText('sl-total', 'slTotal');
    setText('sl-low', 'slLow');
    setText('sl-critical', 'slCritical');
    setText('f-all', 'fAll');
    setText('f-ok', 'fOk');
    setText('f-low', 'fLow');
    setText('f-critical', 'fCritical');
    setText('f-fam-all', 'fFamAll');
    setText('f-cat-all', 'fCatAll');
    setText('charger-inv', 'updInv');
    var si = $('search-input'); if (si) si.placeholder = tr('searchPlaceholder');

    // Table headers are now static French (see index.html) — not translated here.

    if (view.products.length) {
      view.render();
    } else {
      var sm = $('state-msg'); if (sm) sm.textContent = tr('statePrompt');
    }
  };

  // ── Wire this view's own listeners (scoped to its table — no global handlers) ──
  (function wire() {
    var si = $('search-input');   if (si) si.addEventListener('input',  view.render);
    var sf = $('stock-filter');   if (sf) sf.addEventListener('change', view.render);
    var cf = $('category-filter');if (cf) cf.addEventListener('change', view.render);
    var ff = $('family-filter');  if (ff) ff.addEventListener('change', view.render);

    var table = $('inv-table');
    if (table) {
      table.querySelectorAll('thead th[data-col]').forEach(function (th) {
        th.addEventListener('click', function () {
          var col = th.dataset.col;
          if (view.sortCol === col) view.sortDir *= -1;
          else { view.sortCol = col; view.sortDir = 1; }
          view.render();
        });
      });
    }
  })();

  return view;
}

// ── Instances ───────────────────────────────────────────────────────────────────
var inventoryView = createSheetView({ tab: SHEET_TAB,         suffix: '',      syncGlobal: true });
var forfaitView   = createSheetView({ tab: SHEET_TAB_FORFAIT, suffix: '-forf'                    });

// ── Legacy shims (called from auth.js, dispensation.js, historique.js, HTML) ──────
function loadInventory() { inventoryView.load(); }
function loadForfait()   { forfaitView.load(); }
function renderTable()   { inventoryView.render(); }
