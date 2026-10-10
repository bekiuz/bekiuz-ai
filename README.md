# Bekiuz AI — Universal + Business AI

Bekiuz Company uchun mobilga mos AI chat MVP.

- **Universal AI** — umumiy savollar, yozish, rejalash va kod bo‘yicha yordam.
- **Business AI** — marketing matni, ijtimoiy tarmoq kontenti, FAQ, mahsulot tavsifi va biznes jarayonlarini rejalash.

Frontend: HTML/CSS/JavaScript. Backend va model inference: Cloudflare Workers AI. Alohida Hugging Face yoki OpenRouter API tokeni kerak emas.

## Cloudflare sozlamasi

Worker Wrangler binding sozlamasinda Workers AI quyidagicha ulangan:

```toml
[ai]
binding = "AI"

[vars]
AI_MODEL = "@cf/meta/llama-3.1-8b-instruct-fp8"
```

GitHub’dagi `main` branch yangilanganda Cloudflare Build sozlangan bo‘lsa, `npx wrangler deploy` avtomatik bajariladi. Build tugagach, `/api/health` endpointini oching. `configured: true` va `provider: "Cloudflare Workers AI"` chiqishi kerak.

- Workers AI bindings: https://developers.cloudflare.com/workers-ai/configuration/bindings/
- Model ma’lumoti va misol: https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/
- Tarif va bepul limit: https://developers.cloudflare.com/workers-ai/platform/pricing/

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
- Ommaga keng chiqarishdan oldin autentifikatsiya va server-side request limitlari qo‘shilishi tavsiya etiladi.

## Fayllar

- `public/index.html` — interfeys
- `public/styles.css` — responsive dizayn
- `public/app.js` — chat, tarix va API chaqiruvi
- `src/index.js` — Cloudflare Worker backend
- `wrangler.toml` — Workers AI binding va deployment sozlamalari
