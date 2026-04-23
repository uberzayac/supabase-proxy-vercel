// api/[[...path]].js
export const config = {
  runtime: 'edge',
};

const TARGET = 'https://yusvsnpjvbjntafzownp.supabase.co';

export default async function handler(req) {
  const url = new URL(req.url);
  
  // Убираем /api из пути для проксирования в Supabase
  const path = url.pathname.replace(/^\/api/, '') + url.search;
  const targetUrl = `${TARGET}${path}`;

  // 🔥 ОБЯЗАТЕЛЬНО: обработка preflight (OPTIONS) запросов
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer, X-Client-Info, Accept, Range, X-Supabase-Team, sdk-version, x-client-info',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Копируем заголовки запроса
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    const k = key.toLowerCase();
    // Пропускаем hop-by-hop заголовки
    if (!['host', 'connection', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-proto'].includes(k)) {
      headers.set(key, value);
    }
  }
  headers.set('Host', new URL(TARGET).host);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
      redirect: 'manual',
    });

    // Копируем заголовки ответа
    const responseHeaders = new Headers();
    for (const [key, value] of response.headers.entries()) {
      const k = key.toLowerCase();
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(k)) {
        responseHeaders.set(key, value);
      }
    }

    // 🔥 КРИТИЧНО: добавляем CORS-заголовки к ответу
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, X-Client-Info, Accept, Range, X-Supabase-Team, sdk-version, x-client-info');

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy failed', message: error.message }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
