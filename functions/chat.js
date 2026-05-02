export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api; 

  if (!prompt) return new Response(JSON.stringify({ error: "请输入内容" }), { status: 400 });

  // --- 模型选择逻辑：默认 lite，句首有 / 则切换为非 lite ---
  let modelId = "gemini-3.1-flash-lite-preview"; // 默认使用 lite
  let cleanPrompt = prompt;

  if (prompt.startsWith('/')) {
    modelId = "gemini-3-flash-preview"; // 检测到斜杠，切换到非 lite
    // 删掉斜杠前缀，避免干扰模型回答
    cleanPrompt = prompt.replace(/^\/\s*/, '');
  }

  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ 
            text: "使用中文，严禁输出任何 Markdown 符号（如 *、#、` 等）。确保文字厚实、连续。" 
          }]
        },
        contents: [{
          parts: [{ text: cleanPrompt }]
        }],
        generationConfig: {
          temperature: 1.0,
          maxOutputTokens: 1024
        }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content) {
      let rawText = data.candidates[0].content.parts[0].text;

      // 最后的格式清洗：移除所有 Markdown 符号以适配前端 CSS (weight: 600)
      const resultText = rawText
        .replace(/[\*#_>`-]/g, '')
        .trim();

      data.candidates[0].content.parts[0].text = resultText;
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
