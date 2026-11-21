import { data } from "../assets/data/data.js";
import {
    compressImageToStandard,
    fetchRemoteLivePhotos,
    getLocalLivePhotos,
    saveLocalLivePhoto,
    uploadLivePhotoToDriveAndSheet
} from "../services/photoService.js";
import { getCurrentDateTime } from "../utils/helper.js";

export const galeri = () => {
    const galeriElement = document.querySelector('.galeri');
    if (!galeriElement) return;

    const showAllContainer = galeriElement.querySelector('div:nth-of-type(2)');
    const [_, figureElement, paginationElement, prevButton, nextButton, actionsWrapper] = galeriElement.children[0].children;
    const showAllButton = actionsWrapper ? actionsWrapper.querySelector('button[aria-label="Lihat semua foto"]') : null;
    const openCameraButton = document.getElementById('open-live-camera-btn');

    const [__, showAllBox, closeButton] = showAllContainer.children;

    // Elemen Modal Live Photo Sharing
    const modal = document.getElementById('live-photo-modal');
    const closeModalBtn = document.getElementById('close-live-photo-modal');
    const btnCamRear = document.getElementById('btn-cam-rear');
    const btnCamFront = document.getElementById('btn-cam-front');
    const videoEl = document.getElementById('live-camera-video');
    const previewEl = document.getElementById('live-camera-preview');
    const canvasEl = document.getElementById('live-camera-canvas');
    const statusEl = document.getElementById('live-camera-status');
    const fallbackInput = document.getElementById('fallback-camera-input');
    const btnCapture = document.getElementById('btn-capture-photo');
    const btnRetake = document.getElementById('btn-retake-photo');
    const uploadForm = document.getElementById('live-photo-upload-form');
    const senderInput = document.getElementById('live-photo-sender');
    const captionInput = document.getElementById('live-photo-caption');
    const submitPhotoBtn = document.getElementById('btn-submit-live-photo');

    let combinedGallery = [...data.galeri];
    let currentFacingMode = 'environment'; // 'environment' (belakang) | 'user' (depan)
    let activeStream = null;
    let capturedCompressedPhoto = null;

    const rebuildGalleryItems = (remotePhotos = []) => {
        const localPhotos = getLocalLivePhotos();
        const mergedMap = new Map();

        // Gabungkan foto remote & foto lokal terbaru di bagian depan galeri agar langsung terlihat tamu
        [...remotePhotos, ...localPhotos].forEach((item) => {
            if (item && item.image && !mergedMap.has(item.image)) {
                mergedMap.set(item.image, {
                    id: item.id || `live-${Math.random().toString(36).slice(2, 8)}`,
                    image: item.image,
                    sender: item.sender || 'Tamu Undangan',
                    caption: item.caption || '',
                    isLive: true
                });
            }
        });

        const baseItems = data.galeri.map((item) => ({
            ...item,
            isLive: false
        }));

        combinedGallery = [...Array.from(mergedMap.values()), ...baseItems];
    };

    const renderPagination = (activeId) => {
        paginationElement.innerHTML = '';
        combinedGallery.forEach((item, index) => {
            const isActive = String(item.id) === String(activeId) || (index === 0 && !activeId);
            const li = document.createElement('li');
            li.dataset.id = String(item.id);
            if (isActive) li.classList.add('active');
            li.addEventListener('click', () => {
                updateNavigationButtons(item.id);
                updateGalleryImage(item.id);
            });
            paginationElement.appendChild(li);
        });
    };

    const updateNavigationButtons = (id) => {
        nextButton.dataset.id = String(id);
        prevButton.dataset.id = String(id);
    };

    const updateGalleryImage = (id) => {
        if (!combinedGallery.length) return;
        const selectedImage = combinedGallery.find((item) => String(item.id) === String(id)) || combinedGallery[0];
        const badgeHtml = selectedImage.isLive
            ? `<span class="live-photo-badge"><i class="bx bxs-camera"></i> Live dari ${escapeHtml(selectedImage.sender || 'Tamu')}</span>`
            : '';

        figureElement.innerHTML = `
            <img src="${selectedImage.image}" alt="galeri image" id="galeri-img-${selectedImage.id}">
            ${badgeHtml}
        `;
        updateNavigationButtons(selectedImage.id);

        paginationElement.querySelectorAll('li').forEach((li) => {
            li.classList.toggle('active', li.dataset.id === String(selectedImage.id));
        });
    };

    const refreshGalleryView = (keepCurrentId = null) => {
        const targetItem =
            (keepCurrentId && combinedGallery.find((item) => String(item.id) === String(keepCurrentId))) ||
            combinedGallery[0];
        if (!targetItem) return;
        renderPagination(targetItem.id);
        updateGalleryImage(targetItem.id);
    };

    const autoPlayGallery = () => {
        if (!combinedGallery.length || modal?.classList.contains('active')) return;
        const currentIndex = combinedGallery.findIndex((item) => String(item.id) === String(nextButton.dataset.id));
        const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % combinedGallery.length : 0;
        const nextItem = combinedGallery[nextIndex];
        updateNavigationButtons(nextItem.id);
        updateGalleryImage(nextItem.id);
    };

    nextButton.addEventListener('click', () => {
        if (!combinedGallery.length) return;
        const currentIndex = combinedGallery.findIndex((item) => String(item.id) === String(nextButton.dataset.id));
        const nextIndex = currentIndex < combinedGallery.length - 1 ? currentIndex + 1 : 0;
        const nextItem = combinedGallery[nextIndex];
        updateNavigationButtons(nextItem.id);
        updateGalleryImage(nextItem.id);
    });

    prevButton.addEventListener('click', () => {
        if (!combinedGallery.length) return;
        const currentIndex = combinedGallery.findIndex((item) => String(item.id) === String(prevButton.dataset.id));
        const prevIndex = currentIndex > 0 ? currentIndex - 1 : combinedGallery.length - 1;
        const prevItem = combinedGallery[prevIndex];
        updateNavigationButtons(prevItem.id);
        updateGalleryImage(prevItem.id);
    });

    if (showAllButton) {
        showAllButton.addEventListener('click', () => {
            showAllBox.innerHTML = combinedGallery
                .map((item) => {
                    const captionText = item.isLive
                        ? `<div class="grid-photo-caption"><i class="bx bxs-camera"></i> ${escapeHtml(item.sender)}${item.caption ? ` — ${escapeHtml(item.caption)}` : ''}</div>`
                        : '';
                    return `
                        <div class="grid-photo-item">
                            <img src="${item.image}" alt="image galeri" loading="lazy">
                            ${captionText}
                        </div>
                    `;
                })
                .join('');
            showAllContainer.classList.add('active');
        });
    }

    closeButton.addEventListener('click', () => {
        showAllBox.innerHTML = '';
        showAllContainer.classList.remove('active');
    });

    // --- LOGIKA LIVE PHOTO SHARING (KAMERA DEPAN / BELAKANG) ---
    const stopCameraStream = () => {
        if (activeStream) {
            activeStream.getTracks().forEach((track) => track.stop());
            activeStream = null;
        }
        if (videoEl) {
            videoEl.srcObject = null;
        }
    };

    const setCameraSwitchUI = (facingMode) => {
        currentFacingMode = facingMode;
        if (btnCamRear) btnCamRear.classList.toggle('active', facingMode === 'environment');
        if (btnCamFront) btnCamFront.classList.toggle('active', facingMode === 'user');
    };

    const resetCaptureState = () => {
        capturedCompressedPhoto = null;
        if (submitPhotoBtn) submitPhotoBtn.disabled = true;
        if (btnRetake) btnRetake.style.display = 'none';
        if (previewEl) {
            previewEl.style.display = 'none';
            previewEl.src = '';
        }
        if (videoEl) {
            videoEl.style.display = 'block';
        }
    };

    const startCamera = async (facingMode = currentFacingMode) => {
        setCameraSwitchUI(facingMode);
        resetCaptureState();

        if (statusEl) {
            statusEl.style.display = 'flex';
            statusEl.textContent = facingMode === 'user'
                ? 'Membuka kamera depan...'
                : 'Membuka kamera belakang...';
        }

        stopCameraStream();

        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
            if (statusEl) {
                statusEl.textContent = 'Browser tidak mendukung kamera langsung. Klik "Ambil Foto" untuk membuka kamera HP.';
            }
            return;
        }

        try {
            const constraints = {
                video: {
                    facingMode: { ideal: facingMode },
                    width: { ideal: 1280 },
                    height: { ideal: 1280 }
                },
                audio: false
            };

            const stream = await navigator.mediaDevices.getUserMedia(constraints);
            activeStream = stream;
            if (videoEl) {
                videoEl.srcObject = stream;
                await videoEl.play();
            }
            if (statusEl) {
                statusEl.style.display = 'none';
            }
        } catch (err) {
            console.warn('getUserMedia fallback:', err);
            if (statusEl) {
                statusEl.textContent = 'Izin kamera langsung belum aktif/ditolak. Anda tetap bisa klik "Ambil Foto" untuk memakai kamera bawaan perangkat.';
            }
        }
    };

    const openLivePhotoModal = async () => {
        if (!modal) return;
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
        await startCamera(currentFacingMode);
    };

    const closeLivePhotoModal = () => {
        stopCameraStream();
        resetCaptureState();
        if (modal) {
            modal.classList.remove('active');
        }
        document.body.style.overflow = '';
    };

    if (openCameraButton) {
        openCameraButton.addEventListener('click', openLivePhotoModal);
    }

    if (closeModalBtn) {
        closeModalBtn.addEventListener('click', closeLivePhotoModal);
    }

    if (modal) {
        modal.addEventListener('click', (e) => {
            if (e.target === modal) {
                closeLivePhotoModal();
            }
        });
    }

    if (btnCamRear) {
        btnCamRear.addEventListener('click', () => startCamera('environment'));
    }

    if (btnCamFront) {
        btnCamFront.addEventListener('click', () => startCamera('user'));
    }

    if (btnCapture) {
        btnCapture.addEventListener('click', async () => {
            const hasLiveVideo = activeStream && videoEl && videoEl.readyState >= 2 && videoEl.videoWidth > 0;

            if (!hasLiveVideo) {
                // Gunakan input file kamera bawaan HP dengan atribut capture sesuai pilihan kamera depan/belakang
                if (fallbackInput) {
                    fallbackInput.setAttribute('capture', currentFacingMode === 'user' ? 'user' : 'environment');
                    fallbackInput.click();
                }
                return;
            }

            canvasEl.width = videoEl.videoWidth;
            canvasEl.height = videoEl.videoHeight;
            const ctx = canvasEl.getContext('2d');

            // Mirror visual saat menggunakan kamera depan agar terasa natural bagi tamu
            if (currentFacingMode === 'user') {
                ctx.translate(canvasEl.width, 0);
                ctx.scale(-1, 1);
            }

            ctx.drawImage(videoEl, 0, 0, canvasEl.width, canvasEl.height);

            if (statusEl) {
                statusEl.style.display = 'flex';
                statusEl.textContent = 'Mengompresi foto ke kualitas standar tajam...';
            }

            try {
                const compressed = await compressImageToStandard(canvasEl);
                capturedCompressedPhoto = compressed;
                if (previewEl) {
                    previewEl.src = compressed.dataUrl;
                    previewEl.style.display = 'block';
                }
                if (videoEl) {
                    videoEl.style.display = 'none';
                }
                if (btnRetake) {
                    btnRetake.style.display = 'inline-flex';
                }
                if (submitPhotoBtn) {
                    submitPhotoBtn.disabled = false;
                }
                if (statusEl) {
                    statusEl.style.display = 'none';
                }
                stopCameraStream();
            } catch (error) {
                if (statusEl) {
                    statusEl.style.display = 'flex';
                    statusEl.textContent = `Gagal memproses foto: ${error.message}`;
                }
            }
        });
    }

    if (fallbackInput) {
        fallbackInput.addEventListener('change', async (e) => {
            const file = e.target.files && e.target.files[0];
            if (!file) return;

            if (statusEl) {
                statusEl.style.display = 'flex';
                statusEl.textContent = 'Mengompresi foto...';
            }

            try {
                const compressed = await compressImageToStandard(file);
                capturedCompressedPhoto = compressed;
                if (previewEl) {
                    previewEl.src = compressed.dataUrl;
                    previewEl.style.display = 'block';
                }
                if (videoEl) {
                    videoEl.style.display = 'none';
                }
                if (btnRetake) {
                    btnRetake.style.display = 'inline-flex';
                }
                if (submitPhotoBtn) {
                    submitPhotoBtn.disabled = false;
                }
                if (statusEl) {
                    statusEl.style.display = 'none';
                }
            } catch (error) {
                if (statusEl) {
                    statusEl.style.display = 'flex';
                    statusEl.textContent = `Gagal memproses foto: ${error.message}`;
                }
            } finally {
                fallbackInput.value = '';
            }
        });
    }

    if (btnRetake) {
        btnRetake.addEventListener('click', async () => {
            await startCamera(currentFacingMode);
        });
    }

    if (uploadForm) {
        uploadForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            if (!capturedCompressedPhoto) return;

            const senderName = (senderInput?.value || 'Tamu Undangan').trim();
            const captionText = (captionInput?.value || '').trim();
            const photoId = `live-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
            const timestamp = getCurrentDateTime();
            const safeSlug = senderName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'tamu';
            const fileName = `wedding-${safeSlug}-${Date.now()}.jpg`;

            if (submitPhotoBtn) {
                submitPhotoBtn.disabled = true;
                submitPhotoBtn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Mengirim ke Drive & Galeri...';
            }

            const newPhotoItem = {
                id: photoId,
                image: capturedCompressedPhoto.dataUrl,
                sender: senderName,
                caption: captionText,
                cameraMode: currentFacingMode === 'user' ? 'Kamera Depan' : 'Kamera Belakang',
                createdAt: timestamp,
                isLive: true
            };

            // Simpan ke cache lokal agar langsung tampil di galeri undangan
            saveLocalLivePhoto(newPhotoItem);

            // Kirim ke Google Drive & Google Sheets lewat Apps Script
            await uploadLivePhotoToDriveAndSheet({
                id: photoId,
                sender: senderName,
                caption: captionText,
                cameraMode: newPhotoItem.cameraMode,
                createdAt: timestamp,
                base64: capturedCompressedPhoto.base64,
                mimeType: capturedCompressedPhoto.mimeType,
                fileName
            });

            rebuildGalleryItems();
            refreshGalleryView(photoId);

            if (uploadForm) uploadForm.reset();
            if (submitPhotoBtn) {
                submitPhotoBtn.innerHTML = '<i class="bx bx-cloud-upload"></i> Simpan ke Galeri & Drive';
            }

            closeLivePhotoModal();
        });
    }

    // Inisialisasi awal & muat foto remote dari Google Drive/Sheets bila tersedia
    rebuildGalleryItems();
    refreshGalleryView();
    setInterval(autoPlayGallery, 3000);

    fetchRemoteLivePhotos().then((remotePhotos) => {
        if (remotePhotos && remotePhotos.length > 0) {
            const currentId = nextButton.dataset.id;
            rebuildGalleryItems(remotePhotos);
            refreshGalleryView(currentId);
        }
    });
};

function escapeHtml(str = '') {
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}
