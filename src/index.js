const GENERAL_SYSTEM_PROMPT = "You are Bekiuz AI, a helpful multilingual AI assistant created by Bekiuz Company. Reply in the language used by the user; prefer natural Uzbek when they write Uzbek. Be accurate, clear, respectful, and practical. If unsure, say so instead of inventing facts. For coding requests, provide working code and concise explanations. Ask a clarifying question only when necessary. Do not claim you browsed the web or performed real-world actions unless tools actually did so.";

const BUSINESS_SYSTEM_PROMPT = "You are Bekiuz Business AI, an assistant for small businesses, designers, freelancers, and teams. Reply in the user's language; prefer natural Uzbek for Uzbek messages. Help create social media captions, ad copy, product descriptions, customer support replies, FAQ drafts, content calendars, project proposals, and simple workflow plans. Never invent business prices, guarantees, testimonials, or facts. If key details are missing, state assumptions or ask one concise question. Keep marketing claims honest and avoid promising guaranteed sales or results.";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

function cleanHistory(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string")
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 12000),
    }))
    .filter((message) => message.content.length > 0);
}

function errorText(error) {
  return String(error?.message || error || "").toLowerCase();
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (!url.pathname.startsWith("/api/")) {
      if (env.ASSETS) return env.ASSETS.fetch(request);
      return new Response("Not found", { status: 404 });
    }

    if (url.pathname === "/api/health" && request.method === "GET") {
      return json({
        ok: true,
        configured: Boolean(env.AI),
        provider: "Cloudflare Workers AI",
        model: env.AI_MODEL || DEFAULT_MODEL,
        freeDailyAllocationNeurons: 10000,
      });
    }

    if (url.pathname !== "/api/chat") {
      return json({ ok: false, error: "API endpoint topilmadi.", code: "NOT_FOUND" }, 404);
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Faqat POST so‘rovi qabul qilinadi.", code: "METHOD_NOT_ALLOWED" }, 405);
    }
    if (!env.AI) {
      return json({
        ok: false,
        error: "Cloudflare Workers AI binding ulanmagan.",
        code: "AI_BINDING_NOT_CONFIGURED",
      }, 503);
    }

    let body;
    try {
      const contentLength = Number(request.headers.get("content-length") || 0);
      if (contentLength > 80000) {
        return json({ ok: false, error: "So‘rov hajmi juda katta.", code: "REQUEST_TOO_LARGE" }, 413);
      }
      body = await request.json();
    } catch {
      return json({ ok: false, error: "So‘rov JSON formatida emas.", code: "INVALID_JSON" }, 400);
    }

    const mode = body?.mode === "business" ? "business" : "general";
    const messages = cleanHistory(body?.messages);
    if (!messages.length || messages[messages.length - 1].role !== "user") {
      return json({ ok: false, error: "Yuboriladigan xabar topilmadi.", code: "INVALID_MESSAGES" }, 400);
    }

    const systemPrompt = mode === "business" ? BUSINESS_SYSTEM_PROMPT : GENERAL_SYSTEM_PROMPT;
    const model = typeof env.AI_MODEL === "string" && env.AI_MODEL.trim()
      ? env.AI_MODEL.trim()
      : DEFAULT_MODEL;

    try {
      const result = await env.AI.run(model, {
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.65,
        max_tokens: 1200,
      });

      const reply = typeof result?.response === "string"
        ? result.response
        : result?.choices?.[0]?.message?.content;

      if (typeof reply !== "string" || !reply.trim()) {
        return json({ ok: false, error: "AI bo‘sh javob qaytardi.", code: "AI_MODEL_ERROR" }, 502);
      }

      return json({ ok: true, reply: reply.trim(), model });
    } catch (error) {
      const message = errorText(error);
      if (/neuron|daily limit|quota|exceeded.*limit|too many requests/.test(message)) {
        return json({
          ok: false,
          error: "Cloudflare Workers AI’ning bugungi bepul limiti tugagan. Limit UTC 00:00 da yangilanadi.",
          code: "AI_DAILY_LIMIT",
        }, 429);
      }
      if (/timeout|timed out|abort/.test(message)) {
        return json({
          ok: false,
          error: "AI javobi uzoq ketyapti. Birozdan keyin qayta urinib ko‘ring.",
          code: "AI_TIMEOUT",
        }, 504);
      }
      return json({
        ok: false,
        error: "Cloudflare AI modeli vaqtincha javob bermadi. Model holatini va Workers AI limitini tekshiring.",
        code: "AI_MODEL_ERROR",
      }, 502);
    }
  },
};
