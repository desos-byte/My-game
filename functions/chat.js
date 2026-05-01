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
            text: "你是中文助理。直接回答问题。严禁输出英文大纲、格式说明或自检。回答必须是纯文本中文。" 
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
      let lines = rawText.split('\n');
      
      // 1. 强制盲切前三行
      let shiftedLines = lines.slice(3);
      
      let startIndex = 0;
      let foundContent = false;

      // 2. 字节爆发点识别 (汉字字节数 > 总字节数 * 60%)
      for (let i = 0; i < shiftedLines.length; i++) {
        const line = shiftedLines[i].trim();
        if (!line) continue;

        // 使用 TextEncoder 获取字节长度
        const encoder = new TextEncoder();
        const totalBytes = encoder.encode(line).length;
        
        // 匹配汉字并计算其字节数（每个汉字 3 字节）
        const chineseMatch = line.match(/[\u4e00-\u9fa5]/g);
        const chineseBytes = chineseMatch ? chineseMatch.length * 3 : 0;

        // 判断比例是否超过 60%
        if (totalBytes > 0 && (chineseBytes / totalBytes) >= 0.6) {
          startIndex = i;
          foundContent = true;
          break;
        }
      }

      // 3. 截取并清洗
      let finalLines = foundContent ? shiftedLines.slice(startIndex) : shiftedLines;

      const resultText = finalLines
        .filter(line => {
          const l = line.toLowerCase();
          // 进一步剔除残余的英文自检行
          return !l.includes('is it') && !l.includes('yes.') && !l.includes('no.') && line.trim() !== "";
        })
        .join('\n')
        .replace(/[\*#_>`-]/g, '') // 移除 Markdown 符号，配合 CSS 保持字体厚度统一
        .trim();

      data.candidates[0].content.parts[0].text = resultText || "未检测到有效中文回答。";
    }

    return new Response(JSON.stringify(data), {
      headers: { 'Content-Type': 'application/json' }
    });

  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500 });
  }
}
