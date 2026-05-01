export async function onRequestPost(context) {
    const API_KEY = context.env.api; 
    
    if (!API_KEY) {
        return new Response(JSON.stringify({ error: "Cloudflare 环境变量 'api' 未设置。" }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
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
        
        if (data.error) {
            return new Response(JSON.stringify({ error: `Google API: ${data.error.message}` }), { 
                status: response.status,
                headers: { "Content-Type": "application/json" }
            });
        }

        return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: `Worker 内部错误: ${err.message}` }), { 
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
