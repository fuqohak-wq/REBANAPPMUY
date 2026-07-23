export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Cukup untuk potongan audio 3 menit
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
    const prompt = `Kamu adalah sistem Speech-to-Text yang sangat presisi. 
Dengarkan audio potongan lagu berikut dan ekstrak liriknya beserta timestamp dalam format SRT.

PETUNJUK WAKTU SANGAT PENTING:
Audio ini adalah potongan yang dimulai pada detik ke-${offsetSeconds}.
Oleh karena itu, SEMUA timestamp dalam file SRT HARUS ditambahkan/dimulai dari detik ke-${offsetSeconds}!
Contoh: Jika vokal terdengar di detik ke-5 pada potongan ini, maka timestamp SRT adalah ${offsetSeconds + 5} detik.

Keluaran HARUS HANYA berupa teks format SRT yang valid (urutan, timestamp, teks lirik). Jangan tambahkan teks pembuka/penutup markdown.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
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
    if (!response.ok) {
      throw new Error(data.error?.message || 'Gagal memproses dengan Gemini');
    }

    const srtText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    return res.status(200).json({ srt: srtText });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
