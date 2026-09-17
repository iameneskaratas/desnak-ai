/**
 * Desnak AI - Ana Uygulama Kontrolcüsü
 * Minimalist iOS Liquid Glass Kartları, Anlık Kopyalama, Haptic Titreşim & Canlı Arama
 */

let currentFilter = 'all'; // 'all' | 'Çekici' | 'Dorse' | 'Kamyon'
let searchQuery = '';
let recentCopies = [];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

async function initApp() {
  // Service Worker kaydı
  if ('serviceWorker' in navigator) {
    try {
      navigator.serviceWorker.register('./sw.js');
    } catch (e) {
      console.warn('SW register error:', e);
    }
  }

  // Tema yüklemesi
  initTheme();

  // Son kopyalananlar hafızası
  loadRecentCopies();

  // UI Olay Dinleyicileri
  setupSearch();
  setupSegmentedTabs();
  setupModals();
  setupSettingsModal();
  setupAiScanner();

  // Senkronizasyon dinleyicisi
  setSyncListener(handleSyncStateChange);

  // İlk çizim
  renderCurrentView();

  // Arka planda buluttan veri senkronizasyonu
  syncFromCloud().then(() => {
    renderCurrentView();
  });
}

/**
 * Tema Kontrolü (Açık / Duvar Kağıdı / Koyu)
 */
function initTheme() {
  const saved = localStorage.getItem('desnak_theme_mode');
  if (saved === 'wallpaper') {
    document.body.classList.add('theme-wallpaper');
  }

  const btnToggle = document.getElementById('btnThemeToggle');
  if (btnToggle) {
    btnToggle.addEventListener('click', () => {
      document.body.classList.toggle('theme-wallpaper');
      const isWall = document.body.classList.contains('theme-wallpaper');
      localStorage.setItem('desnak_theme_mode', isWall ? 'wallpaper' : 'light');
      hapticTap(10);
      showToast(isWall ? 'Duvar Kağıdı Teması Aktif' : 'Aydınlık Tema Aktif', 'info');
    });
  }
}

/**
 * Bulut Senkronizasyon Durumu UI Güncellemesi
 */
function handleSyncStateChange({ status, message }) {
  const dot = document.getElementById('syncStatusDot');
  const text = document.getElementById('syncStatusText');

  if (dot) {
    dot.className = 'sync-dot ' + status;
  }
  if (text) {
    text.textContent = message;
  }
}

/**
 * Hızlı Arama & Temizleme
 */
function setupSearch() {
  const input = document.getElementById('searchInput');
  const clearBtn = document.getElementById('clearSearchBtn');

  if (input) {
    input.addEventListener('input', (e) => {
      searchQuery = e.target.value.trim();
      if (clearBtn) clearBtn.style.display = searchQuery ? 'flex' : 'none';
      renderCurrentView();
    });
  }

  if (clearBtn && input) {
    clearBtn.addEventListener('click', () => {
      input.value = '';
      searchQuery = '';
      clearBtn.style.display = 'none';
      input.focus();
      hapticTap(8);
      renderCurrentView();
    });
  }
}

/**
 * iOS Liquid Glass Segmented Control (Tümü / Çekici / Dorse)
 */
function setupSegmentedTabs() {
  const track = document.querySelector('.leb-segmented-track');
  const slider = document.getElementById('segSlider');
  const buttons = document.querySelectorAll('.leb-seg-btn');
  if (!track || !slider || buttons.length === 0) return;

  function updateSliderPosition(activeBtn) {
    const idx = parseInt(activeBtn.dataset.index, 10) || 0;
    const count = buttons.length;
    slider.style.width = `calc(${100 / count}% - 6px)`;
    slider.style.transform = `translateX(${idx * 100}%)`;
  }

  buttons.forEach((btn, index) => {
    btn.dataset.index = index;
    btn.addEventListener('click', () => {
      buttons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      currentFilter = btn.dataset.filter || 'all';
      updateSliderPosition(btn);
      hapticTap(12);
      renderCurrentView();
    });
  });

  const initialActive = document.querySelector('.leb-seg-btn.active') || buttons[0];
  updateSliderPosition(initialActive);
}

