import { data } from "../assets/data/data.js";
import { fetchCombinedGalleryPhotos, liveCamera } from "./liveCamera.js";

export const galeri = () => {
    const galeriElement = document.querySelector('.galeri');
    if (!galeriElement) return;

    const showAllContainer = galeriElement.querySelector('div:nth-of-type(2)');
    const [_, figureElement, paginationElement, prevButton, nextButton, showAllButton] = galeriElement.children[0].children;
    const [__, showAllBox, closeButton] = showAllContainer.children;

    let galleryItems = (data.galeri || []).map((item, idx) => ({
        id: item.id || idx + 1,
        image: item.image,
        guestName: '',
        caption: '',
        isLive: false
    }));

    let currentIndex = 0;
    let autoPlayTimer = null;

    const renderSlideImage = (item) => {
        if (!item) return;
        const badgeHtml = item.isLive
            ? `<span class="live-photo-badge"><i class='bx bxs-camera'></i> ${item.guestName || 'Tamu'}</span>`
            : '';
        figureElement.innerHTML = `
            <div class="gallery-slide-frame">
                <img src="${item.image}" alt="${item.caption || 'galeri image'}" data-index="${currentIndex}">
                ${badgeHtml}
            </div>`;
    };

    const syncPaginationActive = () => {
        paginationElement.querySelectorAll('li').forEach((li, idx) => {
            li.classList.toggle('active', idx === currentIndex);
        });
    };

    const updateNavigationState = () => {
        nextButton.dataset.id = String(currentIndex + 1);
        prevButton.dataset.id = String(currentIndex + 1);
    };

    const showIndex = (index) => {
        if (!galleryItems.length) return;
        const total = galleryItems.length;
        currentIndex = ((index % total) + total) % total;
        renderSlideImage(galleryItems[currentIndex]);
        syncPaginationActive();
        updateNavigationState();
    };

    const rebuildPagination = () => {
        paginationElement.innerHTML = '';
        galleryItems.forEach((item, index) => {
            const li = document.createElement('li');
            li.dataset.index = String(index);
            if (index === currentIndex) li.classList.add('active');
            li.addEventListener('click', () => {
                showIndex(index);
            });
            paginationElement.appendChild(li);
        });
    };

    const renderFullGalleryGrid = () => {
        showAllBox.innerHTML = galleryItems.map((item) => {
            const captionMeta = item.isLive
                ? `<div class="all-gallery-meta">
                        <strong><i class='bx bxs-camera'></i> ${item.guestName || 'Tamu Undangan'}</strong>
                        ${item.caption ? `<span>${item.caption}</span>` : ''}
                   </div>`
                : '';
            return `
                <div class="all-gallery-card">
                    <img src="${item.image}" alt="${item.caption || 'image galeri'}">
                    ${captionMeta}
                </div>`;
        }).join('');
    };

    const refreshGallery = async (focusLatestLive = false) => {
        const combined = await fetchCombinedGalleryPhotos();
        if (combined && combined.length > 0) {
            galleryItems = combined;
            rebuildPagination();
            showIndex(focusLatestLive ? 0 : Math.min(currentIndex, galleryItems.length - 1));
            if (showAllContainer.classList.contains('active')) {
                renderFullGalleryGrid();
            }
        }
    };

    const autoPlayGallery = () => {
        if (!galleryItems.length) return;
        showIndex(currentIndex + 1);
    };

    nextButton.addEventListener('click', () => {
        showIndex(currentIndex + 1);
    });

    prevButton.addEventListener('click', () => {
        showIndex(currentIndex - 1);
    });

    showAllButton.addEventListener('click', () => {
        renderFullGalleryGrid();
        showAllContainer.classList.add('active');
    });

    closeButton.addEventListener('click', () => {
        showAllBox.innerHTML = '';
        showAllContainer.classList.remove('active');
    });

    rebuildPagination();
    showIndex(0);

    if (autoPlayTimer) clearInterval(autoPlayTimer);
    autoPlayTimer = setInterval(autoPlayGallery, 3500);

    // Muat foto live dari Google Drive / Spreadsheet saat halaman dibuka
    refreshGallery(false);

    // Hubungkan tombol & modal kamera live sharing
    liveCamera(async (newPhotoItem) => {
        if (newPhotoItem && newPhotoItem.image) {
            const exists = galleryItems.some((item) => item.id === newPhotoItem.id);
            if (!exists) {
                galleryItems = [newPhotoItem, ...galleryItems];
                currentIndex = 0;
                rebuildPagination();
                showIndex(0);
                if (showAllContainer.classList.contains('active')) {
                    renderFullGalleryGrid();
                }
            }
        }
        await refreshGallery(Boolean(newPhotoItem));
    });
};
