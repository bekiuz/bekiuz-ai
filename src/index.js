const GENERAL_SYSTEM_PROMPT = "You are Bekiuz AI, a helpful multilingual AI assistant created by Bekiuz Company. Reply in the language used by the user; prefer natural Uzbek when they write Uzbek. Be accurate, clear, respectful, and practical. If unsure, say so instead of inventing facts. For coding requests, provide working code and concise explanations. Ask a clarifying question only when necessary. Do not claim you browsed the web or performed real-world actions unless tools actually did so.";

const BUSINESS_SYSTEM_PROMPT = "You are Bekiuz Business AI, an assistant for small businesses, designers, freelancers, and teams. Reply in the user's language; prefer natural Uzbek for Uzbek messages. Help create social media captions, ad copy, product descriptions, customer support replies, FAQ drafts, content calendars, project proposals, and simple workflow plans. Never invent business prices, guarantees, testimonials, or facts. If key details are missing, state assumptions or ask one concise question. Keep marketing claims honest and avoid promising guaranteed sales or results.";

const DEFAULT_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8";
const PLANNER_ALLOWED_ORIGINS = new Set([
  "https://bekiuz.github.io",
  "https://bekiuz-build.netlify.app",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "http://localhost:4173",
  "http://localhost",
  "https://localhost",
  "capacitor://localhost",
]);
const PLAN_RATE_BUCKETS = new Map();

function json(data, status = 200, extraHeaders = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

function corsHeaders(request) {
  const origin = request.headers.get("origin");
  if (!origin || !PLANNER_ALLOWED_ORIGINS.has(origin)) return { "Vary": "Origin" };
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Accept",
    "Access-Control-Max-Age": "600",
    "Vary": "Origin",
  };
}

function isPlanRateLimited(key) {
  const now = Date.now();
  let bucket = PLAN_RATE_BUCKETS.get(key);
  if (!bucket || now >= bucket.resetAt) {
    PLAN_RATE_BUCKETS.set(key, { count: 1, resetAt: now + 60_000 });
    if (PLAN_RATE_BUCKETS.size > 1500) {
      for (const [ip, item] of PLAN_RATE_BUCKETS) if (now >= item.resetAt) PLAN_RATE_BUCKETS.delete(ip);
    }
    return false;
  }
  bucket.count += 1;
  return bucket.count > 8;
}

function plannerProject(input = {}) {
  const number = (value, fallback, min, max) => {
    const candidate = typeof value === "number" ? value : Number(value);
    return Number.isFinite(candidate) ? Math.min(max, Math.max(min, candidate)) : fallback;
  };
  const plotWidth = number(input.plotWidth, 20, 6, 100);
  const plotLength = number(input.plotLength, 30, 8, 200);
  return {
    plotWidth,
    plotLength,
    houseWidth: number(input.houseWidth, 10, 4, Math.max(4, Math.min(30, plotWidth - 2))),
    houseLength: number(input.houseLength, 14, 4, Math.max(4, Math.min(40, plotLength - 2))),
    floors: Math.round(number(input.floors, 1, 1, 2)),
    rooms: Math.round(number(input.rooms, 3, 2, 5)),
    roofType: ["gable", "hip", "flat"].includes(input.roofType) ? input.roofType : "gable",
  };
}

