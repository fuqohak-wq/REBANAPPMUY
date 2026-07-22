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

    // 🔒 AMBIL GEMINI API KEY DARI VERCEL ENV
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

    if (!GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: 'GEMINI_API_KEY belum dipasang di Vercel Environment Variables!' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Prompt khusus ke Gemini untuk merancang komposisi ketukan Rebana
    const promptText = `Kamu adalah pakar ritme perkusi Hadroh dan Rebana tradisional.
Tugasmu: Buatkan pola ketukan perkusi rebana murni (instrumen: dung, tak, keprak) untuk gaya: "${style}".
Lirik/Tema lagu: "${lyrics}".

Kembalikan jawaban HANYA berupa JSON valid berikut (TANPA teks tambahan, TANPA markdown \`\`\`json):
{
  "bpm": 110,
  "pattern_name": "Hadroh Banjari",
  "sequence": [
    {"time": 0, "sound": "dung"},
    {"time": 0.25, "sound": "tak"},
    {"time": 0.5, "sound": "keprak"},
    {"time": 0.75, "sound": "dung"},
    {"time": 1.0, "sound": "tak"},
    {"time": 1.25, "sound": "dung"},
    {"time": 1.5, "sound": "keprak"},
    {"time": 1.75, "sound": "tak"}
  ]
}`;

    // Panggil Endpoint Gemini API (v1beta)
    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`,
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
    
    // Bersihkan tag markdown jika ada
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
