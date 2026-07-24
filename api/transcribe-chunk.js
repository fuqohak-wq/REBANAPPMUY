export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioBase64, mimeType, lyrics } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Vercel!' });
    }

    if (!audioBase64) {
      return res.status(400).json({ error: 'Data audio tidak ditemukan!' });
    }

    const prompt = `Kamu adalah profesional pembuat timestamp lirik audio/lagu (SRT Generator).

Dengarkan seluruh audio ini dari awal sampai akhir.

BERIKUT ADALAH LIRIK LENGKAPNYA:
"""
${lyrics || ''}
"""

TUGAS KAMU:
1. Cocokkan setiap baris lirik di atas dengan waktu terdengarnya di dalam audio secara sangat presisi.
2. Buatkan output dalam format Subtitle SRT murni.
3. JANGAN menambah kalimat pembuka/penutup. HANYA keluarkan struktur format SRT.`;

    // Tembak langsung ke Gemini 2.5 Flash
    const targetUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const response = await fetch(targetUrl, {
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
      const googleErr = data.error?.message || 'Gagal merespon dari Google API';
      return res.status(response.status).json({ error: `Google API Error: ${googleErr}` });
    }

    const srtText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    const cleanedSrt = srtText.replace(/```srt/g, '').replace(/```/g, '').trim();

    return res.status(200).json({ srt: cleanedSrt });

  } catch (err) {
    return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
}
