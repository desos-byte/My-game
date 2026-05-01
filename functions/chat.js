export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api; 

  if (!prompt) return new Response(JSON.stringify({ error: "请输入内容" }), { status: 400 });

  const modelId = "gemma-4-31b-it"; 
  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ 
            text: "你是一个纯中文助手。不要解释，不要复述，不要自检。直接输出回答。严禁输出英文。" 
          }]
        },
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.1, // 降到最低，减少它“加戏”的概率
          maxOutputTokens: 1024,
          topP: 0.1
        }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content) {
      let rawText = data.candidates[0].content.parts[0].text;

      // --- 关键修正：强效后端过滤 ---
      // 1. 移除所有英文字母、问号、冒号组成的自检行 (例如 Is it pure Chinese? Yes.)
      // 2. 移除所有括号及其中的内容 (例如 (Hello))
      // 3. 移除 Markdown 符号
      let cleanText = rawText
        .replace(/[a-zA-Z\s\?\.]{3,}:?\s?(Yes|No|Hello|Greeting|Constraint|User input).*/gi, '') // 过滤自检行
        .replace(/\([^\)]*\)/g, '') // 移除所有括号里的英文翻译
        .replace(/[\*#_>`-]/g, '')  // 移除所有 Markdown 符号，解决字体粗细不一
        .replace(/[a-zA-Z]{5,}/g, '') // 移除长段英文单词
        .trim();

      // 重新封装处理后的文本返回
      data.candidates[0].content.parts[0].text = cleanText;
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