/**
 * Ana Liste Çizimi (Render Cards)
 */
function renderCurrentView() {
  const container = document.getElementById('cardsContainer');
  const emptyState = document.getElementById('emptyState');
  const countBadge = document.getElementById('totalCountBadge');
  if (!container) return;

  let records = getStoredRecords();

  // Kategori Filtresi
  if (currentFilter !== 'all') {
    records = records.filter(r => (r.aracCinsi || '').toLowerCase() === currentFilter.toLowerCase());
  }

  // Arama Filtresi
  if (searchQuery) {
    const q = searchQuery.toUpperCase().replace(/\s+/g, '');
    records = records.filter(r => {
      const plakaClean = (r.plaka || '').toUpperCase().replace(/\s+/g, '');
      const saseClean = (r.saseNo || '').toUpperCase();
      const markaClean = (r.marka || '').toUpperCase();
      const modelClean = (r.model || '').toUpperCase();
      return plakaClean.includes(q) || saseClean.includes(q) || markaClean.includes(q) || modelClean.includes(q);
    });
  }

  // Sayacı güncelle
  if (countBadge) countBadge.textContent = records.length;

  // Boş durum
  if (records.length === 0) {
    container.innerHTML = '';
    if (emptyState) emptyState.style.display = 'flex';
    return;
  }

  if (emptyState) emptyState.style.display = 'none';

  // Kartları oluştur
  container.innerHTML = records.map(record => createCardHTML(record)).join('');

  // Kopyalama & Aksiyon Olaylarını Bağla
  attachCardEvents(container);
  
  // Son kopyalananlar şeridini güncelle
  renderRecentCopiesTray();
}

/**
 * Zarif Apple Squircle Kart Şablonu
 */
function createCardHTML(r) {
  const typeClass = (r.aracCinsi || 'dorse').toLowerCase();
  const brandInfo = [r.marka, r.model].filter(Boolean).join(' ');

  return `
    <article class="sase-card" data-id="${r.id}" data-plaka="${escapeHTML(r.plaka)}" data-sase="${escapeHTML(r.saseNo)}">
      <!-- Üst Şerit: Plaka Rozeti ve Araç Tipi -->
      <div class="card-header-row">
        <div class="plate-badge" title="Plakayı kopyalamak için dokunun">
          <span class="plate-country">TR</span>
          <span class="plate-number">${escapeHTML(r.plaka || 'PLAKA YOK')}</span>
        </div>
        
        <div class="header-badges-right">
          <span class="type-pill ${typeClass}">${escapeHTML(r.aracCinsi || 'Dorse')}</span>
          <button class="btn-card-menu" data-action="menu" aria-label="Araç İşlemleri">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2">
              <circle cx="12" cy="12" r="1"></circle>
              <circle cx="12" cy="5" r="1"></circle>
              <circle cx="12" cy="19" r="1"></circle>
            </svg>
          </button>
        </div>
      </div>

      <!-- Orta Alan: 17 Haneli Şase Numarası ve Kopyalama Butonu -->
      <div class="chassis-copy-box" data-action="copy-chassis" title="Şaseyi kopyala">
        <div class="chassis-meta">
          <span class="chassis-label">ŞASE NO (VIN)</span>
          <span class="chassis-val">${formatChassisMonospace(r.saseNo)}</span>
        </div>
        
        <button class="copy-action-btn" data-action="copy-chassis" aria-label="Şaseyi Kopyala">
          <svg class="icon-copy" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect>
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path>
          </svg>
          <svg class="icon-check" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#10B981" stroke-width="2.8" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="20 6 9 17 4 12"></polyline>
          </svg>
        </button>
      </div>

      <!-- Alt Satır: Marka/Model veya Notlar (Varsa) -->
      ${brandInfo || r.notlar ? `
        <div class="card-footer-row">
          ${brandInfo ? `<span class="brand-subtext">${escapeHTML(brandInfo)}</span>` : ''}
          ${r.notlar ? `<span class="note-subtext">${escapeHTML(r.notlar)}</span>` : ''}
        </div>
      ` : ''}
    </article>
  `;
}

