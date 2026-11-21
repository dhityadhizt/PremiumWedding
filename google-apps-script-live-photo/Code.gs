// =========================================================================
// GOOGLE APPS SCRIPT - LIVE PHOTO SHARING (SPREADSHEET + GOOGLE DRIVE)
// Folder Drive Tujuan: https://drive.google.com/drive/folders/10VPVOU3KRLyrHAyxUUFLO67C68ICidWm
// =========================================================================

const DRIVE_FOLDER_ID = '10VPVOU3KRLyrHAyxUUFLO67C68ICidWm';
const SHEET_NAME = 'live_photos';

function getOrCreateSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(['id', 'guestName', 'facingMode', 'caption', 'date', 'fileId', 'fileName', 'imageUrl']);
  }
  return sheet;
}

function doGet(e) {
  try {
    const action = (e && e.parameter && e.parameter.action) || 'photos';
    if (action === 'photos') {
      const sheet = getOrCreateSheet_();
      const lastRow = sheet.getLastRow();
      if (lastRow <= 1) {
        return ContentService
          .createTextOutput(JSON.stringify({ status: 200, photos: [] }))
          .setMimeType(ContentService.MimeType.JSON);
      }

      const rows = sheet.getRange(2, 1, lastRow - 1, 8).getValues();
      const photos = rows
        .filter(r => r[0] || r[7])
        .map(r => ({
          id: String(r[0] || ''),
          guestName: String(r[1] || 'Tamu Undangan'),
          facingMode: String(r[2] || 'environment'),
          caption: String(r[3] || ''),
          date: String(r[4] || ''),
          fileId: String(r[5] || ''),
          fileName: String(r[6] || ''),
          imageUrl: String(r[7] || '')
        }))
        .reverse();

      return ContentService
        .createTextOutput(JSON.stringify({ status: 200, photos: photos }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    return ContentService
      .createTextOutput(JSON.stringify({ status: 200, message: 'Live Photo API Ready' }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 500, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

function doPost(e) {
  try {
    const body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const id = body.id || ('live_' + new Date().getTime());
    const guestName = String(body.guestName || 'Tamu Undangan').trim();
    const facingMode = String(body.facingMode || 'environment').trim();
    const caption = String(body.caption || '').trim();
    const date = String(body.date || new Date().toISOString()).trim();
    const mimeType = 'image/png';
    const base64Data = String(body.imageBase64 || '').replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    if (!base64Data) {
      throw new Error('imageBase64 kosong');
    }

    const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
    const safeGuest = guestName.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 25) || 'Tamu';
    const fileName = `LivePhoto_${safeGuest}_${id}.png`;

    const decodedBytes = Utilities.base64Decode(base64Data);
    const blob = Utilities.newBlob(decodedBytes, mimeType, fileName);
    const file = folder.createFile(blob);

    // Izinkan akses lihat agar gambar dapat tampil di galeri undangan GitHub Pages
    file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

    const fileId = file.getId();
    const imageUrl = `https://lh3.googleusercontent.com/d/${fileId}=w1000`;

    const sheet = getOrCreateSheet_();
    sheet.appendRow([id, guestName, facingMode, caption, date, fileId, fileName, imageUrl]);

    return ContentService
      .createTextOutput(JSON.stringify({
        status: 200,
        id: id,
        fileId: fileId,
        fileName: fileName,
        imageUrl: imageUrl
      }))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ status: 500, error: String(err) }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}
