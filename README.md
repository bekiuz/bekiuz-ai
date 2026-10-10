# Bekiuz AI — Universal + Business AI

Bekiuz Company uchun mobilga mos AI chat MVP.

- **Universal AI** — umumiy savollar, yozish, rejalash va kod bo‘yicha yordam.
- **Business AI** — marketing matni, ijtimoiy tarmoq kontenti, FAQ, mahsulot tavsifi va biznes jarayonlarini rejalash.

Frontend: HTML/CSS/JavaScript. Backend: Cloudflare Workers. Model API: Hugging Face Inference Providers. Yangi Hugging Face Space shart emas — mavjud Cloudflare Worker sayt va backendni birga xizmat qiladi.

## Bir marta sozlash

1. Hugging Face tokenlarini yaratish sahifasini oching: https://huggingface.co/settings/tokens
2. Fine-grained token yarating va **Make calls to Inference Providers** ruxsatini tanlang.
3. Cloudflare Dashboard → **Workers & Pages** → **bekiuz-ai** → **Settings** → **Variables and Secrets** → **Add**.
4. Type: **Secret**, name: `HF_TOKEN`, value: tokeningiz.
5. **Deploy** tugmasini bosing.
6. Saytni ochib `/api/health` endpointini tekshiring. `configured: true` bo‘lsa, token serverga ulangan.

Tokenni hech qachon GitHub, frontend JavaScript yoki chatga yozmang.

## Model va kvota

Standart model: `google/gemma-2-2b-it:fastest`. Uni `wrangler.toml` faylidagi `HF_MODEL` orqali almashtirish mumkin.

Hugging Face Free foydalanuvchilar uchun hozir oyiga **$0.10 Inference Providers krediti** beradi; bu miqdor o‘zgarishi mumkin va cheksiz foydalanish emas. Kvota tugasa, ilova foydalanuvchiga xabar beradi. Model mavjudligi va provayder limiti ham o‘zgarishi mumkin.

- Hugging Face Inference Providers: https://huggingface.co/docs/inference-providers/tasks/chat-completion
- Tariflar: https://huggingface.co/docs/inference-providers/pricing
- Cloudflare Worker Secrets: https://developers.cloudflare.com/workers/configuration/secrets/

## Mahalliy test

1. `.dev.vars.example` faylidan `.dev.vars` nusxa yarating.
2. `HF_TOKEN` qiymatini mahalliy server uchun kiriting.
3. `npm install`
4. `npm run dev`

Maxfiy `.dev.vars` GitHub'ga yuborilmasligi kerak.

## Hozirgi cheklovlar

- Suhbatlar hozircha brauzerning `localStorage` xotirasida saqlanadi; akkaunt va bulutli sinxronlash yo‘q.
- Veb-qidiruv, rasm tahlili va ovoz funksiyalari hali qo‘shilmagan.
- Xabarlar AI javobini ishlab chiqarish uchun Hugging Face Inference Providers orqali yuboriladi. Parol yoki maxfiy ma'lumot yubormang.
- Ommaga keng chiqarishdan oldin autentifikatsiya va so‘rovlar uchun server-side limit qo‘shish ma’qul.

## Fayllar

- `public/index.html` — interfeys
- `public/styles.css` — responsive dizayn
- `public/app.js` — chat, tarix va API chaqiruvi
- `src/index.js` — Cloudflare Worker backend
- `wrangler.toml` — deployment sozlamalari
