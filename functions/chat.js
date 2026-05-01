export async function onRequest(context) {
    const { request, env } = context;
    const API_KEY = env.api;
    const url = new URL(request.url);

    let prompt = "";

    // 适配 GET 请求 (绕过 Safari 对 POST 的拦截)
    if (request.method === "GET") {
        prompt = url.searchParams.get("prompt");
        if (!prompt) return new Response("Missing prompt", { status: 400 });
    } 
    // 适配 POST 请求
    else if (request.method === "POST") {
        const body = await request.json();
        prompt = body.contents[0].parts[0].text;
    }

    const googleApi = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${API_KEY}`;

    try {
        const response = await fetch(googleApi, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        const data = await response.json();
        return new Response(JSON.stringify(data), {
            headers: { "Content-Type": "application/json" }
        });
    } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), { status: 500 });
    }
}
