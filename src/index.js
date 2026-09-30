const OPENAI_URL = 'https://api.openai.com/v1/realtime/translations/client_secrets';

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}

async function sha256(value) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function createClientSecret(env, direction, clientId) {
  if (!env.OPENAI_API_KEY) return json({error:'OPENAI_API_KEY belum dipasang di Cloudflare Secrets'},500);
  const targetLanguage = direction === 'id-en' ? 'en' : 'id';
  const safetyIdentifier = await sha256(clientId || 'talk-translator-anonymous');

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
          audio: { output: { language: targetLanguage } },
        },
      }),
    });

    const body = await response.text();
    let data = null;
    try { data = body ? JSON.parse(body) : null; } catch {}

    if (!response.ok) {
      const message = data?.error?.message || `OpenAI error (${response.status})`;
      return json({error: message}, response.status);
    }
    if (!data?.value) return json({error:'OpenAI tidak mengembalikan client secret'},502);
    return json({value:data.value, expires_at:data.expires_at});
  } catch (error) {
    return json({error:error?.message || 'Gagal menghubungi OpenAI'},502);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/api/realtime-token') {
      if (!['GET','POST'].includes(request.method)) return json({error:'Method not allowed'},405);
      let direction = url.searchParams.get('direction');
      let clientId = url.searchParams.get('client_id');
      if (request.method === 'POST') {
        try {
          const body = await request.json();
          direction = body?.direction ?? direction;
          clientId = body?.client_id ?? clientId;
        } catch {}
      }
      direction = direction === 'id-en' ? 'id-en' : 'en-id';
      return createClientSecret(env, direction, clientId);
    }

    if (url.pathname === '/health') return json({ok:true, service:'talk-translator', version:'8'});

    if (env.ASSETS) return env.ASSETS.fetch(request);
    return json({error:'Asset tidak tersedia'},404);
  },
};
