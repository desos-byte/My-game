export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  
  // 读取你设置的环境变量 "api"
  const API_KEY = context.env.api; 

  if (!prompt) {
    return new Response(JSON.stringify({ error: "No prompt provided" }), { status: 400 });
  }

  // --- 关键修正：使用 2026 年最新的模型 ID ---
  // 选项 A (推荐): gemini-2.5-flash (当前最强的免费 Flash 模型)
  // 选项 B: gemini-flash-latest (始终指向最新的 Flash 版本)
  const modelId = "gemini-2.5-flash"; 
  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{
          parts: [{ text: prompt }]
        }]
      })
    });

    const data = await response.json();

    if (data.error) {
      // 如果还报错，会将 Google 给出的具体原因显示在网页上
      return new Response(JSON.stringify({ 
        error: `Google API 状态: ${data.error.message}` 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Worker Internal Error: " + e.message }), { 
      status: 500 
    });
  }
}
