export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api; 

  if (!prompt) return new Response(JSON.stringify({ error: "No prompt" }), { status: 400 });

  // --- 2026.04 发布的 Gemma 4 31B 标识符 ---
  const modelId = "gemma-4-31b-it"; 
  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }],
        // Gemma 4 建议的采样参数
        generationConfig: {
          temperature: 1.0,
          topP: 0.95,
          topK: 64,
          maxOutputTokens: 4096
        }
      })
    });

    const data = await response.json();

    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 返回模型生成的文本
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Worker Error: " + e.message }), { status: 500 });
  }
}
