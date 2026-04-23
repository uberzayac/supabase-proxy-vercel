// api/[[...path]].js
export const config = {
  runtime: 'edge',
};

const TARGET = 'https://yusvsnpjvbjntafzownp.supabase.co';

export default async function handler(request) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/^\/api/, '') + url.search;
  const targetUrl = `${TARGET}${path}`;

  // Preflight
  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,PATCH,OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, Prefer, X-Client-Info, Accept, Range, X-Supabase-Team, sdk-version, x-client-info, x-supabase-api-version',
        'Access-Control-Max-Age': '86400',
      },
    });
  }

  // Копируем заголовки
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    const skip = ['host', 'connection', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'content-length'];
    if (!skip.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  headers.set('Host', new URL(TARGET).host);

  try {
    // 🔥 Читаем тело запроса ТОЛЬКО если нужно
    let body = null;
    if (['POST', 'PUT', 'PATCH'].includes(request.method)) {
      body = await request.clone().text();
    }

    // Запрос к Supabase
    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
    });

    // 🔥 Читаем ответ как текст/JSON
    const responseText = await response.text();
    
    // Копируем заголовки ответа
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const skip = ['transfer-encoding', 'connection', 'content-encoding', 'content-length'];
      if (!skip.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // CORS заголовки
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Content-Type', response.headers.get('Content-Type') || 'application/json');

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
