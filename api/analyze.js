// IA proxy — Supabase JWT bidez autentifikatua
// Proxy IA — autenticado con JWT de Supabase
module.exports = async function handler(req, res) {
  if (req.method !== 'POST')
    return res.status(405).json({ error: 'Metodo hau ez da onartzen.' });

  // ── Autentifikazioa / Autenticación ──────────────────────────────────────
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token)
    return res.status(401).json({ error: 'Ez autentifikatua.' });

  // Egiaztatzen du Supabase-rekin / Verifica el token con Supabase
  const userRes = await fetch(
    `${process.env.SUPABASE_URL}/auth/v1/user`,
    { headers: { Authorization: `Bearer ${token}`, apikey: process.env.SUPABASE_ANON_KEY } }
  ).catch(() => null);

  if (!userRes || !userRes.ok)
    return res.status(401).json({ error: 'Token baliogabea.' });

  // ── Anthropic deia / Llamada a Anthropic ─────────────────────────────────
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey)
    return res.status(503).json({ error: 'AI zerbitzua ez dago konfiguratuta. Gehitu ANTHROPIC_API_KEY Vercel-eko Environment Variables atalean.' });

  const { prompt } = req.body || {};
  if (!prompt || typeof prompt !== 'string')
    return res.status(400).json({ error: 'prompt falta da.' });
  if (prompt.length > 4000)
    return res.status(400).json({ error: 'prompt luzeegia da.' });

  try {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-6',
        max_tokens: 400,
        messages: [{ role: 'user', content: prompt }]
      })
    });
    const data = await r.json();
    if (data.error) return res.status(502).json({ error: data.error.message });
    const text = (data.content || [])
      .filter(c => c.type === 'text')
      .map(c => c.text)
      .join('');
    res.json({ text });
  } catch (e) {
    res.status(500).json({ error: 'Sare errorea: ' + e.message });
  }
};
