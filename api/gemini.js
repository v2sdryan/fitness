const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
const GEMINI_MODEL = 'gemini-3.5-flash';

function getApiKey() {
  return (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY || '').trim();
}

function getRequestBody(req) {
  if (!req.body) return {};
  if (typeof req.body === 'string') return JSON.parse(req.body);
  return req.body;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = getApiKey();
  if (!apiKey) {
    return res.status(503).json({ error: 'Gemini API key is not configured on Vercel.' });
  }

  try {
    const { prompt, imageBase64, mimeType } = getRequestBody(req);
    if (!prompt || typeof prompt !== 'string') {
      return res.status(400).json({ error: 'Prompt is required.' });
    }

    const parts = [{ text: prompt }];
    if (imageBase64 && mimeType) {
      parts.unshift({ inline_data: { mime_type: mimeType, data: imageBase64 } });
    }

    const response = await fetch(`${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contents: [{ parts }] }),
    });

    const data = await response.json();
    if (!response.ok) {
      return res.status(response.status).json({
        error: data?.error?.message || 'Gemini API error',
        status: data?.error?.status,
      });
    }

    const text = data?.candidates?.[0]?.content?.parts?.map((part) => part.text || '').join('').trim() || '';
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: error?.message || 'Gemini proxy error' });
  }
}
