// ── Config ────────────────────────────────────────────────────────────────────
var DISP_SHEET_ID  = '1qqMMRvP61bcWs930iZEf1Qxumb1Cgi_WcsviLW1SkcY';
var DISP_SHEET_TAB = 'Dispensation';

// ── State ─────────────────────────────────────────────────────────────────────
var histRows       = [];   // all rows: {rowIndex, dossier, date, time, product, dose, format, unitPrice, qty, lineTotal, forfait}
var histSortCol    = 'date'; // default: sort by date…
var histSortDir    = -1;     // …descending (newest first)
var pendingDelete  = null; // {rowIndex, display}
var histDefaultsSet = false; // Du/Au get their default (current caisse) only once, so user edits survive reloads

// The sheet is only appended to, so the newest records are at the bottom. Instead
// of downloading the whole sheet, we read it bottom-up in chunks of HIST_CHUNK rows,
// only as far back as the Du date needs.
var HIST_CHUNK  = 2000;
var histNextRow = 0;     // sheet rows 1 .. histNextRow-1 are not loaded yet (<= 1 means all loaded)
var histLoading = false; // a "previous day" load is in progress (ignore scroll/button meanwhile)
var histGen     = 0;     // bumped on each full reload; chunks from an older load are discarded

// ── Load ──────────────────────────────────────────────────────────────────────
function loadHistorique() {
  histShowState('<div class="spinner"></div><div style="margin-top:12px">Chargement...</div>');
  document.getElementById('hist-table-section').style.display = 'none';
  document.getElementById('hist-filter-bar').style.display    = 'none';
  histRows = [];
  histGen++;
  histLoading = false;
  document.getElementById('btn-hist-more').disabled = false;
  if (!histDefaultsSet) { setHistDefaultRange(); histDefaultsSet = true; }

  var fail = function () {
    histShowState('<div style="font-size:32px">❌</div><div>' + tr('histErrEmpty') + '</div>');
  };

  // The tab's grid row count tells us where the bottom is (without downloading data).
  var metaUrl = 'https://sheets.googleapis.com/v4/spreadsheets/' + DISP_SHEET_ID +
                '?fields=sheets.properties(title,gridProperties.rowCount)';
  var gen = histGen;
  ensureFreshToken(function () {
    authFetch(metaUrl)
      .then(function (res) { return res.json(); })
      .then(function (meta) {
        if (gen !== histGen) return; // superseded by a newer reload
        var sheet = ((meta && meta.sheets) || []).filter(function (s) { return s.properties.title === DISP_SHEET_TAB; })[0];
        if (!sheet) { fail(); return; }
        histNextRow = sheet.properties.gridProperties.rowCount + 1;
        ensureHistCoverage(histFromNum(), function (ok) {
          if (!ok) { fail(); return; }
          if (!histRows.length && histNextRow <= 1) {
            histShowState('<div style="font-size:32px">⚠️</div><div>' + tr('histErrEmpty') + '</div>');
            return;
          }
          document.getElementById('hist-filter-bar').style.display = 'flex';
          histShowTable();
          renderHistorique();
        });
      })
      .catch(fail);
  });
}

// The Du date as a serial, or -Infinity when empty (= show everything).
function histFromNum() {
  var v = document.getElementById('hist-date-from').value;
  return v ? isoToSerial(v) : -Infinity;
}

// Oldest day among the loaded rows (Infinity if none has a usable date).
function histOldestLoadedDay() {
  var min = Infinity;
  histRows.forEach(function (r) { var d = histDayNum(r); if (!isNaN(d) && d < min) min = d; });
  return min;
}

// Load chunks bottom-up until every row from dayNum onward is loaded, i.e. until
// a row from an earlier day shows up (or the top of the sheet is reached).
// Trailing blank grid rows just yield empty chunks, so this steps past them too.
function ensureHistCoverage(dayNum, cb) {
  if (histNextRow <= 1 || histOldestLoadedDay() < dayNum) { cb(true); return; }
  // "Everything" was asked for: read the rest in one request rather than many.
  var size = dayNum === -Infinity ? histNextRow - 1 : HIST_CHUNK;
  loadHistChunk(size, function (ok) { if (ok) ensureHistCoverage(dayNum, cb); else cb(false); });
}

