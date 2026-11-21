import { data } from "../assets/data/data.js";
import { livePhotoService } from "../services/livePhotoService.js";
import { generateRandomId, getCurrentDateTime, getQueryParameter } from "../utils/helper.js";

const LOCAL_STORAGE_KEY = 'premiumwedding_live_photos_v1';

const readLocalPhotos = () => {
    try {
        const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
        const parsed = raw ? JSON.parse(raw) : [];
        return Array.isArray(parsed) ? parsed : [];
    } catch (_) {
        return [];
    }
};

const writeLocalPhotos = (photos) => {
    try {
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(photos.slice(0, 30)));
    } catch (_) {
        // Abaikan jika storage penuh
    }
};

const normalizeDriveImageUrl = (url) => {
    if (!url || typeof url !== 'string') return '';
    const trimmed = url.trim();
    if (trimmed.startsWith('data:image/')) return trimmed;

    // Ekstrak ID file Google Drive jika formatnya /d/<id>/ atau id=<id>
    const dMatch = trimmed.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
    const idMatch = trimmed.match(/[?&]id=([a-zA-Z0-9_-]+)/);
    const fileId = (dMatch && dMatch[1]) || (idMatch && idMatch[1]);

    if (fileId) {
        return `https://lh3.googleusercontent.com/d/${fileId}=w1000`;
    }
    return trimmed;
};

const buildStandardPngDataUrl = (videoEl, canvasEl) => {
    const cfg = data.livePhotoConfig || {};
    const maxW = cfg.maxWidth || 1280;
    const maxH = cfg.maxHeight || 1280;
    const mimeType = cfg.mimeType || 'image/png';
    const quality = typeof cfg.quality === 'number' ? cfg.quality : 0.85;

    const srcW = videoEl.videoWidth || 1280;
    const srcH = videoEl.videoHeight || 720;

    let targetW = srcW;
    let targetH = srcH;
    const ratio = Math.min(maxW / srcW, maxH / srcH, 1);
    targetW = Math.max(1, Math.round(srcW * ratio));
    targetH = Math.max(1, Math.round(srcH * ratio));

    canvasEl.width = targetW;
    canvasEl.height = targetH;

    const ctx = canvasEl.getContext('2d');
    ctx.drawImage(videoEl, 0, 0, targetW, targetH);

    // Format PNG standar agar kualitas terjaga tanpa membengkak berlebih
    return canvasEl.toDataURL(mimeType, quality);
};

