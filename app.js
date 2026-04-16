const API_BASE = 'https://api.cloud-platform.pro/combophoto';
const MAX_PHOTOS = 4;

const uploadZone = document.getElementById('uploadZone');
const fileInput = document.getElementById('fileInput');
const photosGrid = document.getElementById('photosGrid');
const comboBtn = document.getElementById('comboBtn');
const resultSection = document.getElementById('resultSection');
const resultImage = document.getElementById('resultImage');
const saveBtn = document.getElementById('saveBtn');
const shareBtn = document.getElementById('shareBtn');
const themeToggle = document.getElementById('themeToggle');
const errorToast = document.getElementById('errorToast');
const photoCounter = document.getElementById('photoCounter');
const lightbox = document.getElementById('lightbox');
const lightboxImg = document.getElementById('lightboxImg');

let photos = [];
let resultUrl = '';

function updateCounter() {
    photoCounter.textContent = photos.length > 0 ? `(${photos.length}/${MAX_PHOTOS})` : '';
}

function updateComboBtn() {
    comboBtn.disabled = photos.length < 2;
}

function renderPhotos() {
    photosGrid.innerHTML = '';
    photos.forEach((photo, index) => {
        const card = document.createElement('div');
        card.className = 'photo-card';
        card.innerHTML = `
            <img src="${photo.previewUrl}" alt="Photo ${index + 1}">
            <button class="remove-btn" data-index="${index}" title="Remove">&times;</button>
        `;
        card.querySelector('img').addEventListener('click', () => openLightbox(photo.previewUrl));
        card.querySelector('.remove-btn').addEventListener('click', (e) => {
            e.stopPropagation();
            removePhoto(index);
        });
        photosGrid.appendChild(card);
    });
    updateCounter();
    updateComboBtn();
}

function removePhoto(index) {
    photos.splice(index, 1);
    renderPhotos();
}

function addFiles(files) {
    const remaining = MAX_PHOTOS - photos.length;
    if (remaining <= 0) {
        showError('Maximum 4 photos allowed');
        return;
    }
    const toAdd = Array.from(files).slice(0, remaining);
    for (const file of toAdd) {
        if (!file.type.startsWith('image/')) continue;
        if (photos.length >= MAX_PHOTOS) break;
        const previewUrl = URL.createObjectURL(file);
        photos.push({ file, previewUrl, serverUrl: null });
    }
    renderPhotos();
}

uploadZone.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', () => {
    addFiles(fileInput.files);
    fileInput.value = '';
});

uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
});

uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
});

uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    addFiles(e.dataTransfer.files);
});

function showError(msg) {
    errorToast.textContent = msg;
    errorToast.classList.add('show');
    setTimeout(() => errorToast.classList.remove('show'), 3000);
}

async function uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${API_BASE}/files/upload`, {
        method: 'POST',
        body: formData
    });
    if (!res.ok) throw new Error('Upload failed');
    const data = await res.json();
    return data.url;
}

comboBtn.addEventListener('click', async () => {
    if (photos.length < 2) return;

    const originalHTML = comboBtn.innerHTML;
    comboBtn.disabled = true;
    comboBtn.innerHTML = '<div class="spinner"></div> Combining...';
    resultSection.classList.remove('visible');

    try {
        const uploadedUrls = [];
        for (const photo of photos) {
            if (photo.serverUrl) {
                uploadedUrls.push(photo.serverUrl);
            } else {
                const url = await uploadFile(photo.file);
                photo.serverUrl = url;
                uploadedUrls.push(url);
            }
        }

        const mergeRes = await fetch(`${API_BASE}/merge/run`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ImageUrls: uploadedUrls })
        });

        if (!mergeRes.ok) throw new Error('Merge failed');
        const resultText = await mergeRes.text();
        let finalUrl = resultText;
        try {
            const parsed = JSON.parse(resultText);
            finalUrl = typeof parsed === 'string' ? parsed : parsed.url || parsed.Url || parsed.resultUrl || resultText;
        } catch {}

        resultUrl = finalUrl;
        resultImage.src = resultUrl;
        resultImage.onload = () => {
            resultSection.classList.add('visible');
            resultSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        };
    } catch (err) {
        showError(err.message || 'Something went wrong');
    } finally {
        comboBtn.innerHTML = originalHTML;
        updateComboBtn();
    }
});

saveBtn.addEventListener('click', async () => {
    if (!resultUrl) return;
    try {
        const response = await fetch(resultUrl);
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'combophoto-result.png';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    } catch {
        window.open(resultUrl, '_blank');
    }
});

shareBtn.addEventListener('click', async () => {
    if (!resultUrl) return;
    if (navigator.share) {
        try {
            await navigator.share({
                title: 'Combophoto Result',
                url: resultUrl
            });
        } catch {}
    } else {
        try {
            await navigator.clipboard.writeText(resultUrl);
            const btn = shareBtn;
            const orig = btn.innerHTML;
            btn.innerHTML = '<span class="btn-icon">&#10003;</span> Copied!';
            setTimeout(() => { btn.innerHTML = orig; }, 2000);
        } catch {
            showError('Copy not supported in this browser');
        }
    }
});

function openLightbox(src) {
    lightboxImg.src = src;
    lightbox.classList.add('open');
}

lightbox.addEventListener('click', () => {
    lightbox.classList.remove('open');
});

document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightbox.classList.contains('open')) {
        lightbox.classList.remove('open');
    }
});

function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    themeToggle.innerHTML = theme === 'dark' ? '&#9788;' : '&#9790;';
    localStorage.setItem('combophoto-theme', theme);
}

themeToggle.addEventListener('click', () => {
    const current = document.documentElement.getAttribute('data-theme');
    applyTheme(current === 'dark' ? 'light' : 'dark');
});

(function initTheme() {
    const saved = localStorage.getItem('combophoto-theme');
    if (saved) {
        applyTheme(saved);
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        applyTheme('dark');
    }
})();
