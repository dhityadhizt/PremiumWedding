import { data } from "../assets/data/data.js";

const STORAGE_KEY = "premium_wedding_live_photos_v1";

/**
 * Mengompresi gambar (File / Blob / HTMLCanvasElement) ke kualitas standar namun tetap tajam (JPEG).
 * Default: maksimal sisi 1280px, kualitas JPEG 0.78.
 */
export const compressImageToStandard = (source, options = {}) => {
    const maxWidth = options.maxWidth || (data.livePhoto && data.livePhoto.maxWidth) || 1280;
    const maxHeight = options.maxHeight || (data.livePhoto && data.livePhoto.maxHeight) || 1280;
    const quality = options.quality || (data.livePhoto && data.livePhoto.jpegQuality) || 0.78;

    return new Promise((resolve, reject) => {
        const renderFromImage = (img) => {
            let { width, height } = img;
            if (!width || !height) {
                reject(new Error("Dimensi gambar tidak valid."));
                return;
            }

            if (width > maxWidth || height > maxHeight) {
                const ratio = Math.min(maxWidth / width, maxHeight / height);
                width = Math.round(width * ratio);
                height = Math.round(height * ratio);
            }

            const canvas = document.createElement("canvas");
            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext("2d", { alpha: false });
            ctx.fillStyle = "#FFFFFF";
            ctx.fillRect(0, 0, width, height);
            ctx.drawImage(img, 0, 0, width, height);

            const base64DataUrl = canvas.toDataURL("image/jpeg", quality);
            const base64Pure = base64DataUrl.split(",")[1] || "";

            canvas.toBlob(
                (blob) => {
                    resolve({
                        dataUrl: base64DataUrl,
                        base64: base64Pure,
                        blob,
                        width,
                        height,
                        sizeKB: blob ? Math.round(blob.size / 1024) : Math.round((base64Pure.length * 0.75) / 1024),
                        mimeType: "image/jpeg"
                    });
                },
                "image/jpeg",
                quality
            );
        };

        if (source instanceof HTMLCanvasElement) {
            const img = new Image();
            img.onload = () => renderFromImage(img);
            img.onerror = () => reject(new Error("Gagal memproses hasil tangkapan kamera."));
            img.src = source.toDataURL("image/jpeg", 0.92);
            return;
        }

        if (source instanceof Blob || source instanceof File) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => renderFromImage(img);
                img.onerror = () => reject(new Error("Gagal memuat file foto."));
                img.src = event.target.result;
            };
            reader.onerror = () => reject(new Error("Gagal membaca file foto."));
            reader.readAsDataURL(source);
            return;
        }

        reject(new Error("Sumber gambar tidak didukung."));
    });
};

export const getLocalLivePhotos = () => {
    try {
        const raw = localStorage.getItem(STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        console.warn("Gagal membaca cache foto lokal:", error);
        return [];
    }
};

export const saveLocalLivePhoto = (photoItem) => {
    try {
        const current = getLocalLivePhotos();
        // Simpan maksimal 25 foto terbaru di localStorage agar kuota browser aman
        const updated = [photoItem, ...current].slice(0, 25);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
        return updated;
    } catch (error) {
        console.warn("LocalStorage penuh atau dibatasi:", error);
        return getLocalLivePhotos();
    }
};

/**
 * Mengambil daftar foto live dari Google Apps Script Web App (yang membaca dari Google Sheets / Drive)
 */
export const fetchRemoteLivePhotos = async () => {
    const endpoint = (data.livePhoto && data.livePhoto.apiUrl) || data.api;
    if (!endpoint || endpoint.includes("GANTI_DENGAN_URL")) {
        return [];
    }

    try {
        const url = new URL(endpoint);
        url.searchParams.set("action", "photos");
        url.searchParams.set("_t", Date.now().toString());

        const response = await fetch(url.toString(), { method: "GET" });
        if (!response.ok) return [];

        const json = await response.json();
        const items = json.photos || json.data || [];
        if (!Array.isArray(items)) return [];

        return items
            .filter((item) => item && (item.imageUrl || item.image || item.driveViewUrl))
            .map((item, idx) => ({
                id: item.id || `remote-${idx}-${Date.now()}`,
                sender: item.sender || item.name || "Tamu Undangan",
                caption: item.caption || item.message || "Momen Spesial",
                cameraMode: item.cameraMode || item.camera || "live",
                createdAt: item.createdAt || item.date || "",
                image: item.imageUrl || item.image || item.driveViewUrl,
                driveUrl: item.driveUrl || item.driveViewUrl || item.imageUrl || "",
                isRemote: true
            }));
    } catch (error) {
        console.warn("Belum dapat memuat foto remote dari Apps Script:", error.message);
        return [];
    }
};

/**
 * Mengirim foto hasil kompresi ke Google Apps Script Web App untuk disimpan ke Google Drive & Google Sheets.
 * Menggunakan mode: 'no-cors' agar kompatibel dengan Google Apps Script web app redirect.
 */
export const uploadLivePhotoToDriveAndSheet = async ({
    id,
    sender,
    caption,
    cameraMode,
    createdAt,
    base64,
    mimeType,
    fileName
}) => {
    const endpoint = (data.livePhoto && data.livePhoto.apiUrl) || data.api;
    if (!endpoint || endpoint.includes("GANTI_DENGAN_URL")) {
        return { sent: false, reason: "Endpoint Apps Script belum dikonfigurasi." };
    }

    const payload = {
        type: "live_photo",
        action: "upload_photo",
        id,
        sender,
        caption,
        cameraMode,
        createdAt,
        fileName,
        mimeType: mimeType || "image/jpeg",
        imageBase64: base64
    };

    try {
        await fetch(endpoint, {
            method: "POST",
            mode: "no-cors",
            headers: {
                "Content-Type": "text/plain;charset=utf-8"
            },
            body: JSON.stringify(payload)
        });
        return { sent: true };
    } catch (error) {
        console.error("Gagal mengirim foto ke Apps Script:", error);
        return { sent: false, reason: error.message };
    }
};
