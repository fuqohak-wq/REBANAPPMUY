// api/generate.js

// 💡 Mengaktifkan Edge Runtime agar Vercel tidak timeout di detik ke-10
export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const { style = 'banjari' } = await req.json();

    const HF_TOKEN = process.env.HF_TOKEN || "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";

    const stylePrompts = {
      banjari: "fast energetic Hadroh Banjari style, rapid frame drum rolls, high energy tempo, syncopated Islamic percussion",
      habibi: "medium tempo Middle Eastern Duff rhythm, accent beat, lively traditional hand drumming",
      slow: "slow solemn Hadroh beat, deep bass frame drum, meditative acoustic Islamic rhythm"
    };

    const selectedStyle = stylePrompts[style] || stylePrompts.banjari;

    // 🔒 PROMPT KETAT (Perkusi Murni)
    const prompt = `Solo acoustic frame drum performance, traditional rebana percussion, ${selectedStyle}, pure percussion ensemble, organic acoustic wood and skin sound, dynamic rhythm. [STRICT INSTRUCTION: Pure acoustic percussion only. NO piano, NO guitar, NO synth, NO bass, NO flute, NO strings, NO melody, NO vocals, NO singing, NO electronic beats]`;

    // Direct Inference Router Endpoint
    const hfResponse = await fetch(
      "https://router.huggingface.co/hf-inference/models/facebook/musicgen-small",
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true"
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (!hfResponse.ok) {
      const errText = await hfResponse.text();
      return new Response(JSON.stringify({ error: `HuggingFace Error (${hfResponse.status}): ${errText}` }), {
        status: hfResponse.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Direct Streaming Response (Sangat Cepat & Bebas Timeout Vercel)
    const audioData = await hfResponse.arrayBuffer();

    return new Response(audioData, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: error.message || 'Gagal terhubung ke AI' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
