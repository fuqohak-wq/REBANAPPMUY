// api/generate.js

export const config = {
  runtime: 'edge',
};

export default async function handler(req) {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), { status: 405 });
  }

  try {
    const { style = 'banjari' } = await req.json();

    const HF_TOKEN = process.env.HF_TOKEN;

    if (!HF_TOKEN) {
      return new Response(
        JSON.stringify({ error: 'HF_TOKEN tidak ditemukan di Vercel Environment Variables!' }), 
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const stylePrompts = {
      banjari: "fast energetic Hadroh Banjari style, rapid frame drum rolls, high energy tempo, syncopated Islamic percussion",
      habibi: "medium tempo Middle Eastern Duff rhythm, accent beat, lively traditional hand drumming",
      slow: "slow solemn Hadroh beat, deep bass frame drum, meditative acoustic Islamic rhythm"
    };

    const selectedStyle = stylePrompts[style] || stylePrompts.banjari;

    // 🔒 Prompt Ketat Murni Perkusi Rebana
    const promptText = `Solo acoustic frame drum performance, traditional rebana percussion, ${selectedStyle}, pure percussion ensemble, organic acoustic wood and skin sound, dynamic rhythm. [STRICT INSTRUCTION: Pure acoustic percussion only. NO piano, NO guitar, NO synth, NO bass, NO flute, NO strings, NO melody, NO vocals, NO singing, NO electronic beats]`;

    // 🎯 Request dengan Struktur Payload Lengkap untuk MusicGen
    const hfResponse = await fetch(
      "https://api-inference.huggingface.co/models/facebook/musicgen-small",
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
          "x-wait-for-model": "true"
        },
        method: "POST",
        body: JSON.stringify({
          inputs: promptText,
          parameters: {
            max_new_tokens: 256 // Membatasi durasi audio (~5-10 detik) agar generasi cepat & bebas error limit
          }
        }),
      }
    );

    if (!hfResponse.ok) {
      const errText = await hfResponse.text();
      return new Response(
        JSON.stringify({ error: `HuggingFace API (${hfResponse.status}): ${errText}` }), 
        { status: hfResponse.status, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const audioData = await hfResponse.arrayBuffer();

    return new Response(audioData, {
      status: 200,
      headers: {
        'Content-Type': 'audio/wav',
        'Cache-Control': 'no-store',
      },
    });

  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message || 'Gagal terhubung ke server AI' }), 
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
