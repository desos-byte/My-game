export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api;

  if (!prompt) return new Response(JSON.stringify({ error: "请输入内容" }), { status: 400 });

  // ==========================================
  // 1. 最新 Image 生成逻辑 (Gemini 3.1 Flash Image)
  // ==========================================
  if (prompt.startsWith('-image')) {
    const imagePrompt = prompt.replace(/^-image\s*/i, '');
    
    // 2026 最新模型 ID: gemini-3.1-flash-image-preview (取代原 Imagen 4 Ultra)
    // 注意：Gemini 3 系列统一使用 :generateContent 接口
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.1-flash-image-preview:generateContent?key=${API_KEY}`;

    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: imagePrompt }] }],
          generationConfig: {
            // 2026 新增参数：指定生成高分辨率图像 (2K)
            "response_mime_type": "application/json"
          }
        })
      });

      const data = await response.json();
      
      if (data.error) throw new Error(data.error.message);

      // Gemini 3.1 会直接在 parts 中返回 inlineData
      const imagePart = data.candidates[0].content.parts.find(p => p.inlineData);
      
      if (imagePart) {
        return new Response(JSON.stringify({ 
          type: "image", 
          content: `data:${imagePart.inlineData.mimeType};base64,${imagePart.inlineData.data}` 
        }), { headers: { 'Content-Type': 'application/json' }});
      } else {
        throw new Error("模型未返回图像数据，可能是触发了安全过滤。");
      }
    } catch (e) {
      return new Response(JSON.stringify({ error: e.message }), { status: 500 });
    }
  }

  // ==========================================
  // 2. 最新文本生成逻辑 (Gemini 3.1 系列)
  // ==========================================
  
  // 默认使用 3.1 Flash-Lite (极速版)
  let modelId = "gemini-3.1-flash-lite-preview"; 
  let cleanPrompt = prompt;

  // 如果输入以 / 开头，切换到 3.1 Pro (深度思考版)
  if (prompt.startsWith('/')) {
    modelId = "gemini-3.1-pro-preview"; 
    cleanPrompt = prompt.replace(/^\/\s*/, '');
  }

  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ text: "你是我的好朋友，说话要自然、简洁，多用中文。不要输出任何 Markdown 符号（如 * 或 #）。" }]
        },
        contents: [{ parts: [{ text: cleanPrompt }] }],
        generationConfig: { 
          temperature: 0.9, 
          maxOutputTokens: 1024,
          // Gemini 3 新增：限制思考等级为 minimal 以获得更低延迟
          "thinking_level": "minimal" 
        }
      })
    });

    const data = await response.json();
    if (data.error) throw new Error(data.error.message);
    
    if (data.candidates && data.candidates[0].content) {
      // 过滤 Markdown 符号
      let resultText = data.candidates[0].content.parts[0].text.replace(/[\*#_>`-]/g, '').trim();
      return new Response(JSON.stringify({ type: "text", content: resultText }), { headers: { 'Content-Type': 'application/json' }});
    }
    throw new Error("Gemini 3.1 未能生成有效回复");
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