function normalisePlannerResult(value, project) {
  if (!value || typeof value !== "object") throw new Error("AI javobi JSON ko‘rinishida emas.");
  const settings = value.proposedSettings && typeof value.proposedSettings === "object" ? value.proposedSettings : {};
  const number = (candidate, fallback, min, max) => {
    const n = typeof candidate === "number" ? candidate : Number(candidate);
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
  };
  const maxWidth = Math.max(4, Math.min(30, project.plotWidth - 2));
  const maxLength = Math.max(4, Math.min(40, project.plotLength - 2));
  let houseWidth = number(settings.houseWidth, project.houseWidth, 4, maxWidth);
  let houseLength = number(settings.houseLength, project.houseLength, 4, maxLength);
  const maxFootprint = project.plotWidth * project.plotLength * 0.8;
  if (houseWidth * houseLength > maxFootprint) {
    const scale = Math.sqrt(maxFootprint / (houseWidth * houseLength));
    houseWidth = Math.max(4, houseWidth * scale);
    houseLength = Math.max(4, houseLength * scale);
  }
  const roofType = ["gable", "hip", "flat"].includes(settings.roofType) ? settings.roofType : project.roofType;
  const recommendations = Array.isArray(value.recommendations)
    ? value.recommendations.filter((item) => typeof item === "string").map((item) => item.trim().slice(0, 220)).filter(Boolean).slice(0, 5)
    : [];
  return {
    summary: typeof value.summary === "string" && value.summary.trim()
      ? value.summary.trim().slice(0, 600)
      : "Uy uchun boshlang‘ich konsept tayyorlandi.",
    recommendations,
    proposedSettings: {
      houseWidth: Math.round(houseWidth * 10) / 10,
      houseLength: Math.round(houseLength * 10) / 10,
      floors: Math.round(number(settings.floors, project.floors, 1, 2)),
      rooms: Math.round(number(settings.rooms, project.rooms, 2, 5)),
      roofType,
    },
  };
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
      }, 200, corsHeaders(request));
    }

    if (url.pathname === "/api/plan") {
      const origin = request.headers.get("origin");
      if (request.method === "OPTIONS") {
        if (origin && !PLANNER_ALLOWED_ORIGINS.has(origin)) {
          return new Response(null, { status: 403, headers: { "Vary": "Origin" } });
        }
        return new Response(null, { status: 204, headers: corsHeaders(request) });
      }
      const respond = (data, status = 200) => json(data, status, corsHeaders(request));
      if (origin && !PLANNER_ALLOWED_ORIGINS.has(origin)) {
        return respond({ ok: false, error: "Bu manbadan so‘rov qabul qilinmaydi.", code: "ORIGIN_NOT_ALLOWED" }, 403);
      }
      if (request.method !== "POST") {
        return respond({ ok: false, error: "Faqat POST so‘rovi qabul qilinadi.", code: "METHOD_NOT_ALLOWED" }, 405);
      }
      const client = request.headers.get("CF-Connecting-IP") || "unknown";
      if (isPlanRateLimited(client)) {
        return respond({ ok: false, error: "Juda ko‘p so‘rov yuborildi. Bir daqiqadan keyin qayta urinib ko‘ring.", code: "AI_RATE_LIMIT" }, 429);
      }
      if (!env.AI) {
        return respond({ ok: false, error: "Cloudflare Workers AI binding ulanmagan.", code: "AI_BINDING_NOT_CONFIGURED" }, 503);
      }

      let body;
      try {
        const contentLength = Number(request.headers.get("content-length") || 0);
        if (contentLength > 8000) {
          return respond({ ok: false, error: "So‘rov hajmi juda katta.", code: "REQUEST_TOO_LARGE" }, 413);
        }
        body = await request.json();
      } catch {
        return respond({ ok: false, error: "So‘rov JSON formatida emas.", code: "INVALID_JSON" }, 400);
      }

      const prompt = typeof body?.prompt === "string" ? body.prompt.trim() : "";
      if (!prompt) return respond({ ok: false, error: "Uy talablarini yozing.", code: "PROMPT_REQUIRED" }, 400);
      if (prompt.length > 1200) return respond({ ok: false, error: "So‘rov 1200 belgidan oshmasligi kerak.", code: "PROMPT_TOO_LONG" }, 400);
      const project = plannerProject(body?.project || {});
      const userPrompt = [
        "BEKIUZ BUILD foydalanuvchisiga uy rejalashtirish bo‘yicha konseptual tavsiya tayyorla.",
        "Faqat JSON qaytar. Markdown, izoh yoki code fence yozma.",
        "JSON shakli: {summary: string, recommendations: string[], proposedSettings: {houseWidth: number, houseLength: number, floors: number, rooms: number, roofType: 'gable'|'hip'|'flat}}.",
        "Javobni tabiiy o‘zbek tilida yoz.",
        "Bu faqat konsept. Poydevor, armatura, kolonna, to‘sin, elektr sim kesimi yoki quvur diametri kabi xavfsizlikka oid yakuniy yechimlarni belgilama; mutaxassis tekshiruvini eslat.",
        "Narxlar bazasi berilmagan, shuning uchun aniq qurilish narxi yoki smeta jami sonini o‘ylab topma.",
        "Uy eni va uzunligi yer maydoniga mos bo‘lsin, imkon qadar yer chegarasidan masofa qoldir.",
        "Qavatlar 1 yoki 2; xonalar 2 dan 5 gacha; roofType gable, hip yoki flat bo‘lishi kerak.",
        "Joriy parametrlar: " + JSON.stringify(project),
        "Foydalanuvchi talabi: " + prompt,
      ].join("\n\n");

      try {
        const model = typeof env.AI_MODEL === "string" && env.AI_MODEL.trim() ? env.AI_MODEL.trim() : DEFAULT_MODEL;
        const result = await env.AI.run(model, {
          messages: [
            { role: "system", content: "Sen BEKIUZ BUILD uchun o‘zbek tilida javob beradigan ehtiyotkor uy rejalashtirish yordamchisisan. Talab qilingan JSON shakliga qat’iy amal qil." },
            { role: "user", content: userPrompt },
          ],
          temperature: 0.25,
          max_tokens: 1000,
        });
        let raw = String(result?.response || result?.choices?.[0]?.message?.content || "").trim();
        const fence = String.fromCharCode(96).repeat(3);
        if (raw.startsWith(fence)) raw = raw.split("\n").slice(1).join("\n").split(fence)[0].trim();
        const firstBrace = raw.indexOf("{");
        const lastBrace = raw.lastIndexOf("}");
        if (firstBrace < 0 || lastBrace <= firstBrace) throw new Error("Model JSON qaytarmadi.");
        const parsed = JSON.parse(raw.slice(firstBrace, lastBrace + 1));
        const plan = normalisePlannerResult(parsed, project);
        return respond({ ok: true, plan, model }, 200);
      } catch (error) {
        const message = String(error?.message || error || "").toLowerCase();
        if (/neuron|daily limit|quota|exceeded.*limit|too many requests/.test(message)) {
          return respond({ ok: false, error: "Cloudflare Workers AI’ning bugungi bepul limiti tugagan. Keyinroq yana urinib ko‘ring.", code: "AI_DAILY_LIMIT" }, 429);
        }
        if (/timeout|timed out|abort/.test(message)) {
          return respond({ ok: false, error: "AI javobi uzoq ketyapti. Birozdan keyin yana urinib ko‘ring.", code: "AI_TIMEOUT" }, 504);
        }
        return respond({ ok: false, error: "AI javobini tayyorlashda xatolik bo‘ldi. Keyinroq qayta urinib ko‘ring.", code: "AI_MODEL_ERROR" }, 502);
      }
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
