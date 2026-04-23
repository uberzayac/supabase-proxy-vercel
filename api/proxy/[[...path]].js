// api/[[...path]].js
export const config = { runtime: 'edge' };

// Ваш реальный Supabase-проект (из вашего JWT)
const TARGET = 'https://yusvsnpjvbjntafzownp.supabase.co';

export default async function handler(req) {
  const url = new URL(req.url);
  // Убираем /api из пути, чтобы получить чистый REST-путь Supabase
  const path = url.pathname.replace(/^\/api/, '') + url.search;
  const targetUrl = `${TARGET}${path}`;

  // Копируем заголовки клиента, исключая hop-by-hop
  const headers = new Headers();
  for (const [key, value] of req.headers.entries()) {
    const k = key.toLowerCase();
    if (!['host', 'connection', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for'].includes(k)) {
      headers.set(key, value);
    }
  }
  headers.set('Host', new URL(TARGET).host);

  // Обработка preflight-запросов (CORS)
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization,apikey,Prefer,X-Client-Info,Accept,Range',
        'Access-Control-Max-Age': '86400'
      }
    });
  }

  try {
    const res = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? req.body : undefined
    });

    const resHeaders = new Headers();
    for (const [key, value] of res.headers.entries()) {
      const k = key.toLowerCase();
      if (!['transfer-encoding', 'connection', 'content-encoding'].includes(k)) {
        resHeaders.set(key, value);
      }
    }
    // Разрешаем CORS для браузера
    resHeaders.set('Access-Control-Allow-Origin', '*');

    return new Response(res.body, {
      status: res.status,
      headers: resHeaders
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: 'Proxy failed' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }
}
