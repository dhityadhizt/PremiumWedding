import { data } from "../assets/data/data.js";
import { galleryService } from "../services/galleryService.js";

export const galeri = () => {
    const galeriElement = document.querySelector('.galeri');
    const container = galeriElement.querySelector('.container');
    const showAllContainer = galeriElement.querySelector('.galeri-modal-all');

    const figureElement = container.querySelector('figure');
    const paginationElement = container.querySelector('ul');
    const prevButton = container.querySelector('button[aria-label="button prev galeri"]');
    const nextButton = container.querySelector('button[aria-label="button next galeri"]');
    const openCameraBtn = document.getElementById('open-live-camera-btn');
    const showAllButton = document.getElementById('show-all-photos-btn');

    const showAllBox = showAllContainer.querySelector('div');
    const closeButton = showAllContainer.querySelector('button[aria-label="close button"]');

    // Camera Modal Elements
    const cameraModal = document.getElementById('live-camera-modal');
    const closeCameraBtn = document.getElementById('close-camera-modal');
    const guestNameInput = document.getElementById('camera-guest-name');
    const videoStreamEl = document.getElementById('live-video-stream');
    const canvasEl = document.getElementById('live-photo-canvas');
    const previewImgEl = document.getElementById('live-photo-preview');
    const loadingOverlay = document.getElementById('camera-loading-overlay');
    const statusTextEl = document.getElementById('camera-status-text');

    const captureControls = document.getElementById('camera-capture-controls');
    const previewControls = document.getElementById('camera-preview-controls');
    const switchCameraBtn = document.getElementById('switch-camera-btn');
    const capturePhotoBtn = document.getElementById('capture-photo-btn');
    const fallbackCameraInput = document.getElementById('fallback-camera-input');
    const retakePhotoBtn = document.getElementById('retake-photo-btn');
    const uploadPhotoBtn = document.getElementById('upload-photo-btn');

    // State galeri gabungan (foto live tamu + foto bawaan)
    let galleryItems = [...data.galeri];
    let currentIndex = 0;
    let autoPlayTimer = null;

    // State kamera
    let currentStream = null;
    let facingMode = 'environment'; // default kamera belakang ('user' untuk depan)
    let capturedPngDataUrl = null;

    // Pre-fill nama tamu dari parameter URL (?to=Nama+Tamu) jika ada
    const urlParams = new URLSearchParams(window.location.search);
    const toParam = urlParams.get('to');
    if (toParam && guestNameInput) {
        guestNameInput.value = toParam;
    }

    const renderCarousel = () => {
        if (galleryItems.length === 0) return;
        if (currentIndex >= galleryItems.length) currentIndex = 0;
        if (currentIndex < 0) currentIndex = galleryItems.length - 1;

        const currentItem = galleryItems[currentIndex];
        const captionHtml = currentItem.guestName
            ? `<figcaption class="galeri-caption"><i class='bx bxs-camera'></i> Foto oleh: <strong>${escapeHtml(currentItem.guestName)}</strong></figcaption>`
            : '';

        figureElement.innerHTML = `
            <img src="${currentItem.image}" alt="galeri image" id="${currentItem.id}" loading="lazy">
            ${captionHtml}
        `;

        paginationElement.innerHTML = '';
        galleryItems.forEach((item, idx) => {
            const li = document.createElement('li');
            li.dataset.index = idx;
            if (idx === currentIndex) li.classList.add('active');
            li.addEventListener('click', () => {
                currentIndex = idx;
                renderCarousel();
                resetAutoPlay();
            });
            paginationElement.appendChild(li);
        });
    };

    const escapeHtml = (str) => {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    };

    const nextSlide = () => {
        currentIndex = (currentIndex + 1) % galleryItems.length;
        renderCarousel();
    };

    const prevSlide = () => {
        currentIndex = (currentIndex - 1 + galleryItems.length) % galleryItems.length;
        renderCarousel();
    };

    const resetAutoPlay = () => {
        if (autoPlayTimer) clearInterval(autoPlayTimer);
        autoPlayTimer = setInterval(nextSlide, 3500);
    };

    nextButton.addEventListener('click', () => {
        nextSlide();
        resetAutoPlay();
    });

    prevButton.addEventListener('click', () => {
        prevSlide();
        resetAutoPlay();
    });

    showAllButton.addEventListener('click', () => {
        showAllBox.innerHTML = galleryItems.map(item => `
            <div class="galeri-grid-item">
                <img src="${item.image}" alt="image galeri" loading="lazy">
                ${item.guestName ? `<span class="grid-guest-badge"><i class='bx bxs-camera'></i> ${escapeHtml(item.guestName)}</span>` : ''}
            </div>
        `).join('');
        showAllContainer.classList.add('active');
    });

    closeButton.addEventListener('click', () => {
        showAllBox.innerHTML = '';
        showAllContainer.classList.remove('active');
    });

    // --- Sinkronisasi Foto dari Google Drive / Spreadsheet ---
    const loadRemotePhotos = async () => {
        const remotePhotos = await galleryService.getPhotos();
        if (remotePhotos && remotePhotos.length > 0) {
            // Gabungkan foto live dari tamu di urutan paling depan, diikuti foto bawaan
            galleryItems = [...remotePhotos, ...data.galeri];
            currentIndex = 0;
            renderCarousel();
        }
    };

    // --- Fitur Kamera Langsung (WebRTC getUserMedia + PNG Export) ---
    const stopCameraStream = () => {
        if (currentStream) {
            currentStream.getTracks().forEach(track => track.stop());
            currentStream = null;
        }
        videoStreamEl.srcObject = null;
    };

    const startCameraStream = async () => {
        stopCameraStream();
        capturedPngDataUrl = null;
        previewImgEl.style.display = 'none';
        videoStreamEl.style.display = 'block';
        captureControls.style.display = 'flex';
        previewControls.style.display = 'none';
        loadingOverlay.style.display = 'none';

        // Mirror tampilan video hanya jika menggunakan kamera depan ('user')
        videoStreamEl.style.transform = facingMode === 'user' ? 'scaleX(-1)' : 'scaleX(1)';

        try {
            const constraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1920 },
                    height: { ideal: 1080 }
                },
                audio: false
            };
            currentStream = await navigator.mediaDevices.getUserMedia(constraints);
            videoStreamEl.srcObject = currentStream;
        } catch (err) {
            console.warn('Akses WebRTC kamera gagal/ditolak, gunakan tombol Kamera HP:', err);
            alert('Kamera browser tidak dapat diakses langsung (pastikan izin kamera aktif & menggunakan HTTPS). Silakan gunakan tombol "Kamera HP" di kanan bawah.');
        }
    };

    openCameraBtn.addEventListener('click', () => {
        cameraModal.classList.add('active');
        cameraModal.setAttribute('aria-hidden', 'false');
        startCameraStream();
    });

    closeCameraBtn.addEventListener('click', () => {
        stopCameraStream();
        cameraModal.classList.remove('active');
        cameraModal.setAttribute('aria-hidden', 'true');
    });

    switchCameraBtn.addEventListener('click', () => {
        facingMode = facingMode === 'environment' ? 'user' : 'environment';
        startCameraStream();
    });

    // Jepret foto dari live stream -> konversi ke PNG berkualitas penuh
    capturePhotoBtn.addEventListener('click', () => {
        if (!currentStream) return;

        const videoWidth = videoStreamEl.videoWidth || 1280;
        const videoHeight = videoStreamEl.videoHeight || 720;

        canvasEl.width = videoWidth;
        canvasEl.height = videoHeight;

        const ctx = canvasEl.getContext('2d');
        if (facingMode === 'user') {
            ctx.translate(videoWidth, 0);
            ctx.scale(-1, 1);
        }
        ctx.drawImage(videoStreamEl, 0, 0, videoWidth, videoHeight);

        // Export sebagai PNG lossless
        capturedPngDataUrl = canvasEl.toDataURL('image/png');

        previewImgEl.src = capturedPngDataUrl;
        videoStreamEl.style.display = 'none';
        previewImgEl.style.display = 'block';
        captureControls.style.display = 'none';
        previewControls.style.display = 'flex';

        stopCameraStream();
    });

    // Fallback: jika tamu memakai input kamera bawaan HP (<input type="file" capture>)
    fallbackCameraInput.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                // Konversi gambar ke PNG berkualitas tinggi via Canvas (batasi max sisi 1920px agar stabil saat upload)
                const maxDim = 1920;
                let w = img.width;
                let h = img.height;
                if (w > maxDim || h > maxDim) {
                    if (w > h) {
                        h = Math.round((h * maxDim) / w);
                        w = maxDim;
                    } else {
                        w = Math.round((w * maxDim) / h);
                        h = maxDim;
                    }
                }
                canvasEl.width = w;
                canvasEl.height = h;
                const ctx = canvasEl.getContext('2d');
                ctx.drawImage(img, 0, 0, w, h);

                capturedPngDataUrl = canvasEl.toDataURL('image/png');
                previewImgEl.src = capturedPngDataUrl;
                videoStreamEl.style.display = 'none';
                previewImgEl.style.display = 'block';
                captureControls.style.display = 'none';
                previewControls.style.display = 'flex';
                stopCameraStream();
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });

    retakePhotoBtn.addEventListener('click', () => {
        fallbackCameraInput.value = '';
        startCameraStream();
    });

    // Upload PNG ke Google Drive via Apps Script & langsung tampilkan di Galeri
    uploadPhotoBtn.addEventListener('click', async () => {
        if (!capturedPngDataUrl) return;

        const guestName = guestNameInput.value.trim() || 'Tamu Undangan';
        loadingOverlay.style.display = 'flex';
        statusTextEl.textContent = 'Menyimpan foto PNG ke Google Drive...';
        uploadPhotoBtn.disabled = true;
        retakePhotoBtn.disabled = true;

        const response = await galleryService.uploadPhoto({
            guestName: guestName,
            imageBase64: capturedPngDataUrl
        });

        uploadPhotoBtn.disabled = false;
        retakePhotoBtn.disabled = false;
        loadingOverlay.style.display = 'none';

        if (response && response.status === 'success' && response.photo) {
            // Langsung masukkan foto baru ke urutan pertama galeri undangan
            galleryItems.unshift(response.photo);
            currentIndex = 0;
            renderCarousel();
            resetAutoPlay();

            // Tutup modal
            cameraModal.classList.remove('active');
            cameraModal.setAttribute('aria-hidden', 'true');
            alert('Foto berhasil disimpan ke Google Drive & ditampilkan di Galeri!');
        } else {
            // Tetap tampilkan sementara secara lokal jika API belum di-deploy ulang
            galleryItems.unshift({
                id: Date.now(),
                guestName: guestName,
                image: capturedPngDataUrl
            });
            currentIndex = 0;
            renderCarousel();
            cameraModal.classList.remove('active');
            alert('Foto ditampilkan di galeri lokal. Pastikan URL Google Apps Script sudah diperbarui agar otomatis tersimpan ke Drive.');
        }
    });

    // Inisialisasi awal
    renderCarousel();
    resetAutoPlay();
    loadRemotePhotos();
};
