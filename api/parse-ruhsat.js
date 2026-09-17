// Desnak AI - Serverless Function: Ruhsat PDF / Görsel AI Ayrıştırma
// Google Gemini Vision API Entegrasyonu

module.exports = async function handler(req, res) {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Credentials', true);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version, x-gemini-key'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, error: 'Yalnızca POST istekleri kabul edilir.' });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try { body = JSON.parse(body); } catch(e) {}
    }

    const { fileBase64, mimeType, apiKey: bodyKey } = body || {};

    if (!fileBase64) {
      return res.status(400).json({ success: false, error: 'Dosya verisi (base64) eksik.' });
    }

    const cleanMime = (mimeType || 'application/pdf').toLowerCase();
    const cleanBase64 = fileBase64.replace(/^data:.*?;base64,/, '').trim();

    // API Key Önceliği: 1. Header, 2. Body, 3. Vercel Environment Variable
    const apiKey = req.headers['x-gemini-key'] || bodyKey || process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(200).json({
        success: false,
        needApiKey: true,
        error: 'Gemini API anahtarı bulunamadı. Lütfen Ayarlar bölümünden API anahtarınızı girin veya Vercel panelinde GEMINI_API_KEY ekleyin.'
      });
    }

    const promptText = `Sen Türkiye araç tescil belgelerini (Araç Ruhsatı) hatasız okuyan uzman bir yapay zekasın.
Eklenen belgeyi (PDF veya fotoğraf) dikkatlice incele ve resmi alanları oku:
1. Plaka: (A) alanındaki araç tescil plakası. Büyük harflerle ve standart boşluklarla yaz (Örn: "34 CTR 964").
2. Şase Numarası (VIN): (E) alanındaki 17 karakterli araç şase numarası. Boşluksuz, tamamı büyük harf/rakam olmalı (Örn: "WMA06XZZ5MP123456").
3. Araç Cinsi: (D.5) alanındaki cins. Bunu şu seçeneklerden birine sınıflandır: "Çekici", "Dorse", "Kamyon", "Diğer" (Örn: YARI RÖMORK ise "Dorse", ÇEKİCİ ise "Çekici").
4. Marka: (D.1) alanındaki marka (Örn: "KRONE", "MERCEDES-BENZ", "KÖGEL", "SCANIA").
5. Model / Ticari Adı: (D.3) alanındaki model bilgisi.
6. Model Yılı: Varsa 4 haneli model yılı.

Yalnızca aşağıdaki JSON şemasına uygun saf JSON çıktısı ver, markdown imi veya başka hiçbir metin ekleme:
{
  "plaka": "string",
  "saseNo": "string",
  "aracCinsi": "Çekici | Dorse | Kamyon | Diğer",
  "marka": "string",
  "model": "string",
  "modelYili": "string"
}`;

    // Gemini 2.0 Flash ve Fallback 1.5 Flash
    const models = ['gemini-2.0-flash', 'gemini-1.5-flash'];
    let errors = [];
    let geminiResponse = null;

    // Eğer debug amaçlı model listeleme istenirse
    if (body && body.action === 'list-models') {
      const listUrl = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
      const listRes = await fetch(listUrl);
      const listData = await listRes.json();
      return res.status(200).json({ success: true, models: listData });
    }

    // Öncelikli modeller
    const candidateModels = [
      'gemini-2.0-flash',
      'gemini-2.0-flash-001',
      'gemini-1.5-flash',
      'gemini-1.5-flash-latest',
      'gemini-1.5-pro',
      'gemini-pro'
    ];

    // Önce bilinen modelleri dene
    for (const modelName of candidateModels) {
      for (const apiVersion of ['v1beta', 'v1']) {
        try {
          const url = `https://generativelanguage.googleapis.com/${apiVersion}/models/${modelName}:generateContent?key=${apiKey}`;
          const response = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    {
                      inline_data: {
                        mime_type: cleanMime,
                        data: cleanBase64
                      }
                    },
                    {
                      text: promptText
                    }
                  ]
                }
              ],
              generationConfig: {
                temperature: 0.1
              }
            })
          });

          if (response.ok) {
            geminiResponse = await response.json();
            break;
          } else {
            const errData = await response.text();
            errors.push(`${apiVersion}/${modelName} (${response.status}): ${errData.slice(0, 150)}`);
          }
        } catch (err) {
          errors.push(`${apiVersion}/${modelName}: ${err.message}`);
        }
      }
      if (geminiResponse) break;
    }

    // Eğer hala bulunamadıysa hesaba ait modelleri otomatik listele ve çalışan birini seç
    if (!geminiResponse) {
      try {
        const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
        if (listRes.ok) {
          const listJson = await listRes.json();
          const available = (listJson.models || [])
            .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
            .map(m => m.name.replace(/^models\//, ''));
          
          for (const autoModel of available) {
            try {
              const url = `https://generativelanguage.googleapis.com/v1beta/models/${autoModel}:generateContent?key=${apiKey}`;
              const resp = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  contents: [{ parts: [{ inline_data: { mime_type: cleanMime, data: cleanBase64 } }, { text: promptText }] }],
                  generationConfig: { temperature: 0.1 }
                })
              });
              if (resp.ok) {
                geminiResponse = await resp.json();
                break;
              }
            } catch(e) {}
          }
        }
      } catch (listErr) {
        errors.push(`Model listeleme hatası: ${listErr.message}`);
      }
    }

    if (!geminiResponse) {
      return res.status(500).json({
        success: false,
        error: `AI analizi tamamlanamadı. Hatalar: ${errors.join(' | ')}`
      });
    }

    // Cevabı ayrıştır
    const candidates = geminiResponse.candidates;
    if (!candidates || !candidates[0] || !candidates[0].content || !candidates[0].content.parts) {
      return res.status(500).json({ success: false, error: 'AI boş yanıt döndürdü.' });
    }

    const rawText = candidates[0].content.parts[0].text.trim();
    let parsedData = {};
    try {
      // JSON temizleme (olası markdown backtick temizliği)
      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/, '').replace(/```$/s, '').trim();
      parsedData = JSON.parse(cleanJson);
    } catch (e) {
      return res.status(500).json({ success: false, error: 'AI çıktısı JSON olarak okunamadı: ' + rawText });
    }

    // Standartlaştırma
    let plaka = (parsedData.plaka || '').toUpperCase().trim();
    let saseNo = (parsedData.saseNo || '').toUpperCase().replace(/[^A-Z0-9]/g, '').trim();
    let aracCinsi = parsedData.aracCinsi || 'Dorse';

    if (/çeki|tractor|çekici/i.test(aracCinsi)) aracCinsi = 'Çekici';
    else if (/römork|dorse|semi/i.test(aracCinsi)) aracCinsi = 'Dorse';
    else if (/kamyon/i.test(aracCinsi)) aracCinsi = 'Kamyon';

    return res.status(200).json({
      success: true,
      data: {
        plaka,
        saseNo,
        aracCinsi,
        marka: (parsedData.marka || '').toUpperCase().trim(),
        model: (parsedData.model || '').trim(),
        modelYili: parsedData.modelYili || '',
        isComplete: Boolean(plaka && saseNo.length === 17)
      }
    });

  } catch (globalErr) {
    console.error('parse-ruhsat handler error:', globalErr);
    return res.status(500).json({ success: false, error: 'Sunucu hatası: ' + globalErr.message });
  }
};
