// ── Config ──────────────────────────────────────────────────────────────────
var SHEET_ID  = '1Ey8cGl4y0UvxGx7N3Wy9dvrM4E1PYTnaTbGKd9t-73w';
var SHEET_TAB = 'Pharmacie';
var API_KEY   = 'AIzaSyB_uROvkIGtYfjLclDRcsKftjpyJOf9COs';

// ── State ────────────────────────────────────────────────────────────────────
var products = [];
var sortCol  = null;
var sortDir  = 1;

// ── Load ─────────────────────────────────────────────────────────────────────
function loadInventory() {
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + SHEET_ID +
            '/values/' + SHEET_TAB + '!A:T?key=' + API_KEY;
  showState('<div class="spinner"></div><div style="margin-top:12px">Chargement...</div>');
  hideAll();
  fetch(url)
    .then(function(res) { return res.json(); })
    .then(function(data) {
      var dataRows = (data.values || []).filter(function(r) {
        return r.length >= 3 && r[2] && r[2].trim() && !isHeaderRow(r);
      });
      processRows(dataRows);
    })
    .catch(function() {
      showState('<div style="font-size:32px">❌</div><div>' + tr('errEmpty') + '</div>');
    });
}

function isHeaderRow(r) {
  var v = (r[2] || '').toLowerCase().trim();
  return v === 'produit' || v === 'product' || v === 'produits';
}

function parseNum(v) {
  var n = parseFloat((v || '').toString().replace(/\s/g, '').replace(',', '.'));
  return isNaN(n) ? '' : n;
}

