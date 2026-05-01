export async function onRequestPost(context) {
    const API_KEY = context.env.api; 
    
    // 调试：如果没有读到 Key，直接返回错误提示
    if (!API_KEY) {
        return new Response(JSON.stringify({ error: "Cloudflare 环境变量 'api' 未设置或未读取到。" }), { status: 500 });
    }

    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    try {
        const body = await context.request.json();
        const response = await fetch(url, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        });

        const data = await response.json();
        
        // 调试：如果 Google 返回了错误（比如 Key 失效），把错误传回前端
        if (data.error) {
            return new Response(JSON.stringify({ error: `Google API 错误: ${data.error.message}` }), { status: response.status });
        }

        return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: `Worker 内部错误: ${err.message}` }), { status: 500 });
    }
}
