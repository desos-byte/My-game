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
            text: "你是中文助理。直接输出中文回答。严禁输出任何英文大纲、格式说明或自检确认。" 
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
      const lines = rawText.split('\n');
      
      let startIndex = 0;
      
      // --- 核心：识别“大量输出中文”的起始点 ---
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;

        // 计算当前行的汉字数量
        const chineseChars = (line.match(/[\u4e00-\u9fa5]/g) || []).length;
        
        // 如果一行内汉字数量超过 10 个，或者汉字比例超过 50%
        // 这通常意味着模型开始正式回答，而不是在列 Topic: 这种提纲
        if (chineseChars > 10 || (chineseChars / line.length > 0.5)) {
          startIndex = i;
          break;
        }
      }

      // 1. 从识别到的“大量中文行”开始截取
      let cleanLines = lines.slice(startIndex);

      // 2. 进一步清理：过滤掉结尾可能出现的自检行 (Yes/No) 和 Markdown 符号
      const resultText = cleanLines
        .filter(line => {
          const l = line.toLowerCase();
          return !l.includes('is it') && !l.includes('yes.') && !l.includes('no.');
        })
        .join('\n')
        .replace(/[\*#_>`-]/g, '') // 移除 Markdown，解决字体粗细不一
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
