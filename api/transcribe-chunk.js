export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audioBase64, mimeType, offsetSeconds, duration, chunkLyrics } = req.body;
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

    const endSec = offsetSeconds + duration;

    // PROMPT DENGAN PEMBATASAN LIRIK SEKUENSIL DARI BROWSER
    const prompt = `Kamu adalah pencocok timestamp lirik (Audio-Lyric Aligner) yang sangat presisi.

Dengarkan potongan audio ini yang diambil dari detik ke-${offsetSeconds} sampai detik ke-${endSec} dari lagu utama.

LIRIK KHUSUS POTONGAN AUDIO INI:
"""
${chunkLyrics || ''}
"""

TUGAS UTAMA:
1. Dengarkan vokal dalam audio dan tentukan timestamp mulai dan selesai untuk baris-baris lirik di atas.
2. SEMUA timestamp SRT WAJIB ditambahkan offset awal yaitu ${offsetSeconds} detik (sehingga timestamp mencerminkan posisi di lagu utama).
3. HANYA keluarkan baris lirik yang BENAR-BENAR TERDENGAR dinyanyikan pada rentang waktu detik ${offsetSeconds}s - ${endSec}s ini.
4. Keluarkan HANYA teks format SRT yang valid tanpa pembuka/penutup markdown. Jika tidak ada vokal sama sekali, kembalikan teks kosong.`;

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
    if (!response.ok) throw new Error(data.error?.message || 'Gagal memproses dengan Gemini');

    const srtText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ srt: srtText });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