// Read the `size` rows just above histNextRow and add them to histRows.
function loadHistChunk(size, cb) {
  var end   = histNextRow - 1;
  var start = Math.max(1, end - size + 1);
  var base  = 'https://sheets.googleapis.com/v4/spreadsheets/' + DISP_SHEET_ID +
              '/values/' + encodeURIComponent(DISP_SHEET_TAB + '!A' + start + ':L' + end);
  var urlFmt = base;                                          // formatted values → display (honours the sheet's date/time format)
  var urlNum = base + '?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER'; // raw values → date/time serials for sort/filter

  // Sheet schema (12 cols): A IsAddition, B Dossier, C Date de Caisse, D Date,
  // E Time, F Product, G Dose, H Format, I UnitPrice, J Qty, K LineTotal, L Forfait.
  var isHeader = function (r) {
    return (r[1] || '').toString().toLowerCase().indexOf('dossier') !== -1 ||
           (r[5] || '').toString().toLowerCase().indexOf('produit') !== -1 ||
           (r[5] || '').toString().toLowerCase().indexOf('product') !== -1;
  };
  var cell = function (r, i) { return (r && r[i] != null ? r[i] : '').toString().trim(); };
  var gen  = histGen;

  ensureFreshToken(function () {
    // Two reads of the same range: one formatted (for display), one unformatted
    // (numbers) so date/time can be sorted/filtered independently of how the
    // sheet displays them.
    Promise.all([
      authFetch(urlFmt).then(function (res) { return res.json(); }),
      authFetch(urlNum).then(function (res) { return res.json(); })
    ])
      .then(function (results) {
        if (gen !== histGen) return; // a full reload started meanwhile; drop this stale chunk
        if (results[0].error || results[1].error) throw results[0].error || results[1].error;
        var valuesF = results[0].values || [];  // formatted display strings
        var valuesN = results[1].values || [];  // raw values (numbers for real dates/times)
        for (var i = 0; i < valuesF.length; i++) {
          var r = valuesF[i];
          if (!r || r.length < 6 || isHeader(r)) continue;      // skip header / malformed rows
          var u = valuesN[i] || [];
          histRows.push({
            rowIndex:   start + i,                              // 1-based sheet row
            isAddition: cell(r, 0).toUpperCase() === 'TRUE',
            dossier:    cell(r, 1),
            dateCaisse: cell(r, 2),                             // Date de Caisse (dispensations only)
            date:       cell(r, 3),                             // display, honours the sheet's format
            time:       cell(r, 4),
            caisseNum:  (typeof u[2] === 'number') ? u[2] : NaN, // serial (format-independent)
            dateNum:    (typeof u[3] === 'number') ? u[3] : NaN,
            timeNum:    (typeof u[4] === 'number') ? u[4] : NaN,
            product:    cell(r, 5),
            dose:       cell(r, 6),
            format:     cell(r, 7),
            unitPrice:  cell(r, 8),
            qty:        cell(r, 9),
            lineTotal:  cell(r, 10),
            forfait:    cell(r, 11)
          });
        }
        histNextRow = start;
        cb(true);
      })
      .catch(function (err) {
        if (gen !== histGen) return;
        console.error('Historique chunk load failed:', err);
        cb(false);
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

// Inverse of isoToSerial: serial number -> yyyy-mm-dd.
function serialToIso(serial) {
  var d = new Date(Date.UTC(1899, 11, 30) + Math.floor(serial) * 86400000);
  return d.toISOString().slice(0, 10);
}

// The day a row counts toward for the Du/Au range: its Date de Caisse, or its
// Date for older rows written before the caisse column existed.
function histDayNum(r) {
  return !isNaN(r.caisseNum) ? Math.floor(r.caisseNum) : Math.floor(r.dateNum);
}

// Default range = the current Date de Caisse only (cashDateStr is in dispensation.js).
// autoHistCaisse remembers the value we set, to tell whether the user has edited Du/Au.
var autoHistCaisse = '';
function setHistDefaultRange() {
  autoHistCaisse = cashDateStr();
  document.getElementById('hist-date-from').value = autoHistCaisse;
  document.getElementById('hist-date-to').value   = autoHistCaisse;
}

// Same idea as tickDispensationClock: when the caisse rolls over at 16:00, move Du/Au
// forward — but only the ones still holding the value we set (untouched by the user).
// If the user loaded earlier days, Du differs, so only Au advances and the range grows.
function tickHistCaisse() {
  if (!histDefaultsSet) return;
  var c = cashDateStr();
  if (c === autoHistCaisse) return;
  var fromEl = document.getElementById('hist-date-from');
  var toEl   = document.getElementById('hist-date-to');
  var changed = false;
  if (fromEl.value === autoHistCaisse) { fromEl.value = c; changed = true; }
  if (toEl.value   === autoHistCaisse) { toEl.value   = c; changed = true; }
  autoHistCaisse = c;
  if (changed) renderHistorique();
}

// Row matches the search box: dossier, produit, dose or format (accent-insensitive).
function histMatchesSearch(r, q) {
  if (!q) return true;
  return [r.dossier, r.product, r.dose, r.format].some(function (v) { return normalize(v).includes(q); });
}

// "Load the previous day": extend Du back to the most recent earlier day that has
// matching records, so the user never pages through empty days. Reads more of the
// sheet as needed: first until such a day appears, then until that day is complete.
function loadPreviousHistDay() {
  var fromEl = document.getElementById('hist-date-from');
  var more   = document.getElementById('btn-hist-more');
  if (!fromEl.value || histLoading) return;
  var fromNum = isoToSerial(fromEl.value);
  histLoading = true; more.disabled = true;
  var done = function (ok) {
    histLoading = false; more.disabled = false;
    if (!ok) showToast(tr('histErrEmpty'), 'error');
    renderHistorique();
  };
  var step = function () {
    var prev = histPreviousDay(fromNum);
    if (prev === null) {
      if (histNextRow > 1) loadHistChunk(HIST_CHUNK, function (ok) { if (ok) step(); else done(false); });
      else done(true); // top of the sheet: nothing older
      return;
    }
    ensureHistCoverage(prev, function (ok) {
      if (ok) fromEl.value = serialToIso(prev);
      done(ok);
    });
  };
  step();
}

// Du moved (by hand): load back far enough to cover it, then re-render.
function onHistFromChange() {
  if (histLoading) return;
  histLoading = true;
  ensureHistCoverage(histFromNum(), function (ok) {
    histLoading = false;
    if (!ok) showToast(tr('histErrEmpty'), 'error');
    renderHistorique();
  });
}

// Latest day (serial) before fromNum that has rows matching the search, or null.
function histPreviousDay(fromNum) {
  var q = normalize(document.getElementById('hist-search-dossier').value).trim();
  var best = null;
  histRows.forEach(function (r) {
    var d = histDayNum(r);
    if (isNaN(d) || d >= fromNum || !histMatchesSearch(r, q)) return;
    if (best === null || d > best) best = d;
  });
  return best;
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
  setHistDefaultRange();
  renderHistorique();
}

// ── Render ────────────────────────────────────────────────────────────────────
function renderHistorique() {
  var q        = normalize(document.getElementById('hist-search-dossier').value).trim();
  var dateFrom = document.getElementById('hist-date-from').value;
  var dateTo   = document.getElementById('hist-date-to').value;
  var fromNum  = dateFrom ? isoToSerial(dateFrom) : null;
  var toNum    = dateTo   ? isoToSerial(dateTo)   : null;

  var rows = histRows.filter(function(r) {
    if (!histMatchesSearch(r, q)) return false;
    // Compare by serial number so it works whatever date format the sheet uses.
    var day = histDayNum(r);
    if (fromNum !== null && !isNaN(day) && day < fromNum) return false;
    if (toNum   !== null && !isNaN(day) && day > toNum)   return false;
    return true;
  });

  // Offer the previous day only when Du is set and older records may exist
  // (already loaded, or part of the sheet not read yet).
  var more = document.getElementById('btn-hist-more');
  if (more) more.style.display = (fromNum !== null && (histNextRow > 1 || histPreviousDay(fromNum) !== null)) ? 'inline-block' : 'none';

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
      '<td>'                    + fmt(r.dateCaisse)       + '</td>' +
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
  document.getElementById('hist-date-from').addEventListener('change', onHistFromChange);
  document.getElementById('hist-date-to').addEventListener('change',   renderHistorique);

  // Scrolling to the bottom of Historique loads the previous day (same as the button).
  window.addEventListener('scroll', function() {
    var more = document.getElementById('btn-hist-more');
    if (currentPage !== 'historique' || more.style.display === 'none' || histLoading) return;
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 50) loadPreviousHistDay();
  });

  // Close modal on backdrop click
  document.getElementById('delete-modal').addEventListener('click', function(e) {
    if (e.target === this) closeDeleteModal();
  });
});
