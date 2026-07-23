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
    // 1. Download buffer MP3 dari Cloudinary
    const audioFetch = await fetch(audioUrl);
    const audioArrayBuffer = await audioFetch.arrayBuffer();
    const base64Audio = Buffer.from(audioArrayBuffer).toString('base64');

    // 2. Prompt Gemini 2.5 Flash diperketat agar timestamp akurat sampai akhir lagu
    const prompt = `Analisis file audio lagu ini secara teliti dan buatkan lirik beserta timestamp waktu (dalam detik) yang SANGAT PRESISI.

    Aturan Wajib:
    1. Bagi lirik menjadi baris-baris pendek (3 sampai 6 kata per baris).
    2. Tentukan waktu awal ("start") dan waktu akhir ("end") sesuai ketukan vokal dengan ketelitian desimal (contoh: 12.4).
    3. PENTING: Jaga akurasi pergeseran waktu dari detik awal (0.0s) sampai detik PALING AKHIR lagu. Jangan biarkan timestamp melompat atau tertinggal.
    4. Output WAJIB JSON murni berupa array of objects tanpa pembuka/penutup markdown.
    
    Skema JSON:
    [
      {"start": 0.0, "end": 4.2, "text": "Mari belajar ilmu tauhid mulia"},
      {"start": 4.5, "end": 8.1, "text": "Mengenal Allah Rabb semesta raya"}
    ]`;

    // 3. Kirim ke Gemini API
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

    // 4. BEBAS MEMORI: Hapus file MP3 di Cloudinary seketika
    try {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' });
    } catch (cleanErr) {
      console.error("Gagal hapus file Cloudinary:", cleanErr);
    }

    if (!geminiRes.ok) {
      return res.status(geminiRes.status).json({ error: data.error?.message || 'Gagal analisis Gemini' });
    }

    return res.status(200).json(data);

  } catch (error) {
    if (publicId) {
      await cloudinary.uploader.destroy(publicId, { resource_type: 'video' }).catch(() => {});
    }
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
