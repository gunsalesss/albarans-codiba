/**
 * Web app endpoint that receives parsed CODIBA albarà data (JSON) and
 * appends it to the configured Google Sheet: one row per document in
 * "Albarans", one row per product line in "Linies".
 *
 * Setup (run once from the Apps Script editor): call setup_() with your
 * Sheet ID and a secret token, see README.md.
 */

var ALBARANS_HEADERS = [
  'Data Importació', 'PDF Origen', 'Pàgines', 'Signat',
  'Data', 'Albarà', 'Càrrega', 'Xofer', 'F.Pag.', 'Comercial',
  'Client', 'Codi Client', 'NIF', 'Adreça', 'Població', 'Telèfon',
  'Observacions', 'Total Bultos', 'Totals IVA (JSON)', 'Total a Pagar'
];

var LINIES_HEADERS = [
  'Albarà', 'Pàgines', 'Codi', 'Unitat', 'Denominació', 'Quantitat',
  'Preu', 'Dte', 'IBEE', 'Punt Verd', 'Import Net', 'IVA%'
];

function setup_(sheetId, secret) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', sheetId);
  props.setProperty('SHARED_SECRET', secret);
}

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  try {
    var body = JSON.parse(e.postData.contents);

    var expectedSecret = props.getProperty('SHARED_SECRET');
    if (expectedSecret && body.secret !== expectedSecret) {
      return jsonOutput_({ error: 'Unauthorized' });
    }

    var sheetId = props.getProperty('SHEET_ID');
    if (!sheetId) {
      return jsonOutput_({ error: 'SHEET_ID no configurat. Executa setup_() des de l\'editor.' });
    }

    var ss = SpreadsheetApp.openById(sheetId);
    var albaransSheet = getOrCreateSheet_(ss, 'Albarans', ALBARANS_HEADERS);
    var liniesSheet = getOrCreateSheet_(ss, 'Linies', LINIES_HEADERS);

    var documents = body.documents || [body];
    var pdfOrigen = body.pdf_origen || '';
    var now = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd HH:mm:ss');

    var albaransRows = [];
    var liniesRows = [];

    documents.forEach(function (doc) {
      var client = doc.client || {};

      albaransRows.push([
        now,
        pdfOrigen,
        doc.pagines || '',
        doc.signat ? 'Sí' : '',
        doc.data || '',
        doc.albara || '',
        doc.carrega || '',
        doc.xofer || '',
        doc.fpag || '',
        doc.comercial || '',
        client.titular || client.n_com || '',
        client.codi || '',
        client.nif || '',
        client.adreca || '',
        client.poblacio || '',
        client.telefon || '',
        doc.observacions || '',
        doc.total_bultos != null ? doc.total_bultos : '',
        JSON.stringify(doc.totals || []),
        doc.total_a_pagar != null ? doc.total_a_pagar : ''
      ]);

      (doc.linies || []).forEach(function (li) {
        liniesRows.push([
          doc.albara || '',
          doc.pagines || '',
          li.codi || '',
          li.unit != null ? li.unit : '',
          li.denominacio || '',
          li.quant != null ? li.quant : '',
          li.preu != null ? li.preu : '',
          li.dte != null ? li.dte : '',
          li.ibee != null ? li.ibee : '',
          li.punt_verd != null ? li.punt_verd : '',
          li.import_net != null ? li.import_net : '',
          li.iva != null ? li.iva : ''
        ]);
      });
    });

    appendRows_(albaransSheet, albaransRows);
    appendRows_(liniesSheet, liniesRows);

    return jsonOutput_({
      ok: true,
      albarans_escrits: albaransRows.length,
      linies_escrites: liniesRows.length
    });
  } catch (err) {
    return jsonOutput_({ error: err.message });
  }
}

function getOrCreateSheet_(ss, name, headers) {
  var sheet = ss.getSheetByName(name);
  if (!sheet) {
    sheet = ss.insertSheet(name);
  }
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(headers);
  }
  return sheet;
}

function appendRows_(sheet, rows) {
  if (!rows.length) return;
  sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, rows[0].length).setValues(rows);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
