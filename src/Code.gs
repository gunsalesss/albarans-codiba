/**
 * Web app endpoint that receives parsed CODIBA albarà data (JSON) and
 * writes it into its own tab of the configured Google Sheet: one tab per
 * PDF (named after the source filename), with a shared header block, one
 * single uninterrupted line-item list (tagged with which document/version
 * each line came from), and a compact per-document summary table at the
 * end (totals, signat, observacions) — nothing splits the item list.
 *
 * Setup (run once from the Apps Script editor): call setup_() with your
 * Sheet ID, see README.md.
 */

var LINIA_HEADERS = [
  'Pàgines', 'Codi', 'Unitat', 'Denominació', 'Quantitat', 'Preu', 'Dte',
  'IBEE', 'Punt Verd', 'Import Net', 'IVA%'
];

var RESUM_HEADERS = [
  'Pàgines', 'Signat', 'Total Bultos', 'Totals IVA', 'Total a Pagar', 'Observacions'
];

function setup_(sheetId) {
  var props = PropertiesService.getScriptProperties();
  props.setProperty('SHEET_ID', sheetId);
}

function doPost(e) {
  var props = PropertiesService.getScriptProperties();
  try {
    var body = JSON.parse(e.postData.contents);

    var sheetId = body.sheet_id || props.getProperty('SHEET_ID');
    if (!sheetId) {
      return jsonOutput_({ error: 'Falta \'sheet_id\' al payload (o executa setup_() des de l\'editor).' });
    }
    if (body.sheet_id && body.sheet_id !== props.getProperty('SHEET_ID')) {
      props.setProperty('SHEET_ID', body.sheet_id);
    }

    var ss = SpreadsheetApp.openById(sheetId);
    var documents = body.documents || [body];
    var pdfOrigen = body.pdf_origen || 'Albarà';

    var sheet = createUniqueSheet_(ss, sanitizeSheetName_(pdfOrigen));
    var rows = [];
    var liniesEscrites = 0;

    if (documents.length) {
      appendSharedHeaderRows_(rows, documents[0]);
    }

    rows.push(LINIA_HEADERS);
    documents.forEach(function (doc) {
      (doc.linies || []).forEach(function (li) {
        rows.push([
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
        liniesEscrites++;
      });
    });

    rows.push(['']);
    rows.push(RESUM_HEADERS);
    documents.forEach(function (doc) {
      rows.push([
        doc.pagines || '',
        doc.signat ? 'Sí' : 'No',
        doc.total_bultos != null ? doc.total_bultos : '',
        formatTotalsIva_(doc.totals),
        doc.total_a_pagar != null ? doc.total_a_pagar : '',
        doc.observacions || ''
      ]);
    });

    var padded = padRowsTo_(rows, 2);
    var width = padded.length ? padded[0].length : 2;
    sheet.getRange(1, 1, padded.length, width).setValues(padded);

    return jsonOutput_({
      ok: true,
      pestanya: sheet.getName(),
      documents_escrits: documents.length,
      linies_escrites: liniesEscrites
    });
  } catch (err) {
    return jsonOutput_({ error: err.message });
  }
}

function appendSharedHeaderRows_(rows, doc) {
  var client = doc.client || {};

  var camps = [
    ['Albarà', doc.albara || ''],
    ['Data', doc.data || ''],
    ['Càrrega', doc.carrega || ''],
    ['Xofer', doc.xofer || ''],
    ['F.Pag.', doc.fpag || ''],
    ['Comercial', doc.comercial || ''],
    ['Client', client.titular || client.n_com || ''],
    ['Codi Client', client.codi || ''],
    ['NIF', client.nif || ''],
    ['Adreça', client.adreca || ''],
    ['Població', client.poblacio || ''],
    ['Telèfon', client.telefon || '']
  ];

  camps.forEach(function (c) { rows.push(c); });
  rows.push(['']);
}

function formatTotalsIva_(totals) {
  return (totals || []).map(function (t) {
    var base = t.base_imposable != null ? t.base_imposable : '?';
    var quota = t.quota_iva != null ? t.quota_iva : '?';
    return t.iva + '%: base ' + base + ' / quota ' + quota;
  }).join('; ');
}

function padRowsTo_(rows, minCols) {
  var width = minCols;
  rows.forEach(function (r) { if (r.length > width) width = r.length; });
  return rows.map(function (r) {
    var padded = r.slice();
    while (padded.length < width) padded.push('');
    return padded;
  });
}

function createUniqueSheet_(ss, baseName) {
  var name = baseName;
  var i = 2;
  while (ss.getSheetByName(name)) {
    name = (baseName + ' (' + i + ')').slice(0, 100);
    i++;
  }
  return ss.insertSheet(name);
}

function sanitizeSheetName_(pdfOrigen) {
  var name = String(pdfOrigen).replace(/\.pdf$/i, '');
  name = name.replace(/[:\\\/\?\*\[\]]/g, '-').trim();
  if (!name) name = 'Albarà';
  return name.slice(0, 100);
}

function jsonOutput_(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
