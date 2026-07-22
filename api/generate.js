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

    // Pola Default Cadangan (Jika Gemini Key error/belum terpasang)
    const fallbackPatterns = {
      banjari: {
        bpm: 120,
        pattern_name: "Hadroh Banjari Standard Loop",
        sequence: [
          { time: 0.0, sound: "dung" },
          { time: 0.25, sound: "tak" },
          { time: 0.5, sound: "keprak" },
          { time: 0.75, sound: "tak" },
          { time: 1.0, sound: "dung" },
          { time: 1.25, sound: "dung" },
          { time: 1.5, sound: "keprak" },
          { time: 1.75, sound: "tak" }
        ]
      },
      habibi: {
        bpm: 95,
        pattern_name: "Habibi / Duff Rhythm Loop",
        sequence: [
          { time: 0.0, sound: "dung" },
          { time: 0.4, sound: "tak" },
          { time: 0.8, sound: "keprak" },
          { time: 1.2, sound: "dung" },
          { time: 1.6, sound: "tak" }
        ]
      },
      slow: {
        bpm: 75,
        pattern_name: "Slow Hadroh Meditative Loop",
        sequence: [
          { time: 0.0, sound: "dung" },
          { time: 0.6, sound: "keprak" },
          { time: 1.2, sound: "dung" },
          { time: 1.8, sound: "tak" }
        ]
      }
    };

    // Jika tidak ada Gemini Key, gunakan fallback langsung tanpa crash
    if (!GEMINI_API_KEY) {
      return new Response(JSON.stringify(fallbackPatterns[style] || fallbackPatterns.banjari), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Panggil Gemini jika Key tersedia
    const promptText = `Buatkan struktur pola ketukan rebana loop untuk gaya "${style}" dan lirik "${lyrics}". Format JSON murni:
{
  "bpm": 110,
  "pattern_name": "Nama Ritme",
  "sequence": [
    {"time": 0, "sound": "dung"},
    {"time": 0.25, "sound": "tak"},
    {"time": 0.5, "sound": "keprak"},
    {"time": 0.75, "sound": "tak"}
  ]
}`;

    const geminiResponse = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`,
      {
        headers: { "Content-Type": "application/json" },
        method: "POST",
        body: JSON.stringify({ contents: [{ parts: [{ text: promptText }] }] }),
      }
    );

    if (!geminiResponse.ok) {
      // Jika Gemini error, kembalikan fallback agar aplikasi tetap berjalan!
      return new Response(JSON.stringify(fallbackPatterns[style] || fallbackPatterns.banjari), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const data = await geminiResponse.json();
    const rawText = data.candidates[0].content.parts[0].text;
    const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();

    return new Response(cleanJson, {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });

  } catch (error) {
    // Fallback jika terjadi kesalahan jaringan
    return new Response(JSON.stringify({
      bpm: 110,
      pattern_name: "Hadroh Emergency Loop",
      sequence: [
        { time: 0.0, sound: "dung" },
        { time: 0.3, sound: "tak" },
        { time: 0.6, sound: "keprak" },
        { time: 0.9, sound: "dung" }
      ]
    }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
