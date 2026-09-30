# Talk Translator — Cloudflare Worker v0.3

Voice-only English ↔ Indonesian live interpreter using OpenAI Realtime Translation + WebRTC.

## Cloudflare setup

1. Create/use a Worker named `talk-translator`.
2. Deploy this project as a Worker with Static Assets.
3. Add a Worker Secret named `OPENAI_API_KEY` containing your OpenAI API key.
4. Redeploy after adding the secret.
5. Open the Worker URL and test **Mulai Percakapan**.

The standard OpenAI API key stays server-side. The browser receives only a short-lived client secret.

## Local development

```bash
npm install
npx wrangler login
npx wrangler dev
```

For local secrets, create `.dev.vars`:

```text
OPENAI_API_KEY=your_key_here
```

## Architecture

- `public/` = existing voice-only UI and PWA files.
- `src/index.js` = Cloudflare Worker API.
- `/api/realtime-token` = mints a short-lived OpenAI Realtime Translation client secret.
- Browser WebRTC connects to `https://api.openai.com/v1/realtime/translations/calls`.

## Important

Do not put `OPENAI_API_KEY` inside `public/app.js`, HTML, or any file served to the browser.

Cloudflare deployment test
