// ── Shared state ──────────────────────────────────────────────────────────────
var lang        = 'fr';
var currentPage = 'inventory';

// ── Translation helper ────────────────────────────────────────────────────────
function tr(k) { return T[lang][k] || k; }

// ── Language ──────────────────────────────────────────────────────────────────
function setLang(l) {
  lang = l;

  // Toggle active button
  document.querySelectorAll('.lang-btn').forEach(function(b, i) {
    b.classList.toggle('active', (l === 'fr' && i === 0) || (l === 'en' && i === 1));
  });

  // Top bar
  document.getElementById('app-title').textContent = tr('appTitle');
  document.getElementById('app-sub').textContent   = tr('appSub');

  // Tabs
  document.getElementById('tab-inv').textContent  = tr('tabInv');
  document.getElementById('tab-disp').textContent = tr('tabDisp');
  document.getElementById('tab-hist').textContent = tr('tabHist');

  // Inventory stats
  document.getElementById('sl-total').textContent    = tr('slTotal');
  document.getElementById('sl-low').textContent      = tr('slLow');
  document.getElementById('sl-critical').textContent = tr('slCritical');

  // Filters
  document.getElementById('f-all').textContent     = tr('fAll');
  document.getElementById('f-ok').textContent      = tr('fOk');
  document.getElementById('f-low').textContent     = tr('fLow');
  document.getElementById('f-critical').textContent = tr('fCritical');
  document.getElementById('f-fam-all').textContent = tr('fFamAll');
  document.getElementById('f-cat-all').textContent = tr('fCatAll');

  // Inventory buttons & inputs
  document.getElementById('charger-inv').textContent       = tr('updInv');
  document.getElementById('search-input').placeholder      = tr('searchPlaceholder');

  // Table headers
  var cols = ['Code','Product','Dose','Format','DateExp','StockInit','Pa','PrixUnit',
              'Sorties','Change','StockActuel','Obs','ConsEstMo','MoRest','QuantMin',
              'Valeur','EtatsUnis','Essentiel','Famille'];
  cols.forEach(function(c) {
    var el = document.getElementById('h-' + c.charAt(0).toLowerCase() + c.slice(1));
    if (el) el.textContent = tr('h' + c) + ' ↕';
  });

  // Dispensation page
  document.getElementById('disp-title').textContent           = tr('dispTitle');
  document.getElementById('disp-section-patient').textContent = tr('dispSectionPatient');
  document.getElementById('disp-section-meds').textContent    = tr('dispSectionMeds');
  document.getElementById('disp-section-total').textContent   = tr('dispSectionTotal');
  document.getElementById('lbl-dossier').textContent          = tr('lblDossier');
  document.getElementById('lbl-date').textContent             = tr('lblDate');
  document.getElementById('lbl-time').textContent             = tr('lblTime');
  document.getElementById('btn-add-med').textContent          = tr('btnAddMed');
  document.getElementById('btn-submit').textContent           = tr('btnSubmit');
  document.getElementById('disp-no-inv-msg').textContent      = tr('noInvMsg');

  document.getElementById('btn-load-hist').textContent       = tr('btnLoadHist');
  document.getElementById('hist-state-msg').textContent      = tr('histStatePrompt');
  document.getElementById('lbl-hist-from').textContent       = tr('lblHistFrom');
  document.getElementById('lbl-hist-to').textContent         = tr('lblHistTo');
  document.getElementById('btn-hist-clear').textContent      = tr('btnHistClear');
  document.getElementById('hist-search-dossier').placeholder = tr('histSearchPlaceholder');
  var histCols = ['Dossier','Date','Time','Product','Dose','Format','UnitPrice','Qty','Total','Forfait'];
  histCols.forEach(function(c) {
    var el = document.getElementById('hh-' + c.toLowerCase());
    if (el) el.childNodes[0].textContent = tr('hh' + c) + ' ';
  });
  document.querySelectorAll('.med-lbl-med').forEach(function(el)    { el.textContent = tr('lblMed'); });
  document.querySelectorAll('.med-lbl-qty').forEach(function(el)    { el.textContent = tr('lblQty'); });
  document.querySelectorAll('.med-lbl-forfait').forEach(function(el){ el.textContent = tr('lblForfait'); });
  document.querySelectorAll('.med-select option[value=""]').forEach(function(el) { el.textContent = tr('selectMed'); });

  // State message / table
  if (products.length) {
    renderTable();
  } else {
    var sm = document.getElementById('state-msg');
    if (sm) sm.textContent = tr('statePrompt');
  }
}

// ── Page navigation ───────────────────────────────────────────────────────────
function showPage(page) {

  currentPage = page;
  document.getElementById('page-inventory').style.display    = page === 'inventory'    ? 'block' : 'none';
  document.getElementById('page-dispensation').style.display = page === 'dispensation' ? 'block' : 'none';
  document.getElementById('page-historique').style.display   = page === 'historique'   ? 'block' : 'none';
  document.getElementById('page-forfait').style.display   = page === 'forfait'   ? 'block' : 'none';

  document.getElementById('tab-inv').classList.toggle('active',  page === 'inventory');
  document.getElementById('tab-disp').classList.toggle('active', page === 'dispensation');
  document.getElementById('tab-hist').classList.toggle('active', page === 'historique');
  document.getElementById('tab-hist').classList.toggle('active', page === 'forfait');

  if (page === 'dispensation') {
    document.getElementById('disp-no-inv').style.display = products.length ? 'none' : 'block';
    if (document.getElementById('med-rows').children.length === 0 && namedRows!=[]) addMedRow();
  }

}

// ── Event listeners ───────────────────────────────────────────────────────────
document.getElementById('search-input').addEventListener('input',   renderTable);
document.getElementById('stock-filter').addEventListener('change',  renderTable);
document.getElementById('category-filter').addEventListener('change', renderTable);
document.getElementById('family-filter').addEventListener('change', renderTable);

document.querySelectorAll('thead th[data-col]').forEach(function(th) {
  th.addEventListener('click', function() {
    var col = th.dataset.col;
    if (sortCol === col) sortDir *= -1;
    else { sortCol = col; sortDir = 1; }
    renderTable();
  });
});

// ── Init ──────────────────────────────────────────────────────────────────────
document.getElementById('date-label').textContent =
  new Date().toLocaleDateString('fr-FR', { day:'2-digit', month:'long', year:'numeric' });
setDefaultDateTime();
setLang('fr');