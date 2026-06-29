/**
 * Google Apps Script backing the web app at APPS_SCRIPT_URL
 * (used by dispensation.js and addstock.js, read back by historique.js).
 *
 * NOTE: This file is a REFERENCE / BACKUP copy. The live code runs in the
 * Google Apps Script editor, NOT from this repo — editing this file does not
 * deploy anything. After changing the script, redeploy the web app in Apps
 * Script for changes to take effect.
 *
 * DEPLOYMENT SETTINGS (required for the browser fetch to work):
 *   Execute as:      Me
 *   Who has access:  Anyone        <-- NOT "Anyone with Google Account"
 * With these settings, Session.getActiveUser().getEmail() is BLANK, so a
 * server-side email allow-list cannot work here. Access is enforced client-side
 * by Google sign-in + ALLOWED_EMAILS in auth.js. (If you want real server-side
 * protection that works with anonymous access, use a shared token — see the
 * commented block at the bottom.)
 *
 * Bound spreadsheet: 1qqMMRvP61bcWs930iZEf1Qxumb1Cgi_WcsviLW1SkcY, tab "Dispensation".
 * Row schema (11 cols): A IsAddition, B Dossier, C Date, D Time, E Product,
 * F Dose, G Format, H UnitPrice, I Qty, J LineTotal, K Forfait.
 */

var SHEET_ID    = '1qqMMRvP61bcWs930iZEf1Qxumb1Cgi_WcsviLW1SkcY';
var SHEET_NAME  = 'Dispensation';

function jsonOut(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj))
                       .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var data  = JSON.parse(e.postData.contents);
    var sheet = SpreadsheetApp.openById(SHEET_ID).getSheetByName(SHEET_NAME);

    if (data.action === 'append') {
      data.rows.forEach(function (row) { sheet.appendRow(row); });
      return jsonOut({ status: 'ok' });
    }

    if (data.action === 'delete') {
      // Delete in reverse order so row indices don't shift.
      var indices = data.rowIndices.slice().sort(function (a, b) { return b - a; });
      indices.forEach(function (i) { sheet.deleteRow(i); });
      return jsonOut({ status: 'ok' });
    }

    return jsonOut({ status: 'error', message: 'Unknown action' });
  } catch (err) {
    return jsonOut({ status: 'error', message: String(err) });
  }
}

function doGet(e) {
  // Quick health check: open the /exec URL in a browser; you should see
  // {"status":"ok"}. A Google login page instead means access != "Anyone".
  return jsonOut({ status: 'ok' });
}

/*
// ── Optional: shared-token protection (works with anonymous access) ──
// 1. Put the same string in a client config var and send it in every POST body
//    as data.token.  2. Uncomment and check it at the top of doPost:
//
// var SHARED_TOKEN = 'choose-a-long-random-string';
// if (data.token !== SHARED_TOKEN) return jsonOut({ status:'error', message:'Unauthorized' });
//
// The token lives in the client JS (visible to signed-in users), so it's a
// modest deterrent, not strong security — but far better than the email gate,
// which simply cannot work under anonymous execution.
*/
