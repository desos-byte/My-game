export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api;

  if (!prompt) return new Response(JSON.stringify({ error: "请输入内容" }), { status: 400 });

  // ==========================================
  // 1. 修正后的 Imagen 4 Ultra 生图逻辑
  // ==========================================
  if (prompt.startsWith('-image')) {
    const imagePrompt = prompt.replace(/^-image\s*/i, '');
    
    // 正确的 2026 Model ID: imagen-4.0-ultra-generate-001
    // 必须使用 :predict 接口，而非 :generateContent
    const imagenApi = `https://generativelanguage.googleapis.com/v1beta/models/imagen-4.0-ultra-generate-001:predict?key=${API_KEY}`;

    try {
      const response = await fetch(imagenApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          instances: [{ prompt: imagePrompt }],
          parameters: { 
            sampleCount: 1,
            aspectRatio: "1:1", // 支持 1:1, 3:4, 4:3, 9:16, 16:9
            outputOptions: { mimeType: "image/jpeg" },
            // Ultra 版支持更高分辨率 (2048x2048)
            storageUri: "" 
          }
        })
      });

      const data = await response.json();
      
      if (data.error) {
        // 处理常见的 404 (ID错误) 或 429 (配额不足)
        throw new Error(`API 错误: ${data.error.message}`);
      }
      
      // 注意：API 返回的结构是 predictions[0].bytesBase64Encoded
      if (data.predictions && data.predictions.length > 0) {
        const base64Image = data.predictions[0].bytesBase64Encoded;
        return new Response(JSON.stringify({ 
          type: "image", 
          content: `data:image/jpeg;base64,${base64Image}` 
        }), { headers: { 'Content-Type': 'application/json' }});
      } else {
        throw new Error("模型未返回图像，请检查 Prompt 是否包含违规内容。");
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // ==========================================
  // 2. 文本生成逻辑 (保持不变)
  // ==========================================
  let modelId = "gemini-3.1-flash-lite-preview"; 
  let cleanPrompt = prompt;

  if (prompt.startsWith('/')) {
    modelId = "gemini-3-flash-preview"; 
    cleanPrompt = prompt.replace(/^\/\s*/, '');
  }

  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "主要使用中文，严禁输出任何 Markdown 符号。表现得更接近人类。" }]
        },
        contents: [{ parts: [{ text: cleanPrompt }] }],
        generationConfig: { temperature: 1.0, maxOutputTokens: 2048 }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    if (data.candidates && data.candidates[0].content) {
      let resultText = data.candidates[0].content.parts[0].text.replace(/[\*#_>`-]/g, '').trim();
      return new Response(JSON.stringify({ type: "text", content: resultText }), { headers: { 'Content-Type': 'application/json' }});
    }
    throw new Error("文本生成失败");
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
