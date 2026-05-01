export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  
  // --- 关键点：读取你设置的名为 "api" 的环境变量 ---
  const API_KEY = context.env.api; 

  if (!prompt) {
    return new Response(JSON.stringify({ error: "Missing prompt" }), { status: 400 });
  }

  // 使用 v1 版本的稳定端点，避免 v1beta 的路径匹配问题
  const googleApi = `https://generativelanguage.googleapis.com/v1/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  try {
    // 即使前端发给 Cloudflare 的是 GET，Cloudflare 发给 Google 时必须转成 POST
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

    // 如果 Google 返回了报错（比如 API Key 无效），直接透传给前端方便排查
    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message || data.error }), {
        headers: { 'Content-Type': 'application/json' },
        status: 200 // 这里给 200 是为了让前端能看到具体的报错文字
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Cloudflare Worker Error: " + e.message }), { 
      status: 500 
    });
  }
}
