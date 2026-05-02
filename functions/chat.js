export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api;[cite: 1]

  if (!prompt) return new Response(JSON.stringify({ error: "请输入内容" }), { status: 400 });[cite: 1]

  // ==========================================
  // 1. 图像生成逻辑：识别换成 -image
  // ==========================================
  if (prompt.startsWith('-image')) {
    const imagePrompt = prompt.replace(/^-image\s*/i, '');
    
    // 使用 2026 年最新的 Imagen 4 Ultra 接口
    const imagenApi = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4-ultra-generate:predict?key=${API_KEY}`;

    try {
      const response = await fetch(imagenApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: { 
            sampleCount: 1,
            aspectRatio: "1:1",
            outputOptions: { mimeType: "image/jpeg" }
          }
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);
      
      if (data.predictions && data.predictions.length > 0) {
        const base64Image = data.predictions[0].bytesBase64Encoded;
        return new Response(JSON.stringify({ 
          type: "image", 
          content: `data:image/jpeg;base64,${base64Image}` 
        }), { headers: { 'Content-Type': 'application/json' }});
      } else {
        throw new Error("图像生成失败，模型未返回图像数据");
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // ==========================================
  // 2. 文本生成逻辑：默认 lite，句首有 / 切换标准版[cite: 1]
  // ==========================================
  let modelId = "gemini-3.1-flash-lite-preview"; // 默认使用 lite[cite: 1]
  let cleanPrompt = prompt;

  if (prompt.startsWith('/')) {
    modelId = "gemini-3-flash-preview"; // 检测到斜杠，切换到非 lite[cite: 1]
    cleanPrompt = prompt.replace(/^\/\s*/, '');[cite: 1]
  }

  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;[cite: 1]

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ 
            text: "主要使用中文，严禁输出任何 Markdown 符号（如 *、#、` 等）。表现得更接近人类。" 
          }][cite: 1]
        },
        contents: [{ parts: [{ text: cleanPrompt }] }],[cite: 1]
        generationConfig: {
          temperature: 1.0,[cite: 1]
          maxOutputTokens: 2048[cite: 1]
        }
      })
    });

    const data = await response.json();
    
    if (data.error) throw new Error(data.error.message);

    if (data.candidates && data.candidates[0].content) {
      let rawText = data.candidates[0].content.parts[0].text;[cite: 1]
      const resultText = rawText.replace(/[\*#_>`-]/g, '').trim();[cite: 1]

      return new Response(JSON.stringify({ 
        type: "text", 
        content: resultText 
      }), { headers: { 'Content-Type': 'application/json' }});
    }

    throw new Error("模型未返回有效文本");

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });[cite: 1]
  }
}