function processRows(rows) {
  if (!rows.length) {
    showState('<div style="font-size:32px">⚠️</div><div>' + tr('errEmpty') + '</div>');
    return;
  }
  products = rows.map(function(r) {
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
  buildFamilyFilter();
  buildCategoryFilter();
  updateStats();
  showTable();
  renderTable();
  document.getElementById('disp-no-inv').style.display = 'none';
}

// ── UI state helpers ──────────────────────────────────────────────────────────
function showState(html) {
  var el = document.getElementById('main-state');
  el.style.display = 'block';
  el.innerHTML = '<div class="state-box">' + html + '</div>';
}

function hideAll() {
  ['meta-bar','stats-row','filter-bar','table-section'].forEach(function(id) {
    document.getElementById(id).style.display = 'none';
  });
}

function showTable() {
  document.getElementById('main-state').style.display    = 'none';
  document.getElementById('meta-bar').style.display      = 'flex';
  document.getElementById('stats-row').style.display     = 'grid';
  document.getElementById('filter-bar').style.display    = 'flex';
  document.getElementById('table-section').style.display = 'block';
}

// ── Stats & filters ───────────────────────────────────────────────────────────
function getStockStatus(p) {
  if (p.moRest !== '' && p.moRest <= 1) return 'critical';
  if (p.moRest !== '' && p.moRest < 6)  return 'low';
  if (p.stockActuel !== '' && p.stockInit !== '' && p.stockInit > 0 &&
      (p.stockActuel / p.stockInit) < 0.1) return 'critical';
  return 'ok';
}

function updateStats() {
  var n    = products.length;
  var low  = products.filter(function(p) { return getStockStatus(p) === 'low';      }).length;
  var crit = products.filter(function(p) { return getStockStatus(p) === 'critical'; }).length;
  document.getElementById('sv-total').textContent = n;
  document.getElementById('sv-low').textContent   = low;
  document.getElementById('sv-critical').textContent = crit;
  var cats = [];
  products.forEach(function(p) { if (p.category && cats.indexOf(p.category) === -1) cats.push(p.category); });
  document.getElementById('cat-badge').textContent     = cats.join(' · ') || '—';
  document.getElementById('meta-products').textContent = n + ' ' + tr('metaProducts');
  document.getElementById('meta-updated').textContent  = tr('metaUpdated');
}

function buildCategoryFilter() {
  var sel  = document.getElementById('category-filter');
  while (sel.options.length > 1) sel.remove(1);
  var cats = [];
  products.forEach(function(p) { if (p.category && cats.indexOf(p.category) === -1) cats.push(p.category); });
  cats.sort().forEach(function(c) {
    var o = document.createElement('option'); o.value = c; o.textContent = c; sel.appendChild(o);
  });
}

function buildFamilyFilter() {
  var sel  = document.getElementById('family-filter');
  while (sel.options.length > 1) sel.remove(1);
  var fams = [];
  products.forEach(function(p) { if (p.famille && fams.indexOf(p.famille) === -1) fams.push(p.famille); });
  fams.sort().forEach(function(f) {
    var o = document.createElement('option'); o.value = f; o.textContent = f; sel.appendChild(o);
  });
}

// ── Table render ──────────────────────────────────────────────────────────────
function fmt(v) { return (v === '' || v === null || v === undefined) ? '—' : v; }

function stockBar(p) {
  if (p.stockInit === '' || p.stockActuel === '') return '';
  var pct   = p.stockInit > 0 ? Math.min(100, Math.round(p.stockActuel / p.stockInit * 100)) : 0;
  var s     = getStockStatus(p);
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

function renderTable() {
  var q  = (document.getElementById('search-input').value  || '').toLowerCase();
  var sf = document.getElementById('stock-filter').value;
  var ff = document.getElementById('family-filter').value;
  var cf = document.getElementById('category-filter').value;

  var rows = products.filter(function(p) {
    var s = getStockStatus(p);
    if (sf !== 'all' && s !== sf) return false;
    if (ff !== 'all' && p.famille  !== ff) return false;
    if (cf !== 'all' && p.category !== cf) return false;
    if (q && !(p.code + ' ' + p.product + ' ' + p.dose + ' ' + p.famille).toLowerCase().includes(q)) return false;
    return true;
  });

  if (sortCol) {
    rows = rows.slice().sort(function(a, b) {
      var av = a[sortCol], bv = b[sortCol];
      if (av === '' || av === undefined) av = sortDir > 0 ?  Infinity : -Infinity;
      if (bv === '' || bv === undefined) bv = sortDir > 0 ?  Infinity : -Infinity;
      return av < bv ? -sortDir : av > bv ? sortDir : 0;
    });
  }

  var cats = [];
  rows.forEach(function(p) { if (cats.indexOf(p.category) === -1) cats.push(p.category); });

  var html = '';
  cats.forEach(function(cat) {
    var catRows = rows.filter(function(p) { return p.category === cat; });
    if (cat) html += '<tr class="cat-row"><td colspan="19">' + cat + '</td></tr>';
    catRows.forEach(function(p) {
      var s  = getStockStatus(p);
      var rb = s === 'critical' ? 'background:#FFF5F5' : s === 'low' ? 'background:#FFFBF0' : '';
      html += '<tr style="' + rb + '">' +
        '<td class="code-cell">'    + fmt(p.code)     + '</td>' +
        '<td class="product-cell">' + fmt(p.product)  + '</td>' +
        '<td>'  + fmt(p.dose)   + '</td>' +
        '<td>'  + (p.format ? '<span class="badge badge-neutral">' + p.format + '</span>' : '—') + '</td>' +
        '<td>'  + expBadge(p.dateExp) + '</td>' +
        '<td class="num-cell">' + fmt(p.stockInit)  + '</td>' +
        '<td>'  + fmt(p.pa)     + '</td>' +
        '<td class="num-cell">' + fmt(p.prixUnit)   + '</td>' +
        '<td class="num-cell">' + fmt(p.sorties)    + '</td>' +
        '<td class="num-cell">' + fmt(p.change)     + '</td>' +
        '<td class="num-cell">' + stockBar(p) + fmt(p.stockActuel) + '</td>' +
        '<td>'  + statusBadge(p) + '</td>' +
        '<td class="num-cell">' + fmt(p.consEstMo)  + '</td>' +
        '<td class="num-cell">' + (p.moRest !== '' ? Number(p.moRest).toFixed(1) : '—') + '</td>' +
        '<td class="num-cell">' + fmt(p.quantMin)   + '</td>' +
        '<td class="num-cell">' + (p.valeur !== '' ? Number(p.valeur).toLocaleString() + ' FCFA' : '—') + '</td>' +
        '<td>'  + (p.etatsUnis ? '<span class="badge badge-info">' + p.etatsUnis + '</span>' : '—') + '</td>' +
        '<td>'  + fmt(p.essentiel) + '</td>' +
        '<td>'  + fmt(p.famille)   + '</td>' +
      '</tr>';
    });
  });

  document.getElementById('table-body').innerHTML =
    html || '<tr><td colspan="19" style="text-align:center;padding:24px;color:var(--color-text-secondary,#6b6b67)">' +
            tr('noResults') + '</td></tr>';
}
