# Bekiuz AI — Universal + Business AI

Bekiuz Company uchun mobilga mos AI MVP. Bitta ilovada ikki rejim mavjud:

- **Universal AI** — umumiy savollar, yozish, rejalash va kod bo‘yicha yordam.
- **Business AI** — marketing matni, ijtimoiy tarmoq kontenti, FAQ, mahsulot tavsifi va biznes jarayonlarini rejalash.

Frontend: HTML/CSS/JavaScript. Backend: Cloudflare Worker. AI: OpenRouter Free Models Router (`openrouter/free`). Build bosqichi talab qilinmaydi.

## Mahalliy ishga tushirish

Talablar: Node.js LTS va npm.

1. Repozitoriyani yuklab, terminalni loyiha papkasida oching.
2. Paketlarni o‘rnating: `npm install`
3. OpenRouter API key yarating: https://openrouter.ai/keys
4. `.dev.vars.example` faylidan `.dev.vars` nusxa yarating va `OPENROUTER_API_KEY` qiymatini o‘zingizning kalitingiz bilan almashtiring. Bu fayl Git’ga yuborilmasligi kerak.
5. `npm run dev` buyrug‘ini bajaring.
6. Terminal ko‘rsatgan localhost manzilini oching.

## Cloudflare Workers'ga chiqarish

1. Cloudflare hisobingizga kiring.
2. Terminalda autentifikatsiya qiling: `npx wrangler login`
3. API kalitini maxfiy secret sifatida qo‘shing: `npx wrangler secret put OPENROUTER_API_KEY`
4. So‘ralganda kalitni terminalga kiriting. Uni frontend, `wrangler.toml` yoki GitHub'ga yozmang.
5. Deploy qiling: `npm run deploy`
6. `/api/health` endpointini tekshiring.

## Bepul AI va cheklovlar

Standart model `openrouter/free`. U mos bepul modelni tanlaydi. Bepul model mavjudligi, javob tezligi va limitlari o‘zgarishi mumkin. Bu cheksiz foydalanish kafolati emas.

- OpenRouter Free Router: https://openrouter.ai/docs/guides/routing/routers/free-router
- Cloudflare static assets: https://developers.cloudflare.com/workers/static-assets/
- Cloudflare Workers secrets: https://developers.cloudflare.com/workers/configuration/secrets/

## Maxfiylik va hozirgi cheklovlar

- API kaliti faqat serverdagi secretda saqlanishi kerak.
- Suhbatlar foydalanuvchining brauzeridagi `localStorage`'da saqlanadi; bulutli tarix va akkauntlar hozircha yo‘q.
- Xabarlar javob olish uchun OpenRouter'ga yuboriladi; sezgir ma'lumot yubormang.
- Hozircha autentifikatsiya va individual server-side limitlar yo‘q. Ommaga keng chiqarishdan oldin bularni qo‘shish kerak.
- Bepul router tanlagan modelga qarab javob sifati va uslubi farqlanishi mumkin.

## Fayllar

- `public/index.html` — interfeys
- `public/styles.css` — responsive dizayn
- `public/app.js` — chat, tarix va API chaqiruvi
- `src/index.js` — Cloudflare Worker backend
- `wrangler.toml` — deployment sozlamalari
