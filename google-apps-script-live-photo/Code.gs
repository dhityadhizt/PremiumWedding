const SHEET_COMENTAR = 'comentar';
const SHEET_PHOTOS = 'photos';
const DRIVE_FOLDER_ID = '10VPVOU3KRLyrHAyxUUFLO67C68ICidWm';

function jsonResponse(payload) {
  return ContentService
    .createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

function getOrCreatePhotoSheet(ss) {
  let sheet = ss.getSheetByName(SHEET_PHOTOS);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_PHOTOS);
    sheet.appendRow(['id', 'sender', 'caption', 'cameraMode', 'createdAt', 'fileId', 'imageUrl', 'driveUrl']);
  }
  return sheet;
}

function doGet(e) {
  try {
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    const action = (e && e.parameter && e.parameter.action) ? String(e.parameter.action) : 'comentar';

    if (action === 'photos') {
      const photoSheet = getOrCreatePhotoSheet(ss);
      const rows = photoSheet.getDataRange().getValues();
      const [, ...dataRows] = rows;

      const photos = dataRows
        .filter(r => r[6] || r[7])
        .map(([id, sender, caption, cameraMode, createdAt, fileId, imageUrl, driveUrl]) => ({
          id,
          sender,
          caption,
          cameraMode,
          createdAt,
          fileId,
          imageUrl: imageUrl || driveUrl,
          driveUrl: driveUrl || imageUrl
        }));

      return jsonResponse({
        status: 200,
        message: 'Berhasil mengambil foto galeri',
        photos
      });
    }

    const sheet = ss.getSheetByName(SHEET_COMENTAR);
    const [, ...data] = sheet.getDataRange().getValues();

    const comentar = data.map(([id, name, status, message, date, color]) => ({
      id,
      name,
      status,
      message,
      date,
      color
    }));

    return jsonResponse({
      status: 200,
      message: 'Berhasil mengambil data',
      comentar
    });
  } catch (error) {
    return jsonResponse({ status: 500, message: 'Kesalahan: ' + error });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();

    if (body.type === 'live_photo' || body.action === 'upload_photo') {
      const folder = DriveApp.getFolderById(DRIVE_FOLDER_ID);
      const mimeType = body.mimeType || 'image/jpeg';
      const fileName = body.fileName || ('live-photo-' + Date.now() + '.jpg');
      const bytes = Utilities.base64Decode(body.imageBase64);
      const blob = Utilities.newBlob(bytes, mimeType, fileName);

      const file = folder.createFile(blob);
      file.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW);

      const fileId = file.getId();
      const driveUrl = file.getUrl();
      const imageUrl = 'https://drive.google.com/thumbnail?id=' + fileId + '&sz=w1280';

      const photoSheet = getOrCreatePhotoSheet(ss);
      photoSheet.appendRow([
        body.id || ('photo-' + Date.now()),
        body.sender || 'Tamu Undangan',
        body.caption || '',
        body.cameraMode || 'live',
        body.createdAt || new Date().toISOString(),
        fileId,
        imageUrl,
        driveUrl
      ]);

      return jsonResponse({
        status: 200,
        message: 'Foto berhasil disimpan ke Google Drive & Spreadsheet',
        fileId,
        imageUrl,
        driveUrl
      });
    }

    const { id, name, status, message, date, color } = body;
    const sheet = ss.getSheetByName(SHEET_COMENTAR);
    if (!sheet) {
      throw new Error('Sheet "' + SHEET_COMENTAR + '" tidak ditemukan');
    }

    sheet.appendRow([id, name, status, message, date, color]);
    return jsonResponse({ status: 200, message: 'Data berhasil ditambahkan' });
  } catch (error) {
    return jsonResponse({ status: 500, message: 'Kesalahan: ' + error });
  }
}
