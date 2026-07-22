// api/generate.js

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { style = 'banjari', lyrics = '' } = req.body;

  // TOKEN HUGGING FACE KAMU TERPASANG DI SINI
  const HF_TOKEN = process.env.HF_TOKEN || "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";

  // Mapping Gaya Ketukan Rebana
  const stylePrompts = {
    banjari: "fast energetic Hadroh Banjari style, rapid frame drum rolls, high energy tempo, syncopated Islamic percussion",
    habibi: "medium tempo Middle Eastern Duff rhythm, accent beat, lively traditional hand drumming",
    slow: "slow solemn Hadroh beat, deep bass frame drum, meditative acoustic Islamic rhythm"
  };

  const selectedStyle = stylePrompts[style] || stylePrompts.banjari;

  // 🔒 PROMPT KETAT (Murni Rebana / Perkusi Non-Melodi)
  const prompt = `Solo acoustic frame drum performance, traditional rebana percussion, ${selectedStyle}, pure percussion ensemble, organic acoustic wood and skin sound, dynamic rhythm. [STRICT INSTRUCTION: Pure acoustic percussion only. NO piano, NO guitar, NO synth, NO bass, NO flute, NO strings, NO melody, NO vocals, NO singing, NO electronic beats]`;

  try {
    const response = await fetch(
      "https://api-inference.huggingface.co/models/facebook/musicgen-small",
      {
        headers: {
          Authorization: `Bearer ${HF_TOKEN}`,
          "Content-Type": "application/json",
        },
        method: "POST",
        body: JSON.stringify({ inputs: prompt }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`HuggingFace API Error: ${errText}`);
    }

    // Mengambil audio buffer dan mengembalikannya sebagai response WAV
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.setHeader("Content-Type", "audio/wav");
    return res.status(200).send(buffer);

  } catch (error) {
    console.error("Error generating audio:", error);
    return res.status(500).json({ error: error.message || "Gagal membuat audio rebana" });
  }
}
