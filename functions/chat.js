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
            text: "你是中文助理。直接开始回答，不要任何前言和大纲。" 
          }]
        },
        contents: [{
          parts: [{ text: prompt }]
        }],
        generationConfig: {
          temperature: 0.4,
          maxOutputTokens: 1024
        }
      })
    });

    const data = await response.json();
    
    if (data.candidates && data.candidates[0].content) {
      let rawText = data.candidates[0].content.parts[0].text;
      
      // 1. 按行拆分
      let lines = rawText.split('\n');
      
      // 2. 先强制删掉前三行 (Blind Cut)
      let shiftedLines = lines.slice(3);
      
      let startIndex = 0;
      let foundContent = false;

      // 3. 在剩下的行里寻找中文爆发点 (Density Check)
      for (let i = 0; i < shiftedLines.length; i++) {
        const line = shiftedLines[i].trim();
        if (!line) continue;

        const chineseChars = (line.match(/[\u4e00-\u9fa5]/g) || []).length;
        
        // 如果该行汉字多于 8 个，认为正式进入中文正文
        if (chineseChars > 8) {
          startIndex = i;
          foundContent = true;
          break;
        }
      }

      // 如果没找到爆发点，就保底显示所有切除后的行；找到了就从爆发点开始
      let finalLines = foundContent ? shiftedLines.slice(startIndex) : shiftedLines;

      // 4. 清洗：干掉自检行、Markdown 符号、空行
      const resultText = finalLines
        .filter(line => {
          const l = line.toLowerCase();
          const isJunk = l.includes('is it') || l.includes('yes.') || l.includes('no.') || l.includes('constraint');
          return !isJunk && line.trim() !== ""; 
        })
        .join('\n')
        .replace(/[\*#_>`-]/g, '') // 确保字体厚度统一，不触发 Markdown 加粗
        .trim();

      data.candidates[0].content.parts[0].text = resultText || "内容处理中...";
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
