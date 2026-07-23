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

  const { audioBase64, mimeType, offsetSeconds, providedLyrics } = req.body;
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

    // PROMPT DENGAN DUKUNGAN LIRIK MANUAL DARI USER
    let prompt = `Kamu adalah pencocok waktu lirik (Lyric Timestamper) yang sangat presisi.
Dengarkan potongan audio ini yang dimulai pada detik ke-${offsetSeconds}.

`;

    if (providedLyrics && providedLyrics.trim() !== '') {
      prompt += `BERIKUT ADALAH TEKS LIRIK PATOKAN UTAMA:
"""
${providedLyrics}
"""

TUGAS UTAMA:
Gunakan teks lirik di atas. Dengarkan audio dan tentukan TIMESTAMP (mulai dan selesai) untuk baris lirik yang dinyanyikan pada potongan audio ini!
SEMUA timestamp SRT HARUS disesuaikan dan ditambahkan offset detik ke-${offsetSeconds}.
PENTING: Jangan ubah/tambah kata pada lirik patokan di atas, hanya cocokkan timestamp-nya saja ke format SRT!`;
    } else {
      prompt += `Ekstrak lirik dari audio potongan ini ke format SRT. Semua timestamp SRT HARUS ditambah offset detik ke-${offsetSeconds}.`;
    }

    prompt += `\n\nKeluaran HARUS HANYA berupa teks format SRT yang valid. Tanpa pembuka/penutup markdown.`;

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
