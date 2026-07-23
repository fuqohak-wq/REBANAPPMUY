export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { audioBase64, mimeType, offsetSeconds, duration, chunkLyrics } = req.body || {};
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Vercel Environment Variables!' });
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
1. Tentukan timestamp mulai dan selesai untuk lirik di atas yang terdengar di potongan audio ini.
2. Tambahkan offset ${offsetSeconds} detik pada setiap timestamp SRT agar sesuai waktu lagu utama.
3. HANYA keluarkan format SRT murni tanpa kata pembuka/penutup atau tag markdown.`;

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
    console.error('Server Crash Error:', err);
    return res.status(500).json({ error: `Internal Server Error: ${err.message}` });
  }
}
