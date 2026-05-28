// ── Config ────────────────────────────────────────────────────────────────────
var DISP_SHEET_ID  = '1qqMMRvP61bcWs930iZEf1Qxumb1Cgi_WcsviLW1SkcY';
var DISP_SHEET_TAB = 'Dispensation';

// ── State ─────────────────────────────────────────────────────────────────────
var histRows       = [];   // all rows: {rowIndex, dossier, date, time, product, dose, format, unitPrice, qty, lineTotal, forfait}
var histSortCol    = null;
var histSortDir    = 1;
var pendingDelete  = null; // {rowIndex, display}

// ── Load ──────────────────────────────────────────────────────────────────────
function loadHistorique() {
  var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + DISP_SHEET_ID +
            '/values/' + DISP_SHEET_TAB;
  histShowState('<div class="spinner"></div><div style="margin-top:12px">Chargement...</div>');
  document.getElementById('hist-table-section').style.display = 'none';
  document.getElementById('hist-filter-bar').style.display    = 'none';

  ensureFreshToken(function () {
    authFetch(url)
      .then(function (res) { return res.json(); })
      .then(function (data) {

            var values = data.values || [];
            // skip header row if present
            var isHeader = function(r) {
              return (r[0] || '').toLowerCase().includes('dossier') ||
                    (r[3] || '').toLowerCase().includes('produit') ||
                    (r[3] || '').toLowerCase().includes('product');
            };
            var dataRows = values.filter(function(r) { return r.length >= 4 && !isHeader(r); });
            if (!dataRows.length) {
              histShowState('<div style="font-size:32px">⚠️</div><div>' + tr('histErrEmpty') + '</div>');
              return;
            }
            // rowIndex = 1-based sheet row (account for possible header row)
            var offset = isHeader(values[0]) ? 2 : 1;
            histRows = dataRows.map(function(r, i) {
              return {
                rowIndex:  i + offset,
                dossier:   (r[0] || '').trim(),
                date:      (r[1] || '').trim(),
                time:      (r[2] || '').trim(),
                product:   (r[3] || '').trim(),
                dose:      (r[4] || '').trim(),
                format:    (r[5] || '').trim(),
                unitPrice: (r[6] || '').trim(),
                qty:       (r[7] || '').trim(),
                lineTotal: (r[8] || '').trim(),
                forfait:   (r[9] || '').trim()
              };
            });
            document.getElementById('hist-filter-bar').style.display = 'flex';
            histShowTable();
            renderHistorique();
          })
        })
      .catch(function () {
        histShowState('<div style="font-size:32px">❌</div><div>' + tr('histErrEmpty') + '</div>');
      });
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

  var rows = histRows.filter(function(r) {
    if (q && !r.dossier.toLowerCase().includes(q)) return false;
    // date comparison — r.date is stored as typed (e.g. 2026-05-12)
    if (dateFrom && r.date && r.date < dateFrom) return false;
    if (dateTo   && r.date && r.date > dateTo)   return false;
    return true;
  });

  if (histSortCol) {
    rows = rows.slice().sort(function(a, b) {
      var av = a[histSortCol] || '';
      var bv = b[histSortCol] || '';
      return av < bv ? -histSortDir : av > bv ? histSortDir : 0;
    });
  }

  var html = '';
  rows.forEach(function(r) {
    var forfaitBadge = r.forfait === 'TRUE'
      ? '<span class="badge badge-info">✓</span>'
      : '<span class="badge badge-neutral">—</span>';
    html += '<tr>' +
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
      '<td style="text-align:center">' +
        '<button class="remove-btn" onclick="requestDelete(' + r.rowIndex + ',\'' +
          escapeAttr(r.dossier) + '\',\'' + escapeAttr(r.date) + '\',\'' +
          escapeAttr(r.product) + '\',\'' + escapeAttr(r.dose) + '\')" title="' + tr('modalConfirm') + '">×</button>' +
      '</td>' +
    '</tr>';
  });

  document.getElementById('hist-table-body').innerHTML =
    html || '<tr><td colspan="11" style="text-align:center;padding:24px;color:var(--color-text-secondary,#6b6b67)">' +
            tr('noResults') + '</td></tr>';
}

function escapeAttr(s) { return (s || '').replace(/'/g, "\\'"); }

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

function closeDeleteModal() {
  pendingDelete = null;
  document.getElementById('delete-modal').style.display = 'none';
}

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
