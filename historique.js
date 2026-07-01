// ── Config ────────────────────────────────────────────────────────────────────
var DISP_SHEET_ID  = '1qqMMRvP61bcWs930iZEf1Qxumb1Cgi_WcsviLW1SkcY';
var DISP_SHEET_TAB = 'Dispensation';

// ── State ─────────────────────────────────────────────────────────────────────
var histRows       = [];   // all rows: {rowIndex, dossier, date, time, product, dose, format, unitPrice, qty, lineTotal, forfait}
var histSortCol    = 'date'; // default: sort by date…
var histSortDir    = -1;     // …descending (newest first)
var pendingDelete  = null; // {rowIndex, display}

// ── Load ──────────────────────────────────────────────────────────────────────
function loadHistorique() {
  var base   = 'https://sheets.googleapis.com/v4/spreadsheets/' + DISP_SHEET_ID +
               '/values/' + DISP_SHEET_TAB;
  var urlFmt = base;                                          // formatted values → display (honours the sheet's date/time format)
  var urlNum = base + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER'; // raw values → date/time serials for sort/filter
  histShowState('<div class="spinner"></div><div style="margin-top:12px">Chargement...</div>');
  document.getElementById('hist-table-section').style.display = 'none';
  document.getElementById('hist-filter-bar').style.display    = 'none';

  // Sheet schema (11 cols): A IsAddition, B Dossier, C Date, D Time, E Product,
  // F Dose, G Format, H UnitPrice, I Qty, J LineTotal, K Forfait.
  var isHeader = function (r) {
    return (r[1] || '').toString().toLowerCase().indexOf('dossier') !== -1 ||
           (r[4] || '').toString().toLowerCase().indexOf('produit') !== -1 ||
           (r[4] || '').toString().toLowerCase().indexOf('product') !== -1;
  };
  var cell = function (r, i) { return (r && r[i] != null ? r[i] : '').toString().trim(); };

  ensureFreshToken(function () {
    // Two reads of the same range: one formatted (for display), one unformatted
    // (numbers) so date/time can be sorted/filtered independently of how the
    // sheet displays them.
    Promise.all([
      authFetch(urlFmt).then(function (res) { return res.json(); }),
      authFetch(urlNum).then(function (res) { return res.json(); })
    ])
      .then(function (results) {
        var valuesF = (results[0] && results[0].values) || [];  // formatted display strings
        var valuesN = (results[1] && results[1].values) || [];  // raw values (numbers for real dates/times)
        histRows = [];
        for (var i = 0; i < valuesF.length; i++) {
          var r = valuesF[i];
          if (!r || r.length < 5 || isHeader(r)) continue;      // skip header / malformed rows
          var u = valuesN[i] || [];
          histRows.push({
            rowIndex:   i + 1,                                  // 1-based sheet row
            isAddition: cell(r, 0).toUpperCase() === 'TRUE',
            dossier:    cell(r, 1),
            date:       cell(r, 2),                             // display, honours the sheet's format
            time:       cell(r, 3),
            dateNum:    (typeof u[2] === 'number') ? u[2] : NaN, // serial (format-independent)
            timeNum:    (typeof u[3] === 'number') ? u[3] : NaN,
            product:    cell(r, 4),
            dose:       cell(r, 5),
            format:     cell(r, 6),
            unitPrice:  cell(r, 7),
            qty:        cell(r, 8),
            lineTotal:  cell(r, 9),
            forfait:    cell(r, 10)
          });
        }
        if (!histRows.length) {
          histShowState('<div style="font-size:32px">⚠️</div><div>' + tr('histErrEmpty') + '</div>');
          return;
        }
        document.getElementById('hist-filter-bar').style.display = 'flex';
        histShowTable();
        renderHistorique();
      })
      .catch(function () {
        histShowState('<div style="font-size:32px">❌</div><div>' + tr('histErrEmpty') + '</div>');
      });
  });
}

// Convert a yyyy-mm-dd string (from an <input type=date>) to a Google Sheets serial
// number, so date-range filtering compares against dateNum regardless of display
// format. Sheets' serial epoch is 1899-12-30.
function isoToSerial(iso) {
  var p = (iso || '').split('-');
  if (p.length !== 3) return NaN;
  var ms    = Date.UTC(+p[0], +p[1] - 1, +p[2]);
  var epoch = Date.UTC(1899, 11, 30);
  return Math.round((ms - epoch) / 86400000);
}

// ── UI helpers ────────────────────────────────────────────────────────────────
function histShowState(html) {
  var el = document.getElementById('hist-state');
  el.style.display = 'block';
  el.innerHTML = '<div class="state-box">' + html + '</div>';
}

function histShowTable() {
  document.getElementById('hist-state').style.display        = 'none';
  document.getElementById('hist-table-section').style.display = 'block';
}

