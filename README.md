# Zuxrash AI — Universal AI + Business AI

Zuxrash AI — ochiq havola orqali hamma foydalanishi mumkin bo‘lgan, o‘zbek tilini afzal ko‘radigan AI chat prototipi.

- **Universal AI** — umumiy savollar, yozish, rejalash va kod bo‘yicha yordam.
- **Business AI** — marketing matni, ijtimoiy tarmoq kontenti, FAQ, mahsulot tavsifi va biznes jarayonlarini rejalash.
- **Public web app** — login talab qilmaydi; suhbatlar hozircha har bir foydalanuvchining brauzerida saqlanadi.

Frontend: HTML/CSS/JavaScript. Backend va inference: Cloudflare Workers AI. Hugging Face yoki OpenRouter API tokeni kerak emas.

## Deployment

Cloudflare Worker hozircha `bekiuz-ai.bekiuz282.workers.dev` manzilida joylashgan, lekin sayt brendi Zuxrash AI. GitHub `main` branch yangilanganda Cloudflare Build sozlangan bo‘lsa, `npx wrangler deploy` bajariladi.

## Public endpoint himoyasi

- Brauzer identifikatori uchun daqiqasiga 10 so‘rov.
- Bir tarmoq/IP uchun daqiqasiga 60 so‘rov.
- So‘rov matnlari va chat tarixiga o‘lcham cheklovi.
- Cheklovlar Cloudflare’ning per-location, eventual-consistency rate limiteridan foydalanadi; bu mukammal global hisoblagich yoki autentifikatsiya emas. Ko‘p odam bir xil tarmoqda bo‘lsa, umumiy tarmoq limiti ularga ta’sir qilishi mumkin.

- Rate limiting docs: https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/

## Bepul limit

Cloudflare Workers AI bepul rejasi kuniga **10,000 Neuron** beradi; limit UTC 00:00 da yangilanadi. Bu cheksiz foydalanish emas. Kunlik kvota to‘lsa, suhbatlar vaqtincha javob bermasligi mumkin.

- Workers AI pricing: https://developers.cloudflare.com/workers-ai/platform/pricing/
- Workers AI model: https://developers.cloudflare.com/workers-ai/models/llama-3.1-8b-instruct-fp8/

## Privacy

- Chat tarixi foydalanuvchining brauzeridagi `localStorage`da qoladi; serverda foydalanuvchi akkaunti yoki cloud chat history yo‘q.
- Xabarlar model javobi uchun Cloudflare Workers AI’ga yuboriladi.
- Anti-abuse rate limiting uchun Cloudflare kiruvchi so‘rovning IP manzili va brauzer identifikatoridan foydalanadi. Dastur IP manzilini chat tarixiga saqlamaydi.
- Parol, API kaliti va boshqa maxfiy ma’lumotlarni chatga yozmang.

## Current limitations

- Web search, file upload, image understanding, voice, account login, cross-device sync, and payment tiers are not implemented yet.
- Keng ommaga e’lon qilishdan oldin foydalanish shartlari, maxfiylik sahifasi va kuchliroq abuse controls qo‘shilishi tavsiya etiladi.

## Files

- `public/index.html` — interface
- `public/styles.css` — responsive design
- `public/app.js` — chat, history, per-browser identifier
- `src/index.js` — Cloudflare Worker backend
- `wrangler.toml` — Workers AI + rate limiting bindings
