/**
 * Desnak AI - Ruhsat AI Tarayıcı & Doğrulama Modülü
 */

let pendingScanResult = null;
let currentPreviewUrl = null;

function setupAiScanner() {
  const fileInput = document.getElementById('ruhsatFileInput');
  const cameraInput = document.getElementById('ruhsatCameraInput');
  const scanLoadingModal = document.getElementById('scanLoadingModal');
  const verifyModal = document.getElementById('verifyModal');

  if (fileInput) {
    fileInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processRuhsatFile(e.target.files[0]);
      }
    });
  }

  if (cameraInput) {
    cameraInput.addEventListener('change', (e) => {
      if (e.target.files && e.target.files[0]) {
        processRuhsatFile(e.target.files[0]);
      }
    });
  }

  // Doğrulama modalındaki karakter sayacı ve formatlayıcı
  const saseInput = document.getElementById('verifySaseNo');
  const saseCounter = document.getElementById('saseCharCounter');
  if (saseInput && saseCounter) {
    saseInput.addEventListener('input', (e) => {
      let val = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '');
      e.target.value = val;
      saseCounter.textContent = `${val.length}/17`;
      if (val.length === 17) {
        saseCounter.className = 'char-badge valid';
      } else {
        saseCounter.className = 'char-badge invalid';
      }
    });
  }

  // Plaka otomatik büyük harf
  const plakaInput = document.getElementById('verifyPlaka');
  if (plakaInput) {
    plakaInput.addEventListener('input', (e) => {
      e.target.value = e.target.value.toUpperCase();
    });
  }

  // Cins butonları
  document.querySelectorAll('.verify-type-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.verify-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const hiddenType = document.getElementById('verifyAracCinsi');
      if (hiddenType) hiddenType.value = btn.dataset.type;
    });
  });

  // Doğrulama Onayla Butonu
  const btnSaveVerified = document.getElementById('btnSaveVerified');
  if (btnSaveVerified) {
    btnSaveVerified.addEventListener('click', saveVerifiedRecord);
  }

  // Doğrulama İptal Butonu
  const btnCancelVerify = document.getElementById('btnCancelVerify');
  if (btnCancelVerify) {
    btnCancelVerify.addEventListener('click', closeVerifyModal);
  }

  const btnCloseVerifyX = document.getElementById('btnCloseVerifyX');
  if (btnCloseVerifyX) {
    btnCloseVerifyX.addEventListener('click', closeVerifyModal);
  }
}

/**
 * Seçilen PDF veya görsel dosyasını AI servisine gönderir
 */
async function processRuhsatFile(file) {
  if (!file) return;

  const scanLoadingModal = document.getElementById('scanLoadingModal');
  const loadingStatusText = document.getElementById('loadingStatusText');
  const loadingFileName = document.getElementById('loadingFileName');

  if (loadingFileName) loadingFileName.textContent = file.name;
  if (loadingStatusText) loadingStatusText.textContent = 'Belge optimize ediliyor...';
  if (scanLoadingModal) scanLoadingModal.classList.add('active');

  try {
    const isImage = file.type && file.type.startsWith('image/');
    const base64Data = isImage ? await compressAndEncodeImage(file) : await fileToBase64(file);
    const mimeType = isImage ? 'image/jpeg' : (file.type || (file.name.endsWith('.pdf') ? 'application/pdf' : 'image/jpeg'));

    if (loadingStatusText) loadingStatusText.textContent = 'Gemini AI ruhsatı inceliyor...';

    // Dosya önizlemesi
    if (currentPreviewUrl) URL.revokeObjectURL(currentPreviewUrl);
    currentPreviewUrl = URL.createObjectURL(file);

    const apiKey = getGeminiApiKey();

    const response = await fetch('/api/parse-ruhsat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-gemini-key': apiKey
      },
      body: JSON.stringify({
        fileBase64: base64Data,
        mimeType: mimeType,
        fileName: file.name
      })
    });

    const result = await response.json();

    if (scanLoadingModal) scanLoadingModal.classList.remove('active');

    if (result.success && result.data) {
      showToast('AI ruhsatı başarıyla okudu!', 'success');
      openVerifyModal(result.data, file.name, false);
    } else if (result.needApiKey) {
      openApiKeyModal(result.error);
    } else {
      const errorMsg = result.error || 'AI bilgileri okuyamadı';
      showToast(errorMsg, 'warning');
      openVerifyModal({
        plaka: extractPlateFromFileName(file.name),
        saseNo: '',
        aracCinsi: file.name.toUpperCase().includes('DORSE') ? 'Dorse' : 'Çekici',
        marka: '',
        model: ''
      }, file.name, true);
    }

  } catch (err) {
    console.error('Ruhsat tarama hatası:', err);
    if (scanLoadingModal) scanLoadingModal.classList.remove('active');
    showToast('Bağlantı hatası, kontrol formu açılıyor', 'warning');
    openVerifyModal({
      plaka: extractPlateFromFileName(file.name),
      saseNo: '',
      aracCinsi: 'Dorse'
    }, file.name, true);
  } finally {
    // Inputu sıfırla ki aynı dosya tekrar seçilebilsin
    const fileInput = document.getElementById('ruhsatFileInput');
    if (fileInput) fileInput.value = '';
    const cameraInput = document.getElementById('ruhsatCameraInput');
    if (cameraInput) cameraInput.value = '';
  }
}

