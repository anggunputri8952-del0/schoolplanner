/**
 * SchoolPlanner - Google Apps Script Backend
 * 
 * CARA DEPLOY:
 * 1. Buka script.google.com → New Project
 * 2. Paste seluruh kode ini
 * 3. Ganti SPREADSHEET_ID di bawah dengan ID spreadsheet kamu
 * 4. Klik Deploy → New Deployment → Web App
 * 5. Execute as: Me | Who has access: Anyone
 * 6. Copy URL deployment → paste ke SchoolPlanner
 */

// ============================================================
// KONFIGURASI - Ganti dengan Spreadsheet ID kamu
// ID ada di URL: docs.google.com/spreadsheets/d/[ID_DI_SINI]/edit
// ============================================================
const SPREADSHEET_ID = '1GHVnsmettvEKWmKoV5zF_QpkPVje0rLmCbyZAFEVtj8';
const SHEET_TUGAS    = 'Tugas';   // nama tab untuk tugas/PR
const SHEET_JADWAL   = 'Jadwal';  // nama tab untuk jadwal

// ============================================================
// CORS HEADERS
// ============================================================
function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json'
  };
}

function makeResponse(data) {
  return ContentService
    .createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

// ============================================================
// GET HANDLER - Baca data dari spreadsheet
// ============================================================
function doGet(e) {
  try {
    const action = e.parameter.action || 'getTugas';
    
    if (action === 'ping') {
      return makeResponse({ ok: true, message: 'SchoolPlanner API aktif ✅' });
    }
    
    if (action === 'getTugas') {
      return makeResponse({ ok: true, data: getTugasData() });
    }
    
    if (action === 'getJadwal') {
      return makeResponse({ ok: true, data: getJadwalData() });
    }
    
    if (action === 'getAll') {
      return makeResponse({
        ok: true,
        tugas: getTugasData(),
        jadwal: getJadwalData()
      });
    }
    
    return makeResponse({ ok: false, error: 'Action tidak dikenal: ' + action });
    
  } catch(err) {
    return makeResponse({ ok: false, error: err.toString() });
  }
}

// ============================================================
// POST HANDLER - Tulis data ke spreadsheet
// ============================================================
function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const action = body.action;
    
    if (action === 'addTugas') {
      addTugasRow(body.data);
      return makeResponse({ ok: true, message: 'Tugas berhasil ditambahkan' });
    }
    
    if (action === 'updateStatus') {
      updateTugasStatus(body.id, body.status);
      return makeResponse({ ok: true, message: 'Status diperbarui' });
    }
    
    if (action === 'deleteTugas') {
      deleteTugasRow(body.id);
      return makeResponse({ ok: true, message: 'Tugas dihapus' });
    }
    
    if (action === 'syncTugas') {
      // Kirim semua tugas dari app → tulis ke sheet (overwrite)
      syncAllTugas(body.data);
      return makeResponse({ ok: true, message: 'Sync berhasil' });
    }
    
    return makeResponse({ ok: false, error: 'Action tidak dikenal: ' + action });
    
  } catch(err) {
    return makeResponse({ ok: false, error: err.toString() });
  }
}

// ============================================================
// HELPER: Pastikan sheet ada, buat jika belum
// ============================================================
function getOrCreateSheet(name, headers) {
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(name);
  
  if (!sheet) {
    sheet = ss.insertSheet(name);
    // Tulis header
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length)
      .setBackground('#4a4a6a')
      .setFontColor('#ffffff')
      .setFontWeight('bold');
    sheet.setFrozenRows(1);
  }
  return sheet;
}

// ============================================================
// TUGAS OPERATIONS
// ============================================================
const TUGAS_HEADERS = ['ID', 'Judul', 'Mata Pelajaran', 'Guru', 'Deadline', 'Tipe', 'Catatan', 'Status', 'Dibuat'];

function getTugasData() {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];
  
  const rows = sheet.getRange(2, 1, lastRow - 1, TUGAS_HEADERS.length).getValues();
  return rows
    .filter(r => r[0]) // filter baris kosong
    .map(r => ({
      id:       r[0].toString(),
      judul:    r[1].toString(),
      mapelNama: r[2].toString(),
      guru:     r[3].toString(),
      deadline: r[4] ? Utilities.formatDate(new Date(r[4]), 'Asia/Jakarta', 'yyyy-MM-dd') : '',
      tipe:     r[5].toString() || 'pr',
      catatan:  r[6].toString(),
      selesai:  r[7].toString().toLowerCase() === 'selesai',
      createdAt: r[8] ? new Date(r[8]).getTime() : Date.now()
    }));
}

function addTugasRow(data) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  sheet.appendRow([
    data.id,
    data.judul,
    data.mapelNama || '',
    data.guru || '',
    data.deadline || '',
    data.tipe || 'pr',
    data.catatan || '',
    data.selesai ? 'Selesai' : 'Belum',
    new Date()
  ]);
}

function updateTugasStatus(id, status) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = 0; i < ids.length; i++) {
    if (ids[i][0].toString() === id.toString()) {
      sheet.getRange(i + 2, 8).setValue(status ? 'Selesai' : 'Belum');
      return;
    }
  }
}

function deleteTugasRow(id) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return;
  
  const ids = sheet.getRange(2, 1, lastRow - 1, 1).getValues();
  for (let i = ids.length - 1; i >= 0; i--) {
    if (ids[i][0].toString() === id.toString()) {
      sheet.deleteRow(i + 2);
      return;
    }
  }
}

function syncAllTugas(tugasList) {
  const sheet = getOrCreateSheet(SHEET_TUGAS, TUGAS_HEADERS);
  
  // Hapus semua data (kecuali header)
  const lastRow = sheet.getLastRow();
  if (lastRow > 1) {
    sheet.deleteRows(2, lastRow - 1);
  }
  
  // Tulis ulang semua
  if (tugasList && tugasList.length > 0) {
    const rows = tugasList.map(t => [
      t.id,
      t.judul,
      t.mapelNama || '',
      t.guru || '',
      t.deadline || '',
      t.tipe || 'pr',
      t.catatan || '',
      t.selesai ? 'Selesai' : 'Belum',
      t.createdAt ? new Date(t.createdAt) : new Date()
    ]);
    sheet.getRange(2, 1, rows.length, TUGAS_HEADERS.length).setValues(rows);
  }
}

// ============================================================
// JADWAL OPERATIONS
// ============================================================
const JADWAL_HEADERS = ['ID', 'Hari', 'Mata Pelajaran', 'Jam Mulai', 'Jam Selesai', 'Guru', 'Ruangan'];

function getJadwalData() {
  const sheet = getOrCreateSheet(SHEET_JADWAL, JADWAL_HEADERS);
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return {};
  
  const rows = sheet.getRange(2, 1, lastRow - 1, JADWAL_HEADERS.length).getValues();
  const result = {};
  
  rows.filter(r => r[0]).forEach(r => {
    const hari = r[1].toString().toLowerCase();
    if (!result[hari]) result[hari] = [];
    result[hari].push({
      id:       r[0].toString(),
      hari:     hari,
      mapelNama: r[2].toString(),
      jamMulai: r[3].toString(),
      jamSelesai: r[4].toString(),
      guru:     r[5].toString(),
      ruangan:  r[6].toString()
    });
  });
  
  return result;
}
