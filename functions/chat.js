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
            text: "你是一个中文助理。直接回答问题。不要输出自检列表、不要确认约束条件。必须使用纯文本。" 
          }]
        },
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.6, 
          maxOutputTokens: 1024
        }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content) {
      let rawText = data.candidates[0].content.parts[0].text;

      // --- 精准切除逻辑 ---
      const cleanText = rawText.split('\n')
        .filter(line => {
          const l = line.toLowerCase();
          // 排除掉所有包含自检特征的行
          const isChecklist = l.includes('constraint') || 
                             l.includes('is it') || 
                             l.includes('user says') || 
                             l.includes('pure chinese') ||
                             l.includes('yes.') ||
                             l.includes('no.');
          return !isChecklist && line.trim() !== ""; // 同时过滤掉空行
        })
        .join('\n') // 重新组合
        .replace(/[\*#_>`-]/g, '') // 删掉 Markdown 符号保证字体粗细一致
        .trim();

      data.candidates[0].content.parts[0].text = cleanText || "未检测到有效回复，请重试";
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