/**
 * Dosya adından plaka tahmini (örn: "34 CTR 964 RUHSAT.pdf" -> "34 CTR 964")
 */
function extractPlateFromFileName(name) {
  if (!name) return '';
  const match = name.match(/(\d{2}\s*[A-Z]{1,3}\s*\d{2,4})/i);
  return match ? match[0].toUpperCase() : '';
}

/**
 * Doğrulama Modalını Açar
 */
function openVerifyModal(data, fileName, isFallback = false) {
  const modal = document.getElementById('verifyModal');
  if (!modal) return;

  const plakaInput = document.getElementById('verifyPlaka');
  const saseInput = document.getElementById('verifySaseNo');
  const saseCounter = document.getElementById('saseCharCounter');
  const hiddenType = document.getElementById('verifyAracCinsi');
  const markaInput = document.getElementById('verifyMarka');
  const modelInput = document.getElementById('verifyModel');
  const previewBox = document.getElementById('verifyDocBadge');
  const aiBadge = document.getElementById('verifyAiBadge');

  if (plakaInput) plakaInput.value = data.plaka || '';
  if (saseInput) {
    saseInput.value = (data.saseNo || '').toUpperCase();
    if (saseCounter) {
      saseCounter.textContent = `${saseInput.value.length}/17`;
      saseCounter.className = saseInput.value.length === 17 ? 'char-badge valid' : 'char-badge invalid';
    }
  }

  const detectedType = data.aracCinsi || 'Dorse';
  if (hiddenType) hiddenType.value = detectedType;

  document.querySelectorAll('.verify-type-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.type === detectedType);
  });

  if (markaInput) markaInput.value = data.marka || '';
  if (modelInput) modelInput.value = data.model || '';

  if (previewBox) {
    previewBox.textContent = fileName || 'Taranan Ruhsat Belgesi';
  }

  if (aiBadge) {
    if (isFallback) {
      aiBadge.textContent = 'Manuel Düzenleme';
      aiBadge.className = 'ai-status-badge fallback';
    } else {
      aiBadge.textContent = 'AI Otomatik Okundu';
      aiBadge.className = 'ai-status-badge success';
    }
  }

  modal.classList.add('active');
  if (plakaInput && !plakaInput.value) {
    plakaInput.focus();
  } else if (saseInput) {
    saseInput.focus();
  }
}

function closeVerifyModal() {
  const modal = document.getElementById('verifyModal');
  if (modal) modal.classList.remove('active');
}

/**
 * Doğrulanan kaydı kaydeder
 */
function saveVerifiedRecord() {
  const plaka = (document.getElementById('verifyPlaka')?.value || '').toUpperCase().trim();
  const saseNo = (document.getElementById('verifySaseNo')?.value || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
  const aracCinsi = document.getElementById('verifyAracCinsi')?.value || 'Dorse';
  const marka = (document.getElementById('verifyMarka')?.value || '').toUpperCase().trim();
  const model = (document.getElementById('verifyModel')?.value || '').trim();
  const notlar = (document.getElementById('verifyNotlar')?.value || '').trim();

  if (!plaka) {
    alert('Lütfen araç plakasını giriniz.');
    document.getElementById('verifyPlaka')?.focus();
    return;
  }

  if (!saseNo) {
    alert('Lütfen şase numarasını giriniz.');
    document.getElementById('verifySaseNo')?.focus();
    return;
  }

  if (saseNo.length !== 17) {
    if (!confirm(`Şase numarası 17 karakter olmalıdır (şu an ${saseNo.length} karakter). Yine de kaydetmek istiyor musunuz?`)) {
      document.getElementById('verifySaseNo')?.focus();
      return;
    }
  }

  saveRecord({
    plaka,
    saseNo,
    aracCinsi,
    marka,
    model,
    notlar
  });

  closeVerifyModal();
  showToast(`${plaka} başarıyla eklendi!`, 'success');
  if (typeof renderCurrentView === 'function') {
    renderCurrentView();
  }
}

/**
 * Dosyayı Base64'e dönüştürür
 */
function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

/**
 * iPhone kamera ve yüksek çözünürlüklü fotoğrafları max 1600px ve JPEG 0.8 kalitesine sıkıştırır
 */
function compressAndEncodeImage(file) {
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 1600;
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
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(e.target.result);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve('');
    reader.readAsDataURL(file);
  });
}
