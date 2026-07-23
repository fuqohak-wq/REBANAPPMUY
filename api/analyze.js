export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel.' });
  }

  const { action, mimeType, size, fileUri, fileName } = req.body;

  try {
    // TAHAP 1: Minta URL Upload Rahasia dari Google File API
    if (action === 'getUploadUrl') {
      const uploadInitRes = await fetch(`https://generativelanguage.googleapis.com/upload/v1beta/files?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'X-Goog-Upload-Protocol': 'resumable',
          'X-Goog-Upload-Command': 'start',
          'X-Goog-Upload-Header-Content-Length': size.toString(),
          'X-Goog-Upload-Header-Content-Type': mimeType || 'audio/mp3',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ file: { display_name: "temp_audio_track" } })
      });

      const uploadUrl = uploadInitRes.headers.get('X-Goog-Upload-URL');
      if (!uploadUrl) {
        throw new Error("Gagal mendapatkan Upload URL dari Google.");
      }

      return res.status(200).json({ uploadUrl });
    }

    // TAHAP 2: Analisis Lirik & Langsung Hapus File Permanen dari Google
    if (action === 'analyzeAndDelete') {
      const prompt = `Analisis file audio lagu ini dan ekstraksi liriknya. Output WAJIB JSON murni (array dari objek) tanpa teks markdown tambahan. 
      Skema JSON wajib:
      [
        {"start": 0.0, "end": 4.5, "text": "Lirik baris pertama"},
        {"start": 4.5, "end": 8.0, "text": "Lirik baris kedua"}
      ]
      Penting: Wajib beri stempel waktu/timestamp detik (start dan end) yang presisi sesuai ucapan vokal lagu.`;

      // 1. Panggil Gemini 2.5 Flash menggunakan File URI
      const geminiRes = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: prompt },
              { file_data: { mime_type: mimeType || 'audio/mp3', file_uri: fileUri } }
            ]
          }]
        })
      });

      const geminiData = await geminiRes.json();

      // 2. LANGSUNG HAPUS FILE DARI GOOGLE STORAGE (Detik itu juga agar hemat kuota storage)
      if (fileName) {
        fetch(`https://generativelanguage.googleapis.com/v1beta/${fileName}?key=${apiKey}`, {
          method: 'DELETE'
        }).catch(err => console.error("Gagal menghapus file otomatis:", err));
      }

      if (!geminiRes.ok) {
        return res.status(geminiRes.status).json({ error: geminiData.error?.message || 'Gagal analisis Gemini' });
      }

      return res.status(200).json(geminiData);
    }

    return res.status(400).json({ error: 'Action tidak valid' });

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
