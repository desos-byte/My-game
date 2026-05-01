export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  
  // 读取你设置的名为 "api" 的环境变量
  const API_KEY = context.env.api; 

  if (!prompt) {
    return new Response(JSON.stringify({ error: "No prompt" }), { status: 400 });
  }

  // --- 2026.05 官方推荐的免费主力模型 ID ---
  // 1.5 已弃用，2.5 需求过高，2.0 Flash 是目前的平衡点
  const modelId = "gemini-2.0-flash"; 
  
  // 统一使用 v1 路径，2.0 模型在 v1 正式版端点已完全稳定
  const googleApi = `https://generativelanguage.googleapis.com/v1/models/${modelId}:generateContent?key=${API_KEY}`;

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
      // 捕获各种 2026 年常见的 API 错误（配额、忙碌、版本等）
      let friendlyError = data.error.message;
      if (data.error.message.includes("high demand")) friendlyError = "Google 2.0 节点暂忙，请 3 秒后重试";
      if (data.error.message.includes("not found")) friendlyError = "模型 ID 匹配失效，请检查 API 版本";

      return new Response(JSON.stringify({ error: friendlyError }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: "Worker 运行异常: " + e.message }), { 
      status: 500 
    });
  }
}
