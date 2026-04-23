// api/[[...path]].js
export const config = { runtime: 'edge' };

const TARGET = 'https://yusvsnpjvbjntafzownp.supabase.co';

// 🔥 ВСЕ заголовки, которые может отправить Supabase JS-клиент
const ALLOWED_HEADERS = [
  'Content-Type', 'Authorization', 'apikey', 'Prefer', 'X-Client-Info',
  'Accept', 'Range', 'X-Supabase-Team', 'sdk-version', 'x-client-info',
  'x-supabase-api-version', 'accept-profile', 'content-profile',
  'x-retry-count', 'X-Http-Method-Override', 'If-None-Match', 'If-Match'
].join(', ');

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') + url.search;
  const targetUrl = `${TARGET}${path}`;

  // 🔥 Preflight (OPTIONS) — ОБЯЗАТЕЛЬНО первым
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': ALLOWED_HEADERS,
        'Access-Control-Expose-Headers': 'Content-Range, X-Total-Count, Link',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // 🔥 Копируем ВСЕ заголовки запроса (кроме hop-by-hop)
  const headers = new Headers();
  const skipHeaders = ['host', 'connection', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'content-length', 'transfer-encoding'];
  
  for (const [key, value] of request.headers.entries()) {
    const k = key.toLowerCase();
    if (!skipHeaders.includes(k)) {
      headers.set(key, value);
    }
  }
  // Явно устанавливаем хост Supabase
  headers.set('Host', new URL(TARGET).host);

  try {
    // 🔥 Читаем тело ТОЛЬКО для методов с телом
    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      body = await request.clone().text();
    }

    // Запрос к реальному Supabase
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });

    // 🔥 Читаем ответ как текст (критично для Edge Runtime!)
    const responseText = await response.text();
    
    // Копируем заголовки ответа
    const responseHeaders = new Headers();
    const skipRespHeaders = ['transfer-encoding', 'connection', 'content-encoding', 'content-length'];
    
    for (const [key, value] of response.headers.entries()) {
      const k = key.toLowerCase();
      if (!skipRespHeaders.includes(k)) {
        responseHeaders.set(key, value);
      }
    }

    // 🔥 ДОБАВЛЯЕМ CORS-заголовки к ответу
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Range, X-Total-Count, Link');

    return new Response(responseText, {
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