export const liveCamera = (onNewPhotoAdded) => {
    const galeriSection = document.querySelector('.galeri');
    if (!galeriSection) return;

    const openBtn = galeriSection.querySelector('#open-live-camera-btn');
    const modal = document.getElementById('live-camera-modal');
    if (!openBtn || !modal) return;

    const closeBtn = modal.querySelector('#close-live-camera-btn');
    const switchBtn = modal.querySelector('#switch-camera-btn');
    const captureBtn = modal.querySelector('#capture-live-photo-btn');
    const retakeBtn = modal.querySelector('#retake-live-photo-btn');
    const uploadBtn = modal.querySelector('#upload-live-photo-btn');
    const videoEl = modal.querySelector('#live-camera-video');
    const canvasEl = modal.querySelector('#live-camera-canvas');
    const previewImg = modal.querySelector('#live-photo-preview');
    const guestInput = modal.querySelector('#live-photo-guest');
    const captionInput = modal.querySelector('#live-photo-caption');
    const statusText = modal.querySelector('#live-camera-status');
    const fallbackFileInput = modal.querySelector('#live-camera-fallback-file');

    let stream = null;
    let currentFacingMode = (data.livePhotoConfig && data.livePhotoConfig.defaultFacingMode) || 'environment';
    let capturedDataUrl = null;
    let isUploading = false;

    const defaultGuest = getQueryParameter('to');
    if (defaultGuest && guestInput && !guestInput.value) {
        guestInput.value = defaultGuest;
    }

    const setStatus = (msg, type = 'info') => {
        if (!statusText) return;
        statusText.textContent = msg;
        statusText.dataset.statusType = type;
    };

    const stopStream = () => {
        if (stream) {
            stream.getTracks().forEach((track) => track.stop());
            stream = null;
        }
        if (videoEl) {
            videoEl.srcObject = null;
        }
    };

    const startCamera = async (facingMode) => {
        stopStream();
        capturedDataUrl = null;

        if (previewImg) {
            previewImg.style.display = 'none';
            previewImg.removeAttribute('src');
        }
        if (videoEl) {
            videoEl.style.display = 'block';
        }
        if (captureBtn) captureBtn.style.display = 'inline-flex';
        if (retakeBtn) retakeBtn.style.display = 'none';
        if (uploadBtn) {
            uploadBtn.style.display = 'none';
            uploadBtn.disabled = false;
        }

        const labelKamera = facingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang';

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            setStatus('Browser tidak mendukung kamera langsung. Silakan gunakan tombol ambil foto kamera bawaan.', 'warning');
            if (fallbackFileInput) fallbackFileInput.style.display = 'block';
            return;
        }

        try {
            setStatus(`Mengaktifkan ${labelKamera}...`, 'info');
            stream = await navigator.mediaDevices.getUserMedia({
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 720 }
                },
                audio: false
            });

            if (videoEl) {
                videoEl.srcObject = stream;
                videoEl.classList.toggle('mirrored', facingMode === 'user');
                await videoEl.play();
            }

            if (fallbackFileInput) fallbackFileInput.style.display = 'none';
            setStatus(`${labelKamera} aktif. Siap jepret momen terbaik Anda!`, 'success');
        } catch (err) {
            console.warn('Kamera gagal diakses:', err);
            setStatus(`Izin ${labelKamera} belum aktif atau perangkat tidak tersedia. Anda tetap bisa memakai kamera bawaan HP.`, 'warning');
            if (fallbackFileInput) fallbackFileInput.style.display = 'block';
        }
    };

    const openModal = async () => {
        modal.classList.add('active');
        modal.setAttribute('aria-hidden', 'false');
        document.body.classList.add('live-camera-open');
        await startCamera(currentFacingMode);
    };

    const closeModal = () => {
        stopStream();
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        document.body.classList.remove('live-camera-open');
    };

    openBtn.addEventListener('click', openModal);
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
        if (e.target === modal) {
            closeModal();
        }
    });

    if (switchBtn) {
        switchBtn.addEventListener('click', async () => {
            currentFacingMode = currentFacingMode === 'environment' ? 'user' : 'environment';
            await startCamera(currentFacingMode);
        });
    }

    if (captureBtn) {
        captureBtn.addEventListener('click', () => {
            if (!videoEl || !canvasEl || !videoEl.videoWidth) {
                setStatus('Video kamera belum siap. Tunggu sebentar atau gunakan tombol kamera bawaan.', 'warning');
                return;
            }

            capturedDataUrl = buildStandardPngDataUrl(videoEl, canvasEl);
            stopStream();

            if (videoEl) videoEl.style.display = 'none';
            if (previewImg) {
                previewImg.src = capturedDataUrl;
                previewImg.style.display = 'block';
            }

            captureBtn.style.display = 'none';
            if (retakeBtn) retakeBtn.style.display = 'inline-flex';
            if (uploadBtn) uploadBtn.style.display = 'inline-flex';

            setStatus('Foto PNG standar siap dikirim ke Galeri & Google Drive!', 'success');
        });
    }

    if (fallbackFileInput) {
        fallbackFileInput.addEventListener('change', (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const cfg = data.livePhotoConfig || {};
                    const maxW = cfg.maxWidth || 1280;
                    const maxH = cfg.maxHeight || 1280;
                    const mimeType = cfg.mimeType || 'image/png';
                    const quality = typeof cfg.quality === 'number' ? cfg.quality : 0.85;

                    const ratio = Math.min(maxW / img.width, maxH / img.height, 1);
                    canvasEl.width = Math.max(1, Math.round(img.width * ratio));
                    canvasEl.height = Math.max(1, Math.round(img.height * ratio));
                    const ctx = canvasEl.getContext('2d');
                    ctx.drawImage(img, 0, 0, canvasEl.width, canvasEl.height);

                    capturedDataUrl = canvasEl.toDataURL(mimeType, quality);
                    if (videoEl) videoEl.style.display = 'none';
                    if (previewImg) {
                        previewImg.src = capturedDataUrl;
                        previewImg.style.display = 'block';
                    }
                    if (captureBtn) captureBtn.style.display = 'none';
                    if (retakeBtn) retakeBtn.style.display = 'inline-flex';
                    if (uploadBtn) uploadBtn.style.display = 'inline-flex';
                    setStatus('Foto terkonversi ke PNG standar. Klik Kirim ke Galeri.', 'success');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    if (retakeBtn) {
        retakeBtn.addEventListener('click', async () => {
            await startCamera(currentFacingMode);
        });
    }

    if (uploadBtn) {
        uploadBtn.addEventListener('click', async () => {
            if (!capturedDataUrl || isUploading) return;
            isUploading = true;
            uploadBtn.disabled = true;
            const originalLabel = uploadBtn.innerHTML;
            uploadBtn.innerHTML = `<i class='bx bx-loader-alt bx-spin'></i><span>Mengirim...</span>`;
            setStatus('Mengunggah foto PNG ke Google Drive & memperbarui galeri...', 'info');

            const id = `live_${generateRandomId()}`;
            const guestName = (guestInput && guestInput.value.trim()) || 'Tamu Undangan';
            const caption = (captionInput && captionInput.value.trim()) || '';
            const date = getCurrentDateTime();
            const base64Parts = capturedDataUrl.split(',');
            const imageBase64 = base64Parts.length > 1 ? base64Parts[1] : capturedDataUrl;

            const newPhotoItem = {
                id,
                image: capturedDataUrl,
                guestName,
                caption,
                date,
                facingMode: currentFacingMode,
                isLive: true
            };

            // Simpan ke cache lokal agar langsung tampil di galeri meski jaringan lambat
            const localList = readLocalPhotos();
            writeLocalPhotos([newPhotoItem, ...localList]);

            try {
                if (livePhotoService.isConfigured()) {
                    await livePhotoService.uploadLivePhoto({
                        id,
                        guestName,
                        facingMode: currentFacingMode,
                        caption,
                        date,
                        imageBase64,
                        mimeType: (data.livePhotoConfig && data.livePhotoConfig.mimeType) || 'image/png'
                    });
                    setStatus('Foto berhasil dikirim ke Google Drive & tampil di galeri!', 'success');
                } else {
                    setStatus('Foto tampil di galeri. Atur URL livePhotoApi di data.js agar otomatis masuk ke Google Drive.', 'warning');
                }

                if (typeof onNewPhotoAdded === 'function') {
                    await onNewPhotoAdded(newPhotoItem);
                }

                if (captionInput) captionInput.value = '';
                setTimeout(() => {
                    closeModal();
                }, 700);
            } catch (err) {
                console.error('Gagal mengunggah live photo:', err);
                setStatus('Foto tersimpan di galeri lokal, namun gagal terhubung ke server Drive.', 'warning');
                if (typeof onNewPhotoAdded === 'function') {
                    await onNewPhotoAdded(newPhotoItem);
                }
            } finally {
                isUploading = false;
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = originalLabel;
            }
        });
    }
};

export const fetchCombinedGalleryPhotos = async () => {
    const baseItems = (data.galeri || []).map((item, idx) => ({
        id: item.id || `base_${idx + 1}`,
        image: item.image,
        guestName: '',
        caption: '',
        date: '',
        isLive: false
    }));

    const localPhotos = readLocalPhotos();
    let remotePhotos = [];

    if (livePhotoService.isConfigured()) {
        const { photos } = await livePhotoService.getLivePhotos();
        remotePhotos = (photos || []).map((p, i) => ({
            id: p.id || `remote_${i + 1}`,
            image: normalizeDriveImageUrl(p.imageUrl || p.image || p.url || ''),
            guestName: p.guestName || p.name || 'Tamu Undangan',
            caption: p.caption || p.message || '',
            date: p.date || '',
            isLive: true
        })).filter((p) => Boolean(p.image));
    }

    const mergedLive = [];
    const seenIds = new Set();

    for (const item of [...remotePhotos, ...localPhotos]) {
        const key = item.id || item.image.slice(0, 64);
        if (!seenIds.has(key) && item.image) {
            seenIds.add(key);
            mergedLive.push(item);
        }
    }

    // Foto live terbaru tampil lebih dulu, diikuti foto galeri bawaan
    return [...mergedLive, ...baseItems];
};
