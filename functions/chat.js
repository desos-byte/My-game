export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api;

  if (!prompt) return new Response(JSON.stringify({ error: "请输入内容" }), { status: 400 });

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