/**
 * 17 haneli şase numarasını okunaklı formatlar
 */
function formatChassisMonospace(sase) {
  if (!sase) return '<span class="empty-sase">Şase girilmemiş</span>';
  return escapeHTML(sase.toUpperCase());
}

/**
 * Kart Olaylarını Bağlar (Tek Dokunuşta Kopyalama)
 */
function attachCardEvents(container) {
  container.querySelectorAll('.sase-card').forEach(card => {
    const saseNo = card.dataset.sase;
    const plaka = card.dataset.plaka;
    const id = card.dataset.id;

    // Şase kutusu veya kopyala butonuna tıklama -> ŞASE KOPYALA
    card.querySelectorAll('[data-action="copy-chassis"]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!saseNo) return;
        copyToClipboard(saseNo, `${plaka} Şasesi Kopyalandı`);
        recordRecentCopy(plaka, saseNo);

        // Kopyalama ikonunda geçici tik animasyonu
        const btn = card.querySelector('.copy-action-btn');
        if (btn) {
          btn.classList.add('copied');
          setTimeout(() => btn.classList.remove('copied'), 1800);
        }
      });
    });

    // Plaka rozetine tıklama -> PLAKA KOPYALA
    const plateBadge = card.querySelector('.plate-badge');
    if (plateBadge) {
      plateBadge.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!plaka) return;
        copyToClipboard(plaka, `${plaka} Plakası Kopyalandı`);
        hapticTap(15);
      });
    }

    // Menü butonu -> Düzenle / Sil
    const menuBtn = card.querySelector('[data-action="menu"]');
    if (menuBtn) {
      menuBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        openCardActionMenu(id, plaka, saseNo);
      });
    }
  });
}

/**
 * Panoya Kopyalama ve Bildirim
 */
function copyToClipboard(text, message) {
  if (!text) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(message, 'success');
      hapticTap(20);
    }).catch(() => fallbackCopy(text, message));
  } else {
    fallbackCopy(text, message);
  }
}

function fallbackCopy(text, message) {
  const tempInput = document.createElement('textarea');
  tempInput.value = text;
  tempInput.style.position = 'fixed';
  tempInput.style.opacity = '0';
  document.body.appendChild(tempInput);
  tempInput.focus();
  tempInput.select();
  try {
    document.execCommand('copy');
    showToast(message, 'success');
    hapticTap(20);
  } catch (e) {
    showToast('Kopyalama başarısız oldu', 'error');
  }
  document.body.removeChild(tempInput);
}

/**
 * Haptic Vibration (Titreşim)
 */
function hapticTap(duration = 15) {
  if (navigator.vibrate) {
    try {
      navigator.vibrate(duration);
    } catch (e) {}
  }
}

/**
 * Dynamic Island / Floating Toast Bildirimi
 */
let toastTimeout = null;
function showToast(text, type = 'success') {
  const toast = document.getElementById('lebToast');
  const toastText = document.getElementById('toastText');
  if (!toast || !toastText) return;

  toastText.textContent = text;
  toast.className = `leb-toast active toast-${type}`;

  if (toastTimeout) clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => {
    toast.classList.remove('active');
  }, 2200);
}

/**
 * Son Kopyalananlar (Quick Access Tray)
 */
function loadRecentCopies() {
  try {
    const raw = localStorage.getItem('desnak_recent_copies');
    recentCopies = raw ? JSON.parse(raw) : [];
  } catch (e) {
    recentCopies = [];
  }
}

function recordRecentCopy(plaka, saseNo) {
  if (!plaka || !saseNo) return;
  recentCopies = recentCopies.filter(c => c.plaka !== plaka);
  recentCopies.unshift({ plaka, saseNo, time: Date.now() });
  if (recentCopies.length > 5) recentCopies = recentCopies.slice(0, 5);
  try {
    localStorage.setItem('desnak_recent_copies', JSON.stringify(recentCopies));
  } catch (e) {}
  renderRecentCopiesTray();
}

