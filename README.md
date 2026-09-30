# Talk Translator v8

Voice-only English ↔ Indonesian live translation using OpenAI Realtime Translation and Cloudflare Workers.

## Cloudflare
- Worker name: `talk-translator`
- Build command: none
- Deploy command: `npx wrangler deploy`
- Secret required: `OPENAI_API_KEY`

The OpenAI API key stays server-side. The browser receives only a short-lived client secret.
