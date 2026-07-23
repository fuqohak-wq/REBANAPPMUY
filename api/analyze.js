export const config = {
  api: {
    bodyParser: {
      sizeLimit: '10mb', // Menaikkan limit internal jika menggunakan plan Vercel Pro/Custom
    },
  },
};

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { base64Audio, mimeType } = req.body;
    const apiKey = process.env.GEMINI_API_KEY;

    if (!apiKey) {
      return res.status(500).json({ error: 'GEMINI_API_KEY belum dikonfigurasi di Vercel.' });
    }

    const prompt = `Analisis file audio lagu ini dan ekstraksi liriknya. Output WAJIB JSON murni (array dari objek) tanpa teks markdown tambahan. 
    Skema JSON:
    [
      {"start": 0.0, "end": 4.5, "text": "Lirik baris pertama"},
      {"start": 4.5, "end": 8.0, "text": "Lirik baris kedua"}
    ]
    Penting: Wajib beri stempel waktu/timestamp detik (start dan end) yang presisi sesuai ucapan vokal lagu.`;

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [
            { text: prompt },
            { inline_data: { mime_type: mimeType || 'audio/mp3', data: base64Audio } }
          ]
        }]
      })
    });

    const responseText = await response.text();

    if (!response.ok) {
      return res.status(response.status).json({ error: `Gemini Error (${response.status}): ${responseText}` });
    }

    const data = JSON.parse(responseText);
    return res.status(200).json(data);

  } catch (error) {
    console.error("Server Error:", error);
    return res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
}
