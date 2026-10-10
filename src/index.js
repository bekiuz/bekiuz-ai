const GENERAL_SYSTEM_PROMPT = "You are Bekiuz AI, a helpful multilingual AI assistant created by Bekiuz Company. Reply in the language used by the user; prefer natural Uzbek when they write Uzbek. Be accurate, clear, respectful, and practical. If unsure, say so instead of inventing facts. For coding requests, provide working code and concise explanations. Ask a clarifying question only when necessary. Do not claim you browsed the web or performed real-world actions unless tools actually did so.";

const BUSINESS_SYSTEM_PROMPT = "You are Bekiuz Business AI, an assistant for small businesses, designers, freelancers, and teams. Reply in the user's language; prefer natural Uzbek for Uzbek messages. Help create social media captions, ad copy, product descriptions, customer support replies, FAQ drafts, content calendars, project proposals, and simple workflow plans. Never invent business prices, guarantees, testimonials, or facts. If key details are missing, state assumptions or ask one concise question. Keep marketing claims honest and avoid promising guaranteed sales or results.";

const DEFAULT_MODEL = "google/gemma-2-2b-it:featherless-ai";

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
        configured: Boolean(env.HF_TOKEN),
        provider: "Hugging Face Inference Providers",
        model: env.HF_MODEL || DEFAULT_MODEL,
      });
    }

    if (url.pathname !== "/api/chat") {
      return json({ ok: false, error: "API endpoint topilmadi.", code: "NOT_FOUND" }, 404);
    }
    if (request.method !== "POST") {
      return json({ ok: false, error: "Faqat POST so‘rovi qabul qilinadi.", code: "METHOD_NOT_ALLOWED" }, 405);
    }
    if (!env.HF_TOKEN) {
      return json({
        ok: false,
        error: "Hugging Face tokeni serverda sozlanmagan.",
        code: "HF_TOKEN_NOT_CONFIGURED",
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
    const model = typeof env.HF_MODEL === "string" && env.HF_MODEL.trim()
      ? env.HF_MODEL.trim()
      : DEFAULT_MODEL;

    try {
      const upstream = await fetch("https://router.huggingface.co/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": "Bearer " + env.HF_TOKEN,
          "Content-Type": "application/json",
          "Accept": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: [{ role: "system", content: systemPrompt }, ...messages],
          temperature: 0.65,
          max_tokens: 1200,
          stream: false,
        }),
        signal: AbortSignal.timeout(45000),
      });

      const result = await upstream.json().catch(() => ({}));
      if (!upstream.ok) {
        if (upstream.status === 401 || upstream.status === 403) {
          return json({
            ok: false,
            error: "Hugging Face tokeni yoki ruxsatlari noto‘g‘ri. Cloudflare Secret sozlamasini tekshiring.",
            code: "HF_TOKEN_INVALID",
          }, 502);
        }
        if (upstream.status === 402) {
          return json({
            ok: false,
            error: "Hugging Face AI krediti tugagan yoki hisob sozlamasida muammo bor.",
            code: "HF_QUOTA_EXHAUSTED",
          }, 429);
        }
        if (upstream.status === 429) {
          return json({
            ok: false,
            error: "AI provayderi vaqtinchalik limit qo‘ydi. Birozdan keyin qayta urinib ko‘ring.",
            code: "RATE_LIMITED",
          }, 429);
        }
        if (upstream.status === 400 || upstream.status === 404 || upstream.status === 422) {
          return json({
            ok: false,
            error: "Tanlangan AI modeli hozir mavjud emas yoki undan foydalanish uchun qo‘shimcha ruxsat talab qilinmoqda.",
            code: "HF_MODEL_UNAVAILABLE",
          }, 502);
        }
        return json({
          ok: false,
          error: "Hugging Face AI xizmati vaqtincha javob bermadi.",
          code: "UPSTREAM_ERROR",
        }, 502);
      }

      const reply = result?.choices?.[0]?.message?.content;
      if (typeof reply !== "string" || !reply.trim()) {
        return json({ ok: false, error: "AI bo‘sh javob qaytardi.", code: "UPSTREAM_ERROR" }, 502);
      }
      return json({ ok: true, reply: reply.trim(), model: result?.model || model });
    } catch (error) {
      const timedOut = error?.name === "TimeoutError" || error?.name === "AbortError";
      return json({
        ok: false,
        error: timedOut
          ? "AI javobi uzoq ketyapti. Birozdan keyin qayta urinib ko‘ring."
          : "AI xizmatiga ulanib bo‘lmadi.",
        code: timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR",
      }, timedOut ? 504 : 502);
    }
  },
};
