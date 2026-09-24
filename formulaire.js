// ── Formulaire (drug formulary) page ─────────────────────────────────────────
// Read-only reference table backed by its OWN spreadsheet (the "ORDRE ALPHA" tab),
// separate from the inventory spreadsheet. Only columns A-G are read/shown:
//   A Produit | B Doses | C Formats | D Système | E Famille | F Posologie | G Conseil
// (any further columns in the sheet are ignored). It offers the same search box and
// two cascading filters as Stock Normal — Système then Famille — but NO stock-status
// filter, since this sheet has no stock data. Rows are grouped under Système headings.
//
// Depends on globals from earlier scripts: normalize() + fmt() (inventory.js) and
// ensureFreshToken() + authFetch() (auth.js). Load order is enforced in index.html.
var FORM_SHEET_ID = '102G9UsaS-jtAohxJNMNeXp78zt8DKmJVGjj7zl2PpFc';
var FORM_TAB      = 'ORDRE ALPHA';

var formulaireView = (function () {
  var rows    = [];        // parsed products
  var sortCol = null;
  var sortDir = 1;
  var loaded  = false;

  function $(id) { return document.getElementById(id); }

  // ── UI state ──
  function showState(html) {
    var el = $('form-state');
    el.style.display = 'block';
    el.innerHTML = '<div class="state-box">' + html + '</div>';
  }
  function hideBars() {
    ['form-filter-bar', 'form-table-section'].forEach(function (id) {
      var el = $(id); if (el) el.style.display = 'none';
    });
  }
  function showTable() {
    $('form-state').style.display         = 'none';
    $('form-filter-bar').style.display    = 'flex';
    $('form-table-section').style.display = 'block';
  }

  // ── Load ──
  function load(onDone) {
    // Sheet name has a space, so URL-encode it ("ORDRE%20ALPHA"); A:G caps the read
    // to the seven relevant columns.
    var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + FORM_SHEET_ID +
              '/values/' + encodeURIComponent(FORM_TAB) + '!A:G';
    showState('<div class="spinner"></div><div style="margin-top:12px">Chargement...</div>');
    hideBars();

    ensureFreshToken(function () {
      authFetch(url)
        .then(function (res) { return res.json(); })
        .then(function (data) {
          processRows(data.values || []);
          loaded = true;
          if (typeof onDone === 'function') onDone();
        })
        .catch(function () {
          showState('<div style="font-size:32px">❌</div><div>Erreur de chargement du formulaire.</div>');
          if (typeof onDone === 'function') onDone();
        });
    });
  }

  // A header row is any row whose first cell is the "Produit" label.
  function isHeaderRow(r) {
    var v = (r[0] || '').toLowerCase().trim();
    return v === 'produit' || v === 'produits' || v === 'product';
  }

  function processRows(values) {
    rows = [];
    for (var i = 0; i < values.length; i++) {
      var r = values[i];
      if (!r || !r[0] || !r[0].trim() || isHeaderRow(r)) continue;
      rows.push({
        product:   (r[0] || '').trim(),
        doses:     (r[1] || '').trim(),
        formats:   (r[2] || '').trim(),
        systeme:   (r[3] || '').trim(),
        famille:   (r[4] || '').trim(),
        posologie: (r[5] || '').trim(),
        conseil:   (r[6] || '').trim()
      });
    }
    if (!rows.length) {
      showState('<div style="font-size:32px">⚠️</div><div>Aucune donnée dans le formulaire.</div>');
      return;
    }
    buildSystemeFilter();
    buildFamilleFilter();
    showTable();
    render();
  }

  // ── Filters ──
  // French-locale sort so accented labels land in correct alphabetical position.
  function frSort(a, b) { return a.localeCompare(b, 'fr', { sensitivity: 'base' }); }

  function buildSystemeFilter() {
    var sel = $('form-systeme-filter');
    while (sel.options.length > 1) sel.remove(1);
    var list = [];
    rows.forEach(function (p) { if (p.systeme && list.indexOf(p.systeme) === -1) list.push(p.systeme); });
    list.sort(frSort).forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
    });
  }

  // Familles are scoped to the currently-selected Système (mirrors Stock Normal).
  function buildFamilleFilter() {
    var sel  = $('form-famille-filter');
    var sysf = $('form-systeme-filter').value;
    var prev = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    var list = [];
    rows.forEach(function (p) {
      if (sysf !== 'all' && p.systeme !== sysf) return;
      if (p.famille && list.indexOf(p.famille) === -1) list.push(p.famille);
    });
    list.sort(frSort).forEach(function (v) {
      var o = document.createElement('option'); o.value = v; o.textContent = v; sel.appendChild(o);
    });
    sel.value = (prev && list.indexOf(prev) !== -1) ? prev : 'all';
  }

  // ── Render ──
  function render() {
    var q    = normalize($('form-search-input').value);   // accent-insensitive
    var sysf = $('form-systeme-filter').value;
    var famf = $('form-famille-filter').value;

    var out = rows.filter(function (p) {
      if (sysf !== 'all' && p.systeme !== sysf) return false;
      if (famf !== 'all' && p.famille !== famf) return false;
      if (q && !normalize(p.product + ' ' + p.doses + ' ' + p.formats + ' ' + p.systeme +
                          ' ' + p.famille + ' ' + p.posologie + ' ' + p.conseil).includes(q)) return false;
      return true;
    });

    if (sortCol) {
      out = out.slice().sort(function (a, b) {
        var av = (a[sortCol] || '').toString().toLowerCase();
        var bv = (b[sortCol] || '').toString().toLowerCase();
        return av < bv ? -sortDir : av > bv ? sortDir : 0;
      });
    }

    // Group under Système headings, ordered alphabetically (fr).
    var systemes = [];
    out.forEach(function (p) { if (systemes.indexOf(p.systeme) === -1) systemes.push(p.systeme); });
    systemes.sort(frSort);

    var html = '';
    systemes.forEach(function (sys) {
      var group = out.filter(function (p) { return p.systeme === sys; });
      if (sys) html += '<tr class="cat-row"><td colspan="6">' + sys + '</td></tr>';
      group.forEach(function (p) {
        html += '<tr>' +
          '<td class="product-cell">' + fmt(p.product)   + '</td>' +
          '<td>' + fmt(p.doses)     + '</td>' +
          '<td>' + fmt(p.formats)   + '</td>' +
          '<td>' + fmt(p.famille)   + '</td>' +
          '<td>' + fmt(p.posologie) + '</td>' +
          '<td>' + fmt(p.conseil)   + '</td>' +
        '</tr>';
      });
    });

    $('form-table-body').innerHTML = html ||
      '<tr><td colspan="6" style="text-align:center;padding:24px;color:var(--color-text-secondary,#6b6b67)">Aucun résultat</td></tr>';
  }

  // ── Wire listeners (scoped to this page's own controls) ──
  (function wire() {
    var si = $('form-search-input');   if (si) si.addEventListener('input',  render);
    // Changing Système re-scopes the Famille list, then re-renders.
    var sy = $('form-systeme-filter'); if (sy) sy.addEventListener('change', function () { buildFamilleFilter(); render(); });
    var fa = $('form-famille-filter'); if (fa) fa.addEventListener('change', render);

    var table = $('form-table');
    if (table) {
      table.querySelectorAll('thead th[data-col]').forEach(function (th) {
        th.addEventListener('click', function () {
          var col = th.dataset.col;
          if (sortCol === col) sortDir *= -1;
          else { sortCol = col; sortDir = 1; }
          render();
        });
      });
    }
  })();

  return {
    load: load, render: render,
    // Parsed rows, read by addstock.js to populate the new-medication dropdowns.
    get products() { return rows; },
    get loaded()   { return loaded; }
  };
})();

// Legacy shim (called from the "Charger le formulaire" button in index.html).
function loadFormulaire() { formulaireView.load(); }
