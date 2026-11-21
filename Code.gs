// ============================================================================
// GOOGLE APPS SCRIPT - WEDDING INVITATION (RSVP + LIVE PHOTO SHARING PNG)
// ============================================================================

const FOLDER_ID = '10VPVOU3KRLyrHAyxUUFLO67C68ICidWm';
const SHEET_RSVP = 'Ucapan';
const SHEET_GALERI = 'LiveGaleri';

function doGet(e) {
  const action = (e && e.parameter && e.parameter.action) ? e.parameter.action : 'rsvp';

  if (action === 'gallery') {
    return getGalleryPhotos();
  }
  return getRsvpComments();
}

function doPost(e) {
  try {
    const rawData = (e && e.postData && e.postData.contents) ? e.postData.contents : '{}';
    const payload = JSON.parse(rawData);

    if (payload.action === 'uploadPhoto') {
      return uploadLivePhoto(payload);
    } else {
      return saveRsvpComment(payload);
    }
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'error',
      message: err.toString()
    })).setMimeType(ContentService.MimeType.JSON);
  }
}

function getTargetSpreadsheet() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  // Fallback jika skrip dijalankan/diakses tanpa active spreadsheet terikat
  const props = PropertiesService.getScriptProperties();
  let ssId = props.getProperty('LINKED_SPREADSHEET_ID');
  if (ssId) {
    return SpreadsheetApp.openById(ssId);
  }

  const folder = DriveApp.getFolderById(FOLDER_ID);
  const files = folder.getFilesByMimeType(MimeType.GOOGLE_SHEETS);
  if (files.hasNext()) {
    const file = files.next();
    props.setProperty('LINKED_SPREADSHEET_ID', file.getId());
    return SpreadsheetApp.openById(file.getId());
  }

  const newSs = SpreadsheetApp.create('Wedding Live Gallery & RSVP Log');
  const newFile = DriveApp.getFileById(newSs.getId());
  newFile.moveTo(folder);
  props.setProperty('LINKED_SPREADSHEET_ID', newSs.getId());
  return newSs;
}

function uploadLivePhoto(payload) {
  const folder = DriveApp.getFolderById(FOLDER_ID);

  const rawImage = String(payload.image || '');
  const base64Data = rawImage.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').replace(/\s+/g, '');
  if (!base64Data) {
    throw new Error('Data gambar kosong atau tidak valid');
  }

  const decodedBytes = Utilities.base64Decode(base64Data);

  const guestName = String(payload.guestName || 'Tamu').replace(/[^a-zA-Z0-9_\- ]/g, '').trim() || 'Tamu';
  const timestamp = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'yyyyMMdd_HHmmss');
  const fileName = 'Wedding_' + guestName.replace(/\s+/g, '_') + '_' + timestamp + '.png';

  const blob = Utilities.newBlob(decodedBytes, 'image/png', fileName);
  const file = folder.createFile(blob);
  file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

  const fileId = file.getId();
  // Menggunakan format thumbnail/uc yang lebih konsisten untuk gambar Drive publik
  const imageUrl = 'https://lh3.googleusercontent.com/d/' + fileId;
  const driveUrl = file.getUrl();

  const ss = getTargetSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_GALERI);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_GALERI);
    sheet.appendRow(['ID', 'Waktu', 'Nama Tamu', 'Nama File', 'Image URL', 'Drive Link']);
  }

  const photoId = new Date().getTime();
  const formattedDate = Utilities.formatDate(new Date(), 'Asia/Jakarta', 'dd/MM/yyyy HH:mm:ss');
  sheet.appendRow([photoId, formattedDate, guestName, fileName, imageUrl, driveUrl]);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    photo: {
      id: photoId,
      guestName: guestName,
      image: imageUrl,
      driveUrl: driveUrl,
      date: formattedDate
    }
  })).setMimeType(ContentService.MimeType.JSON);
}

function getGalleryPhotos() {
  const ss = getTargetSpreadsheet();
  const sheet = ss.getSheetByName(SHEET_GALERI);

  if (!sheet) {
    return ContentService.createTextOutput(JSON.stringify({
      status: 'success',
      photos: []
    })).setMimeType(ContentService.MimeType.JSON);
  }

  const rows = sheet.getDataRange().getValues();
  const photos = [];

  for (let i = rows.length - 1; i >= 1; i--) {
    if (rows[i][4]) {
      photos.push({
        id: rows[i][0],
        date: rows[i][1],
        guestName: rows[i][2],
        fileName: rows[i][3],
        image: rows[i][4],
        driveUrl: rows[i][5]
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success',
    photos: photos
  })).setMimeType(ContentService.MimeType.JSON);
}

function saveRsvpComment(payload) {
  const ss = getTargetSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_RSVP);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_RSVP);
    sheet.appendRow(['id', 'name', 'status', 'message', 'date', 'color']);
  }

  sheet.appendRow([
    payload.id || new Date().getTime(),
    payload.name || '',
    payload.status || '',
    payload.message || '',
    payload.date || '',
    payload.color || '#000000'
  ]);

  return ContentService.createTextOutput(JSON.stringify({
    status: 'success'
  })).setMimeType(ContentService.MimeType.JSON);
}

function getRsvpComments() {
  const ss = getTargetSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_RSVP);
  if (!sheet) {
    sheet = ss.getSheets()[0];
  }

  const rows = sheet.getDataRange().getValues();
  const comentar = [];

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][1]) {
      comentar.push({
        id: rows[i][0],
        name: rows[i][1],
        status: rows[i][2],
        message: rows[i][3],
        date: rows[i][4],
        color: rows[i][5]
      });
    }
  }

  return ContentService.createTextOutput(JSON.stringify({
    comentar: comentar
  })).setMimeType(ContentService.MimeType.JSON);
}
