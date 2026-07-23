import { v2 as cloudinary } from 'cloudinary';

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel.' });
  }

  const { audioUrl, publicId } = req.body;

  if (!audioUrl || !publicId) {
    return res.status(400).json({ error: 'Audio URL / Public ID tidak ditemukan.' });
  }

  try {
    // 1. Download buffer MP3 dari Cloudinary untuk dikirim ke Gemini
    const audioFetch = await fetch(audioUrl);
    const audioArrayBuffer = await audioFetch.arrayBuffer();
    const base64Audio = Buffer.from(audioArrayBuffer).toString('base64');

    const prompt = `Analisis file audio lagu ini dan ekstraksi liriknya. Output WAJIB JSON murni (array dari objek) tanpa teks markdown tambahan. 
    Skema JSON wajib:
    [
      {"start": 0.0, "end": 4.5, "text": "Lirik baris pertama"},
      {"start": 4.5, "end": 8.0, "text": "Lirik baris kedua"}
    ]
    Penting: Wajib beri stempel waktu/timestamp detik (start dan end) yang presisi sesuai ucapan vokal lagu.`;

    // 2. Kirim ke Gemini 2.5 Flash
    const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: 'audio/mp3', data: base64Audio } }
          ]
        }]
      })
    });

    const data = await geminiRes.json();

    // 3. LANGSUNG HAPUS FILE DARI CLOUDINARY (Auto Cleanup agar storage 0 Byte)
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }); 
      // Catatan: Cloudinary mengkategorikan file MP3/Audio di bawah resource_type 'video'
    } catch (cleanErr) {
      console.error("Gagal hapus file Cloudinary:", cleanErr);
    }

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: data.error?.message || 'Gagal analisis Gemini' });
    }

    return res.status(200).json(data);

  } catch (error) {
    // Cleanup cadangan jika ada error
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => {});
    }
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
