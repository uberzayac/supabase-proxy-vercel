// api/proxy/[[...path]].js
export const config = {
  runtime: 'edge', // Edge-функция — быстрее и дешевле
};

const SUPABASE_ORIGIN = 'https://broad-mode-2ec8.hse-ermakova.workers.dev';

export default async function handler(req) {
  const { pathname, search } = new URL(req.url);
  // Извлекаем путь после /api/proxy/
  const path = pathname.replace(/^\/api\/proxy/, '');
  const targetUrl = `${SUPABASE_ORIGIN}${path}${search || ''}`;

  // Копируем заголовки запроса (кроме hop-by-hop)
  const headers = new Headers();
  req.headers.forEach((value, key) => {
    if (!['host', 'connection'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });
  // Явно указываем хост оригинала
  headers.set('Host', new URL(SUPABASE_ORIGIN).host);

  try {
    const response = await fetch(targetUrl, {
      method: req.method,
      headers,
      body: req.method !== 'GET' && req.method !== 'HEAD' ? await req.text() : undefined,
    });

    // Формируем ответ с правильными CORS-заголовками
    const responseHeaders = new Headers();
    response.headers.forEach((value, key) => {
      if (!['transfer-encoding', 'connection'].includes(key.toLowerCase())) {
        responseHeaders.set(key, value);
      }
    });
    
    // 🔥 ВАЖНО: разрешаем CORS для любого источника
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Content-Type, Authorization, apikey, Prefer, X-Client-Info');

    // Обрабатываем preflight-запросы
    if (req.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: responseHeaders,
      });
    }

    return new Response(response.body, {
      status: response.status,
      headers: responseHeaders,
    });

  } catch (error) {
    console.error('Proxy error:', error);
    return new Response(JSON.stringify({ error: 'Proxy failed' }), {
      status: 502,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}
