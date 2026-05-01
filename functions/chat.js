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
        // --- 核心激进策略：禁止复述、禁止自检、禁止一切英文 ---
        system_instruction: {
          parts: [{ 
            text: "你是一个纯中文助理。严禁输出任何英文，包括但不限于推理过程、指令复述、约束确认、自检列表或说明。严禁使用 Markdown（如 ** 或 #）。必须直接输出最终的中文结果文字。" 
          }]
        },
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.3, // 进一步调低随机性，让它不再“发散”出多余的自检内容
          maxOutputTokens: 1024,
          topP: 0.1 // 极端采样，只选最可能的词，强力压制多余输出
        }
      })
    });

    const data = await response.json();
    if (data.error) return new Response(JSON.stringify({ error: data.error.message }), { status: 500 });

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
