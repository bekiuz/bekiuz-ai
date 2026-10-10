import http from "node:http";
import path from "node:path";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.resolve(ROOT, "public");
const PORT = Number(process.env.PORT || 7860);
const DEFAULT_MODEL = "google/gemma-2-2b-it:fastest";
const MAX_BODY_BYTES = 80_000;

const GENERAL_SYSTEM_PROMPT = "You are Bekiuz AI, a helpful multilingual assistant. Reply in the language the user uses, and prefer natural Uzbek when they write Uzbek. Be accurate, clear, respectful, and practical. If unsure, say so rather than inventing facts. For coding requests, provide working code and concise explanations. Never claim you browsed the web or performed real-world actions unless tools actually did so.";

const BUSINESS_SYSTEM_PROMPT = "You are Bekiuz Business AI, an assistant for small businesses, designers, freelancers, and teams. Reply in the user's language, and prefer natural Uzbek for Uzbek messages. Help create social media captions, advertisements, product descriptions, customer-support replies, FAQs, content calendars, project proposals, and simple workflow plans. Never invent prices, guarantees, testimonials, or business facts. State assumptions when details are missing. Avoid promising guaranteed sales or results.";

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".ico": "image/x-icon"
};

function sendJson(response, data, status = 200) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "X-Frame-Options": "DENY"
  });
  response.end(JSON.stringify(data));
}

function apiError(response, status, error, code) {
  sendJson(response, { ok: false, error, code }, status);
}

function cleanHistory(input) {
  if (!Array.isArray(input)) return [];
  return input
    .filter((message) =>
      message &&
      (message.role === "user" || message.role === "assistant") &&
      typeof message.content === "string"
    )
    .slice(-12)
    .map((message) => ({
      role: message.role,
      content: message.content.trim().slice(0, 12000)
    }))
    .filter((message) => message.content.length > 0);
}

async function readJsonBody(request) {
  const chunks = [];
  let totalBytes = 0;
  let tooLarge = false;

  for await (const chunk of request) {
    totalBytes += chunk.length;
    if (totalBytes > MAX_BODY_BYTES) {
      tooLarge = true;
    } else {
      chunks.push(chunk);
    }
  }

  if (tooLarge) {
    const error = new Error("So‘rov hajmi juda katta.");
    error.status = 413;
    error.code = "REQUEST_TOO_LARGE";
    throw error;
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    const error = new Error("So‘rov JSON formatida emas.");
    error.status = 400;
    error.code = "INVALID_JSON";
    throw error;
  }
}

