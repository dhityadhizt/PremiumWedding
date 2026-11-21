import { data } from "../assets/data/data.js";

const isConfiguredUrl = (url) => {
    return typeof url === 'string' && url.trim().startsWith('https://script.google.com/macros/s/') && !url.includes('GANTI_DENGAN_');
};

export const livePhotoService = {
    isConfigured: function () {
        return isConfiguredUrl(data.livePhotoApi);
    },

    getLivePhotos: async function () {
        if (!isConfiguredUrl(data.livePhotoApi)) {
            return { photos: [], notConfigured: true };
        }

        try {
            const separator = data.livePhotoApi.includes('?') ? '&' : '?';
            const response = await fetch(`${data.livePhotoApi}${separator}action=photos&t=${Date.now()}`, {
                method: 'GET',
                cache: 'no-store'
            });
            const result = await response.json();
            if (result && Array.isArray(result.photos)) {
                return { photos: result.photos, notConfigured: false };
            }
            if (result && Array.isArray(result.data)) {
                return { photos: result.data, notConfigured: false };
            }
            return { photos: [], notConfigured: false };
        } catch (error) {
            console.warn('Gagal memuat foto live dari Drive/Sheets:', error);
            return { photos: [], error: error.message, notConfigured: false };
        }
    },

    uploadLivePhoto: async function ({ id, guestName, facingMode, caption, date, imageBase64, mimeType }) {
        if (!isConfiguredUrl(data.livePhotoApi)) {
            throw new Error('URL livePhotoApi belum diatur di src/assets/data/data.js');
        }

        const payload = {
            action: 'uploadPhoto',
            id,
            guestName: guestName || 'Tamu Undangan',
            facingMode: facingMode || 'environment',
            caption: caption || '',
            date,
            mimeType: mimeType || 'image/png',
            imageBase64
        };

        await fetch(data.livePhotoApi, {
            method: 'POST',
            mode: 'no-cors',
            headers: {
                'Content-Type': 'text/plain;charset=utf-8'
            },
            body: JSON.stringify(payload)
        });

        // Tunggu sebentar agar Google Drive & Spreadsheet memproses baris baru
        await new Promise((resolve) => setTimeout(resolve, 1400));
        return { ok: true };
    }
};
