export const config = {
  api: {
    bodyParser: {
      sizeLimit: '25mb', // Diperbesar agar muat MP3 lagu utuh
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audioBase64, mimeType, providedLyrics } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Vercel!' });
  }

  try {
    const listRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    const listData = await listRes.json();

    if (!listRes.ok || !listData.models) {
      throw new Error(listData.error?.message || "Gagal mengambil daftar model");
    }

    const availableModels = listData.models
      .filter(m => m.supportedGenerationMethods && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace('models/', ''));

    let selectedModel = availableModels.find(m => m.includes('flash')) || availableModels[0];

    const prompt = `Kamu adalah pencocok timestamp lirik lagu yang sangat presisi (Audio-to-Text Alignment Expert).

Dengarkan audio lagu berikut DARI AWAL SAMPAI AKHIR.

LIRIK PATOKAN UTAMA:
"""
${providedLyrics || ''}
"""

TUGAS UTAMA:
1. Cocokkan baris-baris lirik di atas dengan audio dari detik 00:00:00 hingga akhir lagu.
2. Buat output format SRT yang SANGAT PRESISI.
3. Pastikan urutan lirik BERURUTAN dari awal lagu sampai akhir. JANGAN PERNAH melompati lirik atau menukar urutan baris lirik.
4. Jangan tambahkan kata-kata pembuka/penutup markdown. Cukup keluarkan teks format SRT yang valid saja.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${selectedModel}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType: mimeType || 'audio/mp3',
                data: audioBase64
              }
            }
          ]
        }]
      })
    });

    const data = await response.json();
    if (!response.ok) throw new Error(data.error?.message || 'Gagal memproses dengan Gemini');

    const srtText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ srt: srtText });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
