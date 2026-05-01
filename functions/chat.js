export async function onRequest(context) {
    const { request, env } = context;
    const API_KEY = env.api; // 确保你在 Cloudflare Pages 后台设置了变量名为 api 的 API Key
    const url = new URL(request.url);

    let prompt = "";

    // --- 1. 提取 Prompt (兼容 GET 和 POST) ---
    try {
        if (request.method === "GET") {
            // 从 URL 参数 ?prompt=xxx 中获取内容
            prompt = url.searchParams.get("prompt");
        } else if (request.method === "POST") {
            // 从 JSON Body 中获取内容
            const body = await request.json();
            if (body.contents && body.contents[0] && body.contents[0].parts) {
                prompt = body.contents[0].parts[0].text;
            }
        }

        if (!prompt || prompt.trim() === "") {
            return new Response(JSON.stringify({ error: "输入的 Prompt 为空" }), {
                status: 400,
                headers: { "Content-Type": "application/json" }
            });
        }
    } catch (err) {
        return new Response(JSON.stringify({ error: "解析请求失败: " + err.message }), {
            status: 400,
            headers: { "Content-Type": "application/json" }
        });
    }

    // --- 2. 调用 Google Gemini API ---
    const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(googleApi, {
            method: "POST", // 发给 Google 的始终是 POST
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }]
            })
        });

        const data = await response.json();

        // 检查 Google 是否返回了 API 级错误（如 Key 无效、超限等）
        if (data.error) {
            return new Response(JSON.stringify({ error: data.error.message || "Gemini API 内部错误" }), {
                status: response.status,
                headers: { "Content-Type": "application/json" }
            });
        }

        // --- 3. 返回结果给前端 ---
        return new Response(JSON.stringify(data), {
            headers: {
                "Content-Type": "application/json",
                // 解决可能的跨域问题
                "Access-Control-Allow-Origin": "*"
            }
        });

    } catch (err) {
        // 网络层面的错误
        return new Response(JSON.stringify({ error: "网络传输失败: " + err.message }), {
            status: 500,
            headers: { "Content-Type": "application/json" }
        });
    }
}