function renderRecentCopiesTray() {
  const tray = document.getElementById('recentCopiesTray');
  const list = document.getElementById('recentCopiesList');
  if (!tray || !list) return;

  if (recentCopies.length === 0) {
    tray.style.display = 'none';
    return;
  }

  tray.style.display = 'flex';
  list.innerHTML = recentCopies.map(item => `
    <button class="recent-copy-chip" data-plaka="${escapeHTML(item.plaka)}" data-sase="${escapeHTML(item.saseNo)}">
      <span class="chip-plate">${escapeHTML(item.plaka)}</span>
      <span class="chip-icon">⎘</span>
    </button>
  `).join('');

  list.querySelectorAll('.recent-copy-chip').forEach(btn => {
    btn.addEventListener('click', () => {
      const s = btn.dataset.sase;
      const p = btn.dataset.plaka;
      copyToClipboard(s, `${p} Şasesi Kopyalandı`);
    });
  });
}

/**
 * Kart İşlem Menüsü (Düzenle / Sil)
 */
function openCardActionMenu(id, plaka, saseNo) {
  const choice = confirm(`"${plaka}" kaydı için işlem seçin:\n\n[Tamam] = Kaydı Sil\n[İptal] = Kapat`);
  if (choice) {
    deleteRecordById(id);
    showToast(`${plaka} silindi`, 'info');
    hapticTap(25);
    renderCurrentView();
  }
}

/**
 * Modal Kurulumları (Manuel Ekle, Kamera/PDF Tetikleyici)
 */
function setupModals() {
  // Manuel Ekleme Butonu
  const btnManualAdd = document.getElementById('btnManualAdd');
  if (btnManualAdd) {
    btnManualAdd.addEventListener('click', () => {
      openVerifyModal({
        plaka: '',
        saseNo: '',
        aracCinsi: 'Dorse',
        marka: '',
        model: ''
      }, 'Manuel Araç Girişi', true);
      hapticTap(15);
    });
  }

  // Ruhsat PDF Seç Tetikleyici
  const btnUploadDoc = document.getElementById('btnUploadDoc');
  const fileInput = document.getElementById('ruhsatFileInput');
  if (btnUploadDoc && fileInput) {
    btnUploadDoc.addEventListener('click', () => {
      fileInput.click();
      hapticTap(15);
    });
  }
}

/**
 * Ayarlar Modalı (Gemini API Key, Yedekleme)
 */
function setupSettingsModal() {
  const modal = document.getElementById('settingsModal');
  const btnOpen = document.getElementById('btnOpenSettings');
  const btnClose = document.getElementById('btnCloseSettings');
  const apiKeyInput = document.getElementById('geminiApiKeyInput');
  const btnSaveKey = document.getElementById('btnSaveApiKey');
  const btnExportCsv = document.getElementById('btnExportCsv');
  const btnExportJson = document.getElementById('btnExportJson');

  if (btnOpen && modal) {
    btnOpen.addEventListener('click', () => {
      if (apiKeyInput) apiKeyInput.value = getGeminiApiKey();
      modal.classList.add('active');
      hapticTap(10);
    });
  }

  if (btnClose && modal) {
    btnClose.addEventListener('click', () => {
      modal.classList.remove('active');
    });
  }

  if (btnSaveKey && apiKeyInput) {
    btnSaveKey.addEventListener('click', () => {
      setGeminiApiKey(apiKeyInput.value);
      showToast('API Anahtarı kaydedildi!', 'success');
      hapticTap(15);
      if (modal) modal.classList.remove('active');
    });
  }

  if (btnExportCsv) {
    btnExportCsv.addEventListener('click', () => {
      exportCSV();
      hapticTap(10);
    });
  }

  if (btnExportJson) {
    btnExportJson.addEventListener('click', () => {
      exportJSONBackup();
      hapticTap(10);
    });
  }
}

function openApiKeyModal(errorMessage) {
  const modal = document.getElementById('settingsModal');
  if (modal) {
    modal.classList.add('active');
    showToast(errorMessage || 'Lütfen Gemini API anahtarınızı girin', 'warning');
  }
}

function escapeHTML(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
