// api/generate.js

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { style = 'banjari', lyrics = '' } = await req.json();

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY belum dipasang di Vercel Environment Variables!' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prompt khusus ke Gemini untuk merancang pola ketukan Rebana
    const promptText = `Kamu adalah pakar ketukan Rebana/Hadroh tradisional. 
Tugasmu: Bikin pola ketukan perkusi rebana murni berbasis variabel tempo (BPM) dan urutan instrumen (Dung, Tak, Keprak, Bass) untuk gaya: "${style}".
Lirik/Tema lagu: "${lyrics}".

Kembalikan jawaban HANYA dalam format JSON valid berikut (tanpa Markdown ```json):
{
  "bpm": 110,
  "pattern_name": "Hadroh Banjari",
  "sequence": [
    {"time": 0, "sound": "dung"},
    {"time": 0.25, "sound": "tak"},
    {"time": 0.5, "sound": "keprak"},
    {"time": 0.75, "sound": "dung"},
    {"time": 1.0, "sound": "tak"}
  ]
}`;

    // Panggil Gemini API (v1beta / models)
    const geminiResponse = await fetch(
      `[https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$](https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=$){GEMINI_API_KEY}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({
          contents: [{ parts: [{ text: promptText }] }]
        }),
      }
    );

    if (!geminiResponse.ok) {
      const errText = await geminiResponse.text();
      return new Response(
        JSON.stringify({ error: `Gemini API Error (${geminiResponse.status}): ${errText}` }), 
        { status: geminiResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const data = await geminiResponse.json();
    const rawText = data.candidates[0].content.parts[0].text;
    
    // Bersihkan format jika Gemini menyisipkan tag markdown
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return new Response(cleanJson, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Gagal terhubung ke Gemini AI' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
