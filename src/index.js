const OPENAI_URL = 'https://api.openai.com/v1/realtime/translations/client_secrets';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store',
    },
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/realtime-token') {
      if (request.method !== 'GET') return json({error:'Method not allowed'},405);
      if (!env.OPENAI_API_KEY) return json({error:'OPENAI_API_KEY belum dipasang di Cloudflare Secrets'},500);

      const direction = url.searchParams.get('direction') === 'id-en' ? 'id-en' : 'en-id';
      const targetLanguage = direction === 'en-id' ? 'en' : 'id';
      const rawClientId = url.searchParams.get('client_id') || 'talk-translator-anonymous';
      const safetyIdentifier = await sha256(rawClientId);

      try {
        const response = await fetch(OPENAI_URL, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${env.OPENAI_API_KEY}`,
            'Content-Type': 'application/json',
            'OpenAI-Safety-Identifier': safetyIdentifier,
          },
          body: JSON.stringify({
            session: {
              model: 'gpt-realtime-translate',
              audio: {
                output: { language: targetLanguage },
              },
            },
          }),
        });

        const text = await response.text();
        let data;
        try { data = JSON.parse(text); }
        catch { return json({error:`OpenAI mengembalikan respons tidak valid (${response.status})`},502); }

        if (!response.ok) {
          return json({error:data?.error?.message || `OpenAI error (${response.status})`}, response.status);
        }
        return json({value:data.value, expires_at:data.expires_at});
      } catch (error) {
        return json({error:error?.message || 'Gagal menghubungi OpenAI'},502);
      }
    }

    if (url.pathname === '/health') return json({ok:true, service:'talk-translator'});

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({error:'Asset tidak tersedia'},404);
  },
};
