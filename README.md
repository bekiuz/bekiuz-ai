# Bekiuz AI — Universal + Business AI

Bekiuz Company uchun mobilga mos AI chat MVP. BEKIUZ BUILD uy rejalashtirish prototipi ham shu mavjud Worker’dan AI tavsiyalarini oladi.

- **Universal AI** — umumiy savollar, yozish, rejalash va kod bo‘yicha yordam.
- **Business AI** — marketing matni, ijtimoiy tarmoq kontenti, FAQ, mahsulot tavsifi va biznes jarayonlarini rejalash.
- **BEKIUZ BUILD Planner API** — uy talablari asosida konseptual parametrlar va tavsiyalar qaytaradi.

Frontend: HTML/CSS/JavaScript. Backend va model inference: Cloudflare Workers AI. Alohida Gemini, Hugging Face yoki OpenRouter API tokeni talab qilinmaydi.

## Cloudflare sozlamasi

Worker Wrangler binding sozlamasida Workers AI quyidagicha ulangan:

```toml
[ai]
binding = "AI"

[vars]
AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8"
```

- Health check: `GET /api/health`
- Universal / Business chat: `POST /api/chat`
- BEKIUZ BUILD planner: `POST /api/plan`

Planner so‘rovining JSON ko‘rinishi:

```json
{
  "prompt": "4 xonali, bir qavatli oilaviy uy",
  "project": {
    "plotWidth": 20,
    "plotLength": 30,
    "houseWidth": 10,
    "houseLength": 14,
    "floors": 1,
    "rooms": 4,
    "roofType": "gable"
  }
}
```

Planner javobi tasdiqlangan arxitektura chizmasi emas. U konseptual tavsiyalar va yer o‘lchamiga moslashtirilgan parametrlarni qaytaradi. Poydevor, konstruksiya, elektr va quvur yechimlari mutaxassis tomonidan tekshirilishi kerak. Material narxlari uchun ishonchli hududiy katalog ulanmadi; model aniq smeta narxini o‘ylab topmasligi so‘raladi.

## Avtomatik deploy

GitHub Actions workflow `.github/workflows/deploy-worker.yml` Worker’ni deploy qiladi, lekin buning uchun repo Actions secrets quyidagicha sozlangan bo‘lishi kerak:

- `CLOUDFLARE_API_TOKEN`
- `CLOUDFLARE_ACCOUNT_ID`

Ularni [Bekiuz AI repository Actions secrets](https://github.com/bekiuz/bekiuz-ai/settings/secrets/actions) bo‘limida yarating. Secret qiymatlarini kodga yozmang, GitHub commitiga qo‘shmang va chatga yubormang. Hozirgi house planner route commitidagi deploy workflow bajarilgan bo‘lsa ham, credentiallar yo‘qligi sababli deploy bosqichlari **skipped** bo‘lgan; yangi kodni ishga tushirish uchun secrets qo‘shib, [Deploy Bekiuz AI Worker workflow](https://github.com/bekiuz/bekiuz-ai/actions/workflows/deploy-worker.yml) ni qayta ishga tushiring.

Deploy muvaffaqiyatli tugagach, `/api/health` manzilida `configured: true` va `provider: "Cloudflare Workers AI"` chiqishini tekshiring. BEKIUZ BUILD sayti planner uchun ushbu Worker’dan foydalanadi.

## Bepul limit

Cloudflare Workers AI bepul rejasi kuniga **10,000 Neuron** ajratadi. Limit **00:00 UTC** da yangilanadi. Bu cheksiz foydalanish emas; kunlik limit tugasa, so‘rovlar keyingi resetgacha ishlamasligi mumkin.

## Mahalliy ishga tushirish

1. Node.js LTS va npm o‘rnating.
2. Repozitoriyani yuklab oling va terminalni loyiha papkasida oching.
3. `npm install`
4. `npx wrangler login`
5. `npm run dev`

Workers AI mahalliy `wrangler dev` testlarida ham Cloudflare hisobingiz orqali ishlaydi.

## Maxfiylik va cheklovlar

- AI API tokenini frontendga yoki GitHub’ga qo‘yish talab qilinmaydi.
- Suhbatlar brauzerning `localStorage` xotirasida saqlanadi; bulutli tarix va akkauntlar yo‘q.
- Xabarlar javob ishlab chiqarish uchun Cloudflare Workers AI’ga uzatiladi; parol yoki boshqa maxfiy ma’lumot yubormang.
- Veb-qidiruv, rasm tahlili va ovoz funksiyalari hali qo‘shilmagan.
- Planner va chat uchun server-side limitlar mavjud; bu to‘liq akkaunt tizimining o‘rnini bosmaydi.

## Fayllar

- `public/index.html` — Bekiuz AI interfeysi
- `public/styles.css` — responsive dizayn
- `public/app.js` — chat, tarix va API chaqiruvi
- `src/index.js` — Cloudflare Worker backend va planner route
- `wrangler.toml` — Workers AI binding va deployment sozlamalari

Official references: [Workers AI bindings](https://developers.cloudflare.com/workers-ai/configuration/bindings/), [Workers AI model](https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/), [Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/).
