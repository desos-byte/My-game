export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  
  // 1. 获取所有 API 密钥并转换为数组
  // 假设你在 Cloudflare 后台设置的 env.api 格式为: AIzaSyA...,AIzaSyB...,AIzaSyC...
  const apiString = context.env.api || "";
  const apiKeys = apiString.split(',').map(k => k.trim()).filter(Boolean);

  if (!prompt) {
    return new Response(JSON.stringify({ error: "请输入内容" }), { 
      status: 400, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }
  
  if (apiKeys.length === 0) {
    return new Response(JSON.stringify({ error: "未配置任何有效的 API Key" }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json' } 
    });
  }

  // ==========================================
  // 2. 文本生成逻辑与模型选择
  // ==========================================
  let modelId = "gemini-3.1-flash-lite-preview"; 
  let cleanPrompt = prompt;

  if (prompt.startsWith('/')) {
    modelId = "gemini-3-flash-preview"; 
    cleanPrompt = prompt.replace(/^\/\s*/, '');
  }

  // ==========================================
  // 3. 核心：多 API 轮询重试逻辑
  // ==========================================
  let lastError = null;

  // 遍历所有密钥，一旦成功就直接 return 返回，失败则进入下一次循环
  for (let i = 0; i < apiKeys.length; i++) {
    const currentApiKey = apiKeys[i];
    const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${currentApiKey}`;

    try {
      const response = await fetch(googleApi, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: "主要使用中文，严禁输出任何 Markdown 符号。表现得更接近人类。" }]
          },
          contents: [{ parts: [{ text: cleanPrompt }] }],
          generationConfig: { temperature: 1.0, maxOutputTokens: 8192 }
        })
      });

      const data = await response.json();
      
      // 如果 API 返回了错误（比如当前 Key 额度超限、被封等）
      if (data.error) {
        throw new Error(`API 报错 [Key ${i+1}]: ${data.error.message}`);
      }
      
      // 成功获取到数据，直接解析并返回给前端，结束整个函数
      if (data.candidates && data.candidates[0].content) {
        let resultText = data.candidates[0].content.parts[0].text.replace(/[\*#_>`-]/g, '').trim();
        return new Response(JSON.stringify({ type: "text", content: resultText }), { 
          headers: { 
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*' // 顺便帮你加上了跨域头，防止前端报错
          }
        });
      }
      
      throw new Error(`[Key ${i+1}] 接口未返回有效文本`);

    } catch (e) {
      // 当前 Key 失败，记录错误日志，继续下一次循环（尝试下一个 Key）
      console.error(`第 ${i+1} 个 API Key 失败: ${e.message}`);
      lastError = e.message;
    }
  }

  // 如果循环结束了都没有成功返回，说明所有的 Key 都失败了
  return new Response(JSON.stringify({ error: `所有 API Key 均调用失败。最后一次错误: ${lastError}` }), { 
    status: 500, 
    headers: { 
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*' 
    } 
  });
}
      
