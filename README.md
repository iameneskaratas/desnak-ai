# Desnak AI 🚛 ⚡

> **Lojistik Plaka & Şase No (VIN) Hızlı Arama & Tek Dokunuşla Kopyalama PWA Asistanı**

---

## 🌟 Proje Özeti
**Desnak AI**, lojistik operasyonlarında küçük telefon ekranlarında yaşanan zorlukları ortadan kaldırmak için tasarlanmış, **iOS Liquid Glass** estetiğine sahip modern bir web / PWA uygulamasıdır. 

Taranmış araç ruhsatı PDF'lerinden ve fotoğraflarından **Google Gemini AI Vision** ile 17 haneli şase numarasını (VIN), araç plakasını, araç cinsini ve modelini saniyeler içinde çeker; operatörün tek bir dokunuşla şase numarasını panoya kopyalamasını sağlar.

---

## 🚀 Öne Çıkan Özellikler

1. **AI Destekli Ruhsat Okuma (Gemini Vision API)**
   - Dorse ve çekici ruhsatı PDF veya fotoğraflarını seçtiğinizde, Gemini Vision modeli `(A) Plaka`, `(E) Şase No`, `(D.5) Araç Cinsi`, `(D.1) Marka` alanlarını otomatik ayrıştırır.
   - Doğrulama ekranında 17/17 karakter sayacıyla operatör gerekirse anında müdahale edebilir.

2. **Ultra Ergonomik Kart Tasarımı (Zero Eye Strain)**
   - Apple standartlarında squircle kartlar.
   - Şase kutusuna veya kopyalama butonuna tek dokunuş:
     - 17 haneli VIN panoya kopyalanır.
     - Telefon haptic titreşimi (`navigator.vibrate`) tetiklenir.
     - iOS Dynamic Island tarzı yüzen bildirim çıkar.
     - Kopyalama ikonunda yeşil tik animasyonu belirir.
   - TR standartlarında plaka rozetine dokunulduğunda plaka kopyalanır.

3. **Son Kopyalananlar (Quick Access Tray)**
   - En son kopyaladığınız 5 araç üst kısımda çip olarak listelenir, tekrar arama yapmadan anında kopyalanabilir.

4. **iOS 26 Liquid Glass Segmented Dock**
   - Alt kısımda akışkan sıvı cam (Liquid Glass) filtre barı: `Tümü`, `Çekici`, `Dorse`, `Kamyon`.

5. **Gerçek Zamanlı Bulut Senkronizasyonu & Çevrimdışı Çalışma**
   - Firebase Realtime Database REST API (`desnak_store.json`) ile telefon ve bilgisayar arasında anlık senkronize çalışır.
   - Çevrimdışı (offline) modda LocalStorage kullanılır; internet geldiğinde otomatik eşitlenir.
   - Service Worker ile PWA olarak ana ekrana eklenebilir.

6. **Yedekleme & Dışa Aktarma**
   - Tek tıkla Excel uyumlu Türkçe CSV veya JSON yedeği alabilme.

---

## 🛠️ Kurulum & Çalıştırma

### Yerel Geliştirme (Local):
```bash
# Bağımlılık gerektirmez (saf modern web mimarisi)
# İsteğe bağlı olarak herhangi bir HTTP sunucu ile çalıştırabilirsiniz:
npx serve .
# veya
python -m http.server 3000
```

### Vercel Dağıtımı & Ortam Değişkeni:
1. Projeyi GitHub reponuza gönderin:
   ```bash
   git init
   git add -A
   git commit -m "feat: Desnak AI initial release"
   git branch -M main
   git remote add origin https://github.com/<KULLANICI_ADI>/desnak-ai.git
   git push -u origin main
   ```
2. **Vercel** üzerinden projeyi bağlayın (`Import Git Repository`).
3. Vercel Dashboard -> **Settings** -> **Environment Variables** bölümüne:
   - `GEMINI_API_KEY` = `<Google AI Studio API Key>`
   ekleyin.
4. Veya uygulama içindeki **Ayarlar (Dişli çark)** simgesine tıklayarak telefonunuzdan API anahtarınızı doğrudan kaydedebilirsiniz.

---

## 📱 Dosya Mimarisi
```
Desnak AI/
├── api/
│   └── parse-ruhsat.js       # Vercel Serverless Function (Gemini Vision API)
├── css/
│   └── app.css               # iOS Liquid Glass UI Design System
├── icons/
│   ├── header-logo.svg       # Vektörel AI & VIN logosu
│   ├── icon.svg              # Yüksek çözünürlüklü App ikonu
│   └── wallpaper.jpg         # iOS Duvar Kağıdı teması
├── js/
│   ├── ai-parser.js          # Ruhsat OCR, PDF Base64 & Doğrulama modalı
│   ├── app.js                # Arama, filtreleme, 1-tap kopyalama, haptic
│   └── sync.js               # Firebase Realtime DB + LocalStorage senkronizasyonu
├── index.html                # Ana PWA arayüzü
├── manifest.webmanifest      # PWA ayarları
├── package.json              # Proje meta verileri
├── sw.js                     # Offline-first Service Worker
└── vercel.json               # Vercel Serverless & Header yapılandırması
```
