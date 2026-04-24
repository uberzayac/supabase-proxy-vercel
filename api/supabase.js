export default async function handler(req, res) {
  const supabaseUrl = `https://yusvsnpjvbjntafzownp.supabase.co${req.url}`;
  
  const response = await fetch(supabaseUrl, {
    method: req.method,
    headers: req.headers,
    body: req.method !== 'GET' ? JSON.stringify(req.body) : undefined,
  });
  
  const data = await response.json();
  res.status(response.status).json(data);
}
