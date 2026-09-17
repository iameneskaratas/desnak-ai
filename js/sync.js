/**
 * Desnak AI - Bulut & Yerel Veri Senkronizasyonu (Firebase Realtime DB + LocalStorage)
 */

const LOCAL_STORAGE_KEY = 'desnak_records_v1';
const GEMINI_KEY_STORAGE = 'desnak_gemini_key';
const THEME_KEY_STORAGE = 'desnak_theme_mode';
const CLOUD_ENDPOINT = 'https://leb1919-default-rtdb.firebaseio.com/desnak_store.json';

let isSyncing = false;
let onSyncStateChange = null;

function setSyncListener(callback) {
  onSyncStateChange = callback;
}

function updateSyncUI(status, message) {
  if (typeof onSyncStateChange === 'function') {
    onSyncStateChange({ status, message, time: new Date() });
  }
}

/**
 * Yerel hafızadaki kayıtları getirir
 */
function getStoredRecords() {
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (e) {
    console.error('LocalStorage okuma hatası:', e);
    return [];
  }
}

/**
 * Kayıtları yerel hafızaya kaydeder ve opsiyonel olarak bulutla eşitler
 */
function saveRecordsLocally(records, triggerCloudSync = true) {
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(records));
  } catch (e) {
    console.error('LocalStorage yazma hatası:', e);
  }

  if (triggerCloudSync) {
    syncToCloud(records).catch(() => {});
  }
}

/**
 * Tek bir aracı ekler veya günceller
 */
function saveRecord(record) {
  const records = getStoredRecords();
  const existingIdx = records.findIndex(r => r.id === record.id || (r.plaka && r.plaka.replace(/\s+/g, '') === record.plaka.replace(/\s+/g, '')));

  const now = Date.now();
  const item = {
    ...record,
    id: record.id || ('desnak_' + now + '_' + Math.random().toString(36).substr(2, 6)),
    plaka: (record.plaka || '').toUpperCase().trim(),
    saseNo: (record.saseNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim(),
    aracCinsi: record.aracCinsi || 'Dorse',
    marka: (record.marka || '').toUpperCase().trim(),
    model: (record.model || '').trim(),
    notlar: (record.notlar || '').trim(),
    updatedAt: now,
    createdAt: record.createdAt || now
  };

  if (existingIdx >= 0) {
    records[existingIdx] = { ...records[existingIdx], ...item, updatedAt: now };
  } else {
    records.unshift(item);
  }

  saveRecordsLocally(records, true);
  return item;
}

/**
 * Araç kaydını siler
 */
function deleteRecordById(id) {
  let records = getStoredRecords();
  records = records.filter(r => r.id !== id);
  saveRecordsLocally(records, true);
  return records;
}

/**
 * Firebase Realtime Database'e gönderir
 */
async function syncToCloud(records) {
  if (isSyncing) return;
  isSyncing = true;
  updateSyncUI('syncing', 'Buluta aktarılıyor...');

  try {
    const payload = {
      records: records,
      lastSyncTime: Date.now(),
      version: '1.0.0'
    };

    const res = await fetch(CLOUD_ENDPOINT, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (res.ok) {
      updateSyncUI('success', 'Bulutla eşitlendi');
    } else {
      updateSyncUI('error', 'Bulut sunucu hatası');
    }
  } catch (err) {
    console.warn('Bulut senkronizasyon hatası (çevrimdışı):', err);
    updateSyncUI('offline', 'Çevrimdışı (Yerel kayıt)');
  } finally {
    isSyncing = false;
  }
}

/**
 * Firebase Realtime Database'den çeker ve yerel ile birleştirir
 */
async function syncFromCloud() {
  updateSyncUI('syncing', 'Buluttan alınıyor...');
  try {
    const res = await fetch(CLOUD_ENDPOINT);
    if (!res.ok) throw new Error('Sunucu yanıt vermedi');

    const data = await res.json();
    if (!data || !Array.isArray(data.records)) {
      updateSyncUI('success', 'Bulut boş veya eşit');
      return getStoredRecords();
    }

    const cloudRecords = data.records;
    const localRecords = getStoredRecords();

    // Map ile birleştirme (en son güncellenen kazanır)
    const recordMap = new Map();
    localRecords.forEach(r => recordMap.set(r.id, r));

    cloudRecords.forEach(cr => {
      const lr = recordMap.get(cr.id);
      if (!lr || (cr.updatedAt || 0) >= (lr.updatedAt || 0)) {
        recordMap.set(cr.id, cr);
      }
    });

    const merged = Array.from(recordMap.values());
    // Yeniden eskiye sırala
    merged.sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));

    saveRecordsLocally(merged, false);
    updateSyncUI('success', 'Bulutla eşitlendi');
    return merged;
  } catch (err) {
    console.warn('Buluttan veri çekilemedi (çevrimdışı):', err);
    updateSyncUI('offline', 'Çevrimdışı mod');
    return getStoredRecords();
  }
}

/**
 * Gemini API Key Yönetimi
 */
function getGeminiApiKey() {
  return localStorage.getItem(GEMINI_KEY_STORAGE) || '';
}

function setGeminiApiKey(key) {
  if (!key) {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
  } else {
    localStorage.setItem(GEMINI_KEY_STORAGE, key.trim());
  }
}

/**
 * Excel (CSV) ve JSON Yedekleme
 */
function exportCSV() {
  const records = getStoredRecords();
  if (records.length === 0) {
    alert('Dışa aktarılacak araç kaydı bulunamadı.');
    return;
  }

  const headers = ['Plaka', 'Şase Numarası', 'Araç Cinsi', 'Marka', 'Model', 'Notlar'];
  const rows = records.map(r => [
    `"${r.plaka || ''}"`,
    `"${r.saseNo || ''}"`,
    `"${r.aracCinsi || ''}"`,
    `"${r.marka || ''}"`,
    `"${r.model || ''}"`,
    `"${(r.notlar || '').replace(/"/g, '""')}"`
  ]);

  const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(e => e.join(';'))].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `Desnak_AI_Sase_Listesi_${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportJSONBackup() {
  const records = getStoredRecords();
  const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(records, null, 2));
  const dlAnchorElem = document.createElement('a');
  dlAnchorElem.setAttribute('href', dataStr);
  dlAnchorElem.setAttribute('download', `Desnak_AI_Yedek_${new Date().toISOString().slice(0, 10)}.json`);
  dlAnchorElem.click();
}