function clearHistFilters() {
  document.getElementById('hist-search-dossier').value = '';
  document.getElementById('hist-date-from').value      = '';
  document.getElementById('hist-date-to').value        = '';
  renderHistorique();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderHistorique() {
  var q        = (document.getElementById('hist-search-dossier').value || '').toLowerCase().trim();
  var dateFrom = document.getElementById('hist-date-from').value;
  var dateTo   = document.getElementById('hist-date-to').value;
  var fromNum  = dateFrom ? isoToSerial(dateFrom) : null;
  var toNum    = dateTo   ? isoToSerial(dateTo)   : null;

  var rows = histRows.filter(function(r) {
    if (q && !r.dossier.toLowerCase().includes(q)) return false;
    // Compare by serial number so it works whatever date format the sheet uses.
    if (fromNum !== null && !isNaN(r.dateNum) && r.dateNum < fromNum) return false;
    if (toNum   !== null && !isNaN(r.dateNum) && r.dateNum > toNum)   return false;
    return true;
  });

  if (histSortCol) {
    // Date and Heure sort by their serial number (independent of display format);
    // every other column sorts as text.
    var num = function (row, col) {
      if (col === 'date') return isNaN(row.dateNum) ? -Infinity : row.dateNum;
      if (col === 'time') return isNaN(row.timeNum) ? -Infinity : row.timeNum;
      return null;
    };
    rows = rows.slice().sort(function(a, b) {
      var an = num(a, histSortCol);
      if (an !== null) {
        var bn = num(b, histSortCol);
        if (an !== bn) return an < bn ? -histSortDir : histSortDir;
        // Tie-breaker: sorting by date then falls back to heure (same direction),
        // so the default is date descending, then heure descending.
        if (histSortCol === 'date') {
          var at = isNaN(a.timeNum) ? -Infinity : a.timeNum;
          var bt = isNaN(b.timeNum) ? -Infinity : b.timeNum;
          if (at !== bt) return at < bt ? -histSortDir : histSortDir;
        }
        return 0;
      }
      var av = a[histSortCol] || '', bv = b[histSortCol] || '';
      if (av !== bv) return av < bv ? -histSortDir : histSortDir;
      return 0;
    });
  }

  var html = '';
  rows.forEach(function(r) {
    var forfaitBadge = r.forfait === 'TRUE'
      ? '<span class="badge badge-info">✓</span>'
      : '<span class="badge badge-neutral">—</span>';
    var typeBadge = r.isAddition
      ? '<span class="badge badge-ok">' + tr('addTypeAdd') + '</span>'
      : '<span class="badge badge-neutral">' + tr('addTypeDisp') + '</span>';
    html += '<tr>' +
      '<td style="text-align:center">' + typeBadge + '</td>' +
      '<td class="code-cell">'  + fmt(r.dossier)   + '</td>' +
      '<td>'                    + fmt(r.date)       + '</td>' +
      '<td>'                    + fmt(r.time)       + '</td>' +
      '<td class="product-cell">'+ fmt(r.product)  + '</td>' +
      '<td>'                    + fmt(r.dose)       + '</td>' +
      '<td>'                    + (r.format ? '<span class="badge badge-neutral">' + r.format + '</span>' : '—') + '</td>' +
      '<td class="num-cell">'   + (r.unitPrice ? r.unitPrice + ' FCFA' : '—') + '</td>' +
      '<td class="num-cell">'   + fmt(r.qty)        + '</td>' +
      '<td class="num-cell">'   + (r.lineTotal ? Number(r.lineTotal).toLocaleString() + ' FCFA' : '—') + '</td>' +
      '<td style="text-align:center">' + forfaitBadge + '</td>' +
    '</tr>';
  });

  document.getElementById('hist-table-body').innerHTML =
    html || '<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--color-text-secondary,#6b6b67)">' +
            tr('noResults') + '</td></tr>';
}

function escapeAttr(s) { return (s || '').replace(/'/g, "\\'"); }


//#deprecated, never called#
// ── Delete flow ───────────────────────────────────────────────────────────────
function requestDelete(rowIndex, dossier, date, product, dose) {
  pendingDelete = rowIndex;
  document.getElementById('modal-title').textContent = tr('modalTitle');
  document.getElementById('modal-body').innerHTML =
    tr('modalBody') + '<br/><br/>' +
    '<strong>' + tr('hhDossier') + ':</strong> ' + dossier + '&nbsp;&nbsp;' +
    '<strong>' + tr('hhDate')    + ':</strong> ' + date    + '<br/>' +
    '<strong>' + tr('hhProduct') + ':</strong> ' + product + '&nbsp;&nbsp;' +
    '<strong>' + tr('hhDose')    + ':</strong> ' + dose;
  document.getElementById('modal-btn-cancel').textContent  = tr('modalCancel');
  document.getElementById('modal-btn-confirm').textContent = tr('modalConfirm');
  document.getElementById('delete-modal').style.display = 'flex';
}

//#deprecated, never called#
function closeDeleteModal() {
  pendingDelete = null;
  document.getElementById('delete-modal').style.display = 'none';
}

//#deprecated, never called#
function confirmDelete() {
  if (pendingDelete === null) return;
  var rowIndex = pendingDelete;
  closeDeleteModal();

  fetch(APPS_SCRIPT_URL, {
    method: 'POST',
    body: JSON.stringify({ action: 'delete', rowIndices: [rowIndex] })
  })
  .then(function(res) { return res.json(); })
  .then(function(data) {
    if (data.status === 'ok') {
      showToast(tr('toastDeleted'), 'success');
      loadHistorique(); // reload to reflect deletion
      loadInventory();
    } else {
      showToast(tr('toastDeleteError'), 'error');
    }
  })
  .catch(function() { showToast(tr('toastDeleteError'), 'error'); });
}

// ── Sort ──────────────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', function() {
  document.querySelectorAll('#hist-table thead th[data-col]').forEach(function(th) {
    th.addEventListener('click', function() {
      var col = th.dataset.col;
      if (histSortCol === col) histSortDir *= -1;
      else { histSortCol = col; histSortDir = 1; }
      renderHistorique();
    });
  });

  document.getElementById('hist-search-dossier').addEventListener('input',  renderHistorique);
  document.getElementById('hist-date-from').addEventListener('change', renderHistorique);
  document.getElementById('hist-date-to').addEventListener('change',   renderHistorique);

  // Close modal on backdrop click
  document.getElementById('delete-modal').addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
  });
});
