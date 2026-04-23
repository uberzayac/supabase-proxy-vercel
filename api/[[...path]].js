// api/[[...path]].js
export const config = {
  runtime: 'edge',
};

const TARGET = 'https://yusvsnpjvbjntafzownp.supabase.co';

export default async function handler(request) {
  const url = new URL(request.url);
  
  // Убираем /api из пути
  const path = url.pathname.replace(/^\/api/, '') + url.search;
  const targetUrl = `${TARGET}${path}`;

  // 🔥 ОБЯЗАТЕЛЬНО: preflight запрос
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

  // 🔥 Копируем ВСЕ заголовки включая apikey
  const headers = new Headers();
  request.headers.forEach((value, key) => {
    // Пропускаем только hop-by-hop заголовки
    const skipHeaders = ['host', 'connection', 'cf-connecting-ip', 'cf-ray', 'x-forwarded-for', 'x-forwarded-proto', 'x-real-ip', 'content-length'];
    if (!skipHeaders.includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  
  // Явно устанавливаем хост Supabase
  headers.set('Host', new URL(TARGET).host);

  try {
    // 🔥 Получаем тело запроса
    let body = null;
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      body = await request.text();
    }

    const response = await fetch(targetUrl, {
      method: request.method,
      headers,
      body,
      redirect: 'manual',
    });

    // Копируем заголовки ответа
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      const skipHeaders = ['transfer-encoding', 'connection', 'content-encoding'];
      if (!skipHeaders.includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });

    // 🔥 ДОБАВЛЯЕМ CORS заголовки
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, X-Client-Info, Accept, Range, X-Supabase-Team, sdk-version, x-client-info, x-supabase-api-version');

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
