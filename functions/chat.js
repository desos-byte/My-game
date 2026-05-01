export async function onRequestGet(context) {
  // 1. 解析前端传来的 GET 参数 (?prompt=...)
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  
  // 2. 读取 Cloudflare 中设置的名为 "api" 的环境变量
  const API_KEY = context.env.api; 

  // --- 拦截异常情况 ---
  if (!prompt) {
    return new Response(JSON.stringify({ error: "没有收到文字，请说点什么吧" }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Cloudflare 环境变量 'api' 没读到，请检查后台配置" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // 3. 设定 Google API 的正确端点 (v1beta + gemini-1.5-flash 是目前最兼容的写法)
  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

  try {
    // 4. 将前端的 GET 请求转换为 Google 需要的 POST 请求发出去
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

    // 5. 错误透传：如果 Google 拒绝了请求（比如内容违规、或模型写错），将明确的错误提示发给前端
    if (data.error) {
      return new Response(JSON.stringify({ 
        error: `Google API 报错: ${data.error.message || JSON.stringify(data.error)}` 
      }), {
        status: 200, // 故意给 200，让前端的 res.json() 能正常解析出报错文字
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 6. 成功，返回正常的对话数据
    return new Response(JSON.stringify(data), {
      status: 200,
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    // 7. 兜底错误处理（比如网络连接断开）
    return new Response(JSON.stringify({ error: "Worker 运行错误: " + e.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
