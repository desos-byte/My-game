export async function onRequestGet(context) {
  const { searchParams } = new URL(context.request.url);
  const prompt = searchParams.get('prompt');
  const API_KEY = context.env.api; 

  if (!prompt) return new Response(JSON.stringify({ error: "请输入内容" }), { status: 400 });

  // --- 模型选择逻辑：使用最新的官方 ID 别名 ---
  // 修正：gemini-3-flash -> gemini-3-flash-latest
  let modelId = "gemini-3-flash-latest"; 
  let cleanPrompt = prompt;

  if (prompt.startsWith('(lite)') || prompt.startsWith('（lite）')) {
    // 修正：gemini-3.1-flash-lite -> gemini-3.1-flash-lite-latest
    modelId = "gemini-3.1-flash-lite-latest";
    cleanPrompt = prompt.replace(/^[(（]lite[)）]\s*/i, '');
  }

  // 拼接 API 地址
  const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/${modelId}:generateContent?key=${API_KEY}`;

  try {
    const response = await fetch(googleApi, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{ 
            text: "你是中文助理。直接输出中文回答，严禁输出任何 Markdown 符号（如 *、#、` 等）。确保文字厚实、连续。" 
          }]
        },
        contents: [{
          parts: [{ text: cleanPrompt }]
        }],
        generationConfig: {
          temperature: 0.6,
          maxOutputTokens: 1024
        }
      })
    });

    const data = await response.json();
    
    // 如果返回了错误信息（比如模型依然找不到），直接把报错抛给前端方便排查
    if (data.error) {
      return new Response(JSON.stringify({ error: data.error.message }), { status: response.status });
    }

    if (data.candidates && data.candidates[0].content) {
      let rawText = data.candidates[0].content.parts[0].text;

      // 最后的格式清洗：移除所有 Markdown 符号
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