async function handleChat(request, response) {
  if (request.method !== "POST") {
    return apiError(response, 405, "Faqat POST so‘rovi qabul qilinadi.", "METHOD_NOT_ALLOWED");
  }

  const token = process.env.HF_TOKEN;
  if (!token) {
    return apiError(
      response,
      503,
      "AI tokeni serverda sozlanmagan. Space Settings ichidagi Secrets bo‘limini tekshiring.",
      "HF_TOKEN_NOT_CONFIGURED"
    );
  }

  let body;
  try {
    body = await readJsonBody(request);
  } catch (error) {
    return apiError(
      response,
      error.status || 400,
      error.message || "So‘rovni o‘qib bo‘lmadi.",
      error.code || "INVALID_JSON"
    );
  }

  const mode = body && body.mode === "business" ? "business" : "general";
  const messages = cleanHistory(body && body.messages);
  if (!messages.length || messages[messages.length - 1].role !== "user") {
    return apiError(response, 400, "Yuboriladigan xabar topilmadi.", "INVALID_MESSAGES");
  }

  const systemPrompt = mode === "business" ? BUSINESS_SYSTEM_PROMPT : GENERAL_SYSTEM_PROMPT;
  const model = typeof process.env.HF_MODEL === "string" && process.env.HF_MODEL.trim()
    ? process.env.HF_MODEL.trim()
    : DEFAULT_MODEL;

  let upstream;
  try {
    upstream = await fetch("https://router.huggingface.co/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "system", content: systemPrompt }, ...messages],
        temperature: 0.65,
        max_tokens: 1000,
        stream: false
      }),
      signal: AbortSignal.timeout(45_000)
    });
  } catch (error) {
    const timedOut = error && (error.name === "TimeoutError" || error.name === "AbortError");
    return apiError(
      response,
      timedOut ? 504 : 502,
      timedOut
        ? "AI javobi uzoq ketyapti. Birozdan keyin qayta urinib ko‘ring."
        : "AI xizmatiga ulanib bo‘lmadi. Internet ulanishini tekshirib, qayta urinib ko‘ring.",
      timedOut ? "UPSTREAM_TIMEOUT" : "UPSTREAM_ERROR"
    );
  }

  const result = await upstream.json().catch(() => ({}));
  if (!upstream.ok) {
    if (upstream.status === 401 || upstream.status === 403) {
      return apiError(response, 502, "Hugging Face tokeni yoki uning ruxsatlari noto‘g‘ri. Server Secret sozlamasini tekshiring.", "TOKEN_INVALID");
    }
    if (upstream.status === 402) {
      return apiError(response, 429, "Bepul AI kvotasi tugagan. Keyingi oylik kvotani kuting yoki hisobingizdagi foydalanish limitini tekshiring.", "QUOTA_EXHAUSTED");
    }
    if (upstream.status === 429) {
      return apiError(response, 429, "AI provayderi vaqtinchalik limit qo‘ydi. Birozdan keyin urinib ko‘ring.", "RATE_LIMITED");
    }
    if (upstream.status === 404) {
      return apiError(response, 502, "Tanlangan AI modeli hozir mavjud emas. HF_MODEL sozlamasini tekshirish kerak.", "MODEL_UNAVAILABLE");
    }
    console.error("Hugging Face Inference Providers request failed with status " + upstream.status);
    return apiError(response, 502, "AI provayderi hozir javob bermadi. Birozdan keyin qayta urinib ko‘ring.", "UPSTREAM_ERROR");
  }

  const reply = result && result.choices && result.choices[0] && result.choices[0].message
    ? result.choices[0].message.content
    : null;

  if (typeof reply !== "string" || !reply.trim()) {
    return apiError(response, 502, "AI bo‘sh javob qaytardi. Qayta urinib ko‘ring.", "UPSTREAM_ERROR");
  }

  return sendJson(response, {
    ok: true,
    reply: reply.trim(),
    model: result.model || model
  });
}

async function serveStatic(request, response, pathname) {
  if (request.method !== "GET" && request.method !== "HEAD") {
    response.writeHead(405, { "Allow": "GET, HEAD", "X-Content-Type-Options": "nosniff" });
    response.end("Method not allowed");
    return;
  }

  let decodedPath;
  try {
    decodedPath = decodeURIComponent(pathname);
  } catch {
    response.writeHead(400);
    response.end("Bad request");
    return;
  }

  const relativePath = decodedPath === "/" ? "index.html" : decodedPath.replace(/^\/+/, "");
  const filePath = path.resolve(PUBLIC_DIR, relativePath);
  if (filePath !== PUBLIC_DIR && !filePath.startsWith(PUBLIC_DIR + path.sep)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const contents = await readFile(filePath);
    const contentType = MIME_TYPES[path.extname(filePath).toLowerCase()] || "application/octet-stream";
    response.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": filePath.endsWith("index.html") ? "no-cache" : "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "X-Frame-Options": "DENY"
    });
    if (request.method === "HEAD") response.end();
    else response.end(contents);
  } catch {
    response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8", "X-Content-Type-Options": "nosniff" });
    response.end("Not found");
  }
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://" + (request.headers.host || "localhost"));

  if (url.pathname === "/api/health") {
    if (request.method !== "GET") {
      return apiError(response, 405, "Faqat GET so‘rovi qabul qilinadi.", "METHOD_NOT_ALLOWED");
    }
    return sendJson(response, {
      ok: true,
      configured: Boolean(process.env.HF_TOKEN),
      provider: "Hugging Face Inference Providers",
      model: process.env.HF_MODEL || DEFAULT_MODEL
    });
  }

  if (url.pathname === "/api/chat") {
    return handleChat(request, response);
  }

  if (url.pathname.startsWith("/api/")) {
    return apiError(response, 404, "API endpoint topilmadi.", "NOT_FOUND");
  }

  return serveStatic(request, response, url.pathname);
});

server.listen(PORT, "0.0.0.0", () => {
  console.log("Bekiuz AI listening on port " + PORT);
});
