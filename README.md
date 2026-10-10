---
title: Bekiuz AI
emoji: "✳"
colorFrom: purple
colorTo: pink
sdk: docker
app_port: 7860
pinned: false
---

# Bekiuz AI — Universal + Business AI

Bekiuz AI is a responsive Uzbek-first AI chat app with two modes:

- **Universal AI** — general questions, writing, planning, and coding help.
- **Business AI** — social posts, product descriptions, FAQs, customer replies, and workflows.

## Deployment

This branch is prepared for a Hugging Face Docker Space and uses the Hugging Face Inference Providers chat-completions API. It does not use OpenRouter.

1. Create a Hugging Face Space and select **Docker** as the SDK.
2. In the Space's **Settings → Variables and secrets**, add a secret named `HF_TOKEN`. Use a fine-grained Hugging Face token with the **Make calls to Inference Providers** permission.
3. To sync this branch from GitHub automatically, create these GitHub Actions repository secrets:
   - `HF_SPACE_REPO`: `your-huggingface-username/your-space-name` (no URL).
   - `HF_SPACE_WRITE_TOKEN`: a separate fine-grained token with write access only to that Space.
4. Run the **Sync Bekiuz AI to Hugging Face Space** workflow from the `huggingface-space` branch, or push a new commit to that branch.
5. Wait for the Space to build, then open its public URL.

Keep both tokens secret. Never paste them into chat, commit them to GitHub, or put them in frontend JavaScript. The inference token and Space-write token are separate so the running app does not need repository-write permission.

## Usage and limits

Hugging Face currently lists **$0.10/month** in Inference Providers credits for free users; the amount and terms can change. This is a small testing allowance, not unlimited free AI. Once it is exhausted, requests may stop until the next allocation or until credits are added. Check the current [pricing page](https://huggingface.co/docs/inference-providers/pricing).

The default model is `google/gemma-2-2b-it:fastest`. To use a different supported chat model, add a Space variable named `HF_MODEL` with a model identifier from the current [chat-completion model documentation](https://huggingface.co/docs/inference-providers/tasks/chat-completion).

## Local development

Requirements: Node.js 22 or newer.

1. Copy `.env.example` to `.env`.
2. Add your own `HF_TOKEN` to `.env`; do not commit that file.
3. Run `npm run dev` and open the local address printed in the terminal (default port 7860).
4. Run `npm run check` to verify JavaScript syntax.

## Security and limitations

- The Hugging Face token is read only by the server; it is never sent to the browser.
- Chat history is currently stored in the browser's `localStorage`. There is no cloud sync or user login.
- Messages sent to the inference endpoint are processed by Hugging Face and the selected inference provider. Do not send passwords or other sensitive information.
- Web search, image uploads, voice features, and cross-device chat sync are not implemented in this MVP.
