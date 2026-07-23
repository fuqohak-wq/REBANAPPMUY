export default async function handler(req, res) {
  // Hanya izinkan method POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { audioBase64, mimeType, offsetSeconds, duration, chunkLyrics } = req.body;
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dipasang di Vercel Environment Variables!' });
  }

  try {
    const endSec = offsetSeconds + duration;

    // Prompt Dibuat Sangat Ketat & Jelas
    const prompt = `Kamu adalah pencocok timestamp lirik audio yang sangat presisi.

Dengarkan potongan audio ini (detik ${offsetSeconds} sampai ${endSec} dari lagu utama).

LIRIK UNTUK BAGIAN INI:
"""
${chunkLyrics || ''}
"""

TUGAS:
1. Tentukan timestamp mulai dan selesai untuk lirik di atas yang terdengar di potongan audio ini.
2. Tambahkan offset ${offsetSeconds} detik pada setiap timestamp SRT agar sesuai waktu lagu utama.
3. HANYA keluarkan format SRT murni tanpa kata pembuka/penutup atau tag markdown (```srt).`;

    // Tembak LANGSUNG ke model gemini-1.5-flash tanpa meminta list models dulu
    const targetUrl = `[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$){apiKey}`;

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json' 
      },
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
      // Tangkap pesan error detail dari Google jika ada
      const googleError = data.error?.message || JSON.stringify(data.error) || 'Gagal merespon dari Google API';
      throw new Error(`Google API Error (${response.status}): ${googleError}`);
    }

    const srtText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    // Bersihkan jika Gemini tidak sengaja memberi wrapper markdown ```srt
    const cleanedSrt = srtText.replace(/```srt/g, '').replace(/```/g, '').trim();

    return res.status(200).json({ srt: cleanedSrt });

  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
