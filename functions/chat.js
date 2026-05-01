export async function onRequestGet(context) {
  // 1. 获取用户输入
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  
  // 2. 读取环境变量 "api"
  const API_KEY = context.env.api; 

  // --- 拦截无效请求 ---
  if (!prompt) {
    return new Response(JSON.stringify({ error: "请输入内容" }), { 
      status: 400,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "未检测到 API 密钥，请检查环境变量配置" }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  // --- 3. 2026.04 发布的最强开放模型 Gemma 4 31B ---
  const modelId = "gemma-4-31b-it"; 
  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // --- 核心修正：系统指令强制“直接给结果” ---
        system_instruction: {
          parts: [{ 
            text: "你是一个中文 AI 助手。必须使用简体中文回答所有问题。直接给出回答，严禁输出任何思考过程、推理步骤、大纲或 <|think|> 标签内的内容。如果用户问及事实，直接陈述结果。" 
          }]
        },
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.8, // 保持一定的灵活性，但不至于胡言乱语
          maxOutputTokens: 2048,
          topP: 0.95
        }
      })
    });

    const data = await response.json();

    // 4. 针对 Google API 错误的处理
    if (data.error) {
      return new Response(JSON.stringify({ 
        error: `API 报错: ${data.error.message}` 
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 5. 成功：返回模型生成的纯净结果
    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: "Worker 运行异常: " + e.message }), { 
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
