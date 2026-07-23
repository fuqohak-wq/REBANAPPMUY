export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb',
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audioBase64, mimeType, offsetSeconds } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Vercel!' });
  }

  try {
    // 1. OTOMATIS AMBIL DAFTAR MODEL YANG DIDUKUNG OLEH API KEY
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (!listRes.ok || !listData.models) {
      throw new Error(listData.error?.message || "Gagal mengambil daftar model dari Google API");
    }

    // Cari model flash atau pro yang mendukung generateContent
    const availableModels = listData.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    // Prioritaskan model flash
    let selectedModel = availableModels.find(m => m.includes('flash')) || 
                        availableModels.find(m => m.includes('gemini')) || 
                        availableModels[0];

    if (!selectedModel) {
      throw new Error("Tidak ada model Gemini yang mendukung generateContent pada API Key ini.");
    }

    // 2. KIRIM REQUEST AUDIO KE MODEL YANG DIPILIH DENGAN PRESISI
    const prompt = `Kamu adalah sistem Speech-to-Text yang sangat presisi. 
Dengarkan audio potongan lagu berikut dan ekstrak liriknya beserta timestamp dalam format SRT.

PETUNJUK WAKTU SANGAT PENTING:
Audio ini adalah potongan yang dimulai pada detik ke-${offsetSeconds}.
Oleh karena itu, SEMUA timestamp dalam file SRT HARUS ditambahkan/dimulai dari detik ke-${offsetSeconds}!
Contoh: Jika vokal terdengar di detik ke-5 pada potongan ini, maka timestamp SRT adalah ${offsetSeconds + 5} detik.

Keluaran HARUS HANYA berupa teks format SRT yang valid (urutan, timestamp, teks lirik). Jangan tambahkan teks pembuka/penutup markdown.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'audio/wav',
                data: audioBase64
              }
            }
          ]
        }]
      })
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || `Gagal memproses dengan model ${selectedModel}`);
    }

    const srtText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ srt: srtText, usedModel: selectedModel });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
