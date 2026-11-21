import { data } from "../assets/data/data.js";

export const galleryService = {
    getPhotos: async function () {
        try {
            const url = `${data.api}?action=gallery&t=${Date.now()}`;
            const response = await fetch(url, { redirect: 'follow' });
            const result = await response.json();
            if (result && result.status === 'success' && Array.isArray(result.photos)) {
                return result.photos;
            }
            return [];
        } catch (error) {
            console.warn('Gagal memuat foto dari Google Drive:', error);
            return [];
        }
    },

    uploadPhoto: async function ({ guestName, imageBase64 }) {
        const payload = {
            action: 'uploadPhoto',
            guestName: guestName || 'Tamu Undangan',
            image: imageBase64
        };

        try {
            const response = await fetch(data.api, {
                method: 'POST',
                redirect: 'follow',
                headers: {
                    'Content-Type': 'text/plain;charset=utf-8'
                },
                body: JSON.stringify(payload)
            });

            const text = await response.text();
            return JSON.parse(text);
        } catch (error) {
            // Jika redirect Apps Script terblokir CORS di beberapa browser/perangkat,
            // kirim ulang dengan mode no-cors agar request POST tetap sampai ke Apps Script
            try {
                await fetch(data.api, {
                    method: 'POST',
                    mode: 'no-cors',
                    headers: {
                        'Content-Type': 'text/plain;charset=utf-8'
                    },
                    body: JSON.stringify(payload)
                });
                return { status: 'sent_no_cors' };
            } catch (fallbackErr) {
                console.error('Upload error:', fallbackErr);
                return { status: 'error', message: fallbackErr.message };
            }
        }
    }
};
