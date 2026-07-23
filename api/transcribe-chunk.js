export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioBase64, mimeType, offsetSeconds, duration, chunkLyrics } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Environment Variables!' });
    }

    if (!audioBase64) {
      return res.status(400).json({ error: 'Data audio tidak ditemukan dalam request!' });
    }

    const endSec = (offsetSeconds || 0) + (duration || 0);

    const prompt = `Kamu adalah pencocok timestamp lirik audio yang presisi.

Dengarkan potongan audio ini (detik ${offsetSeconds} sampai ${endSec} dari lagu utama).

LIRIK UNTUK BAGIAN INI:
"""
${chunkLyrics || ''}
"""

TUGAS:
Cocokkan baris-baris lirik di atas dengan audio yang didengar. 
Tentukan waktu mulai (start) dan selesai (end) dalam satuan detik untuk setiap baris lirik. 
Tambahkan offset waktu sebesar ${offsetSeconds} detik pada hasil akhir agar sinkron dengan lagu utama.

Hasilkan keluaran berupa JSON dengan struktur berikut:
{
  "subtitles": [
    {
      "start": 0.0,
      "end": 0.0,
      "text": "Teks lirik"
    }
  ]
}`;

    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(targetUrl, {
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
        }],
        generationConfig: {
          responseMimeType: "application/json"
        }
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const googleErr = data.error?.message || 'Gagal merespon dari Google API';
      return res.status(response.status).json({ error: `Google API Error: ${googleErr}` });
    }

    const jsonText = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
    let parsedResult;
    try {
      parsedResult = JSON.parse(jsonText);
    } catch (e) {
      return res.status(500).json({ error: 'Gagal membaca format JSON dari AI', raw: jsonText });
    }

    return res.status(200).json(parsedResult);

  } catch (err) {
    console.error('Server Crash Error:', err);
    return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
}
