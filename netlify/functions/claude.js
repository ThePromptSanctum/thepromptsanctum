exports.handler = async function(event) {
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS'
      },
      body: ''
    };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
  const PAYHIP_API_KEY = process.env.PAYHIP_API_KEY;

  if (!ANTHROPIC_API_KEY) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: 'API key not configured' })
    };
  }

  try {
    const body = JSON.parse(event.body);

    if (body.licenseKey) {
      if (!PAYHIP_API_KEY) {
        return {
          statusCode: 500,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ error: 'License validation not configured', valid: false })
        };
      }

      const licenseCheck = await fetch(
        `https://payhip.com/api/v1/license/verify?product_link=${encodeURIComponent(body.productLink || '')}&license_key=${encodeURIComponent(body.licenseKey)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PAYHIP_API_KEY}`,
            'Content-Type': 'application/json'
          }
        }
      );

      const licenseData = await licenseCheck.json();

      if (!licenseData.data || !licenseData.data.enabled) {
        return {
          statusCode: 403,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({
            error: 'Invalid or already used license key. Check your Payhip purchase email.',
            valid: false,
            licenseCheck: true
          })
        };
      }

      if (body.validateOnly) {
        return {
          statusCode: 200,
          headers: { 'Access-Control-Allow-Origin': '*' },
          body: JSON.stringify({ valid: true, licenseCheck: true })
        };
      }
    }

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: body.max_tokens || 1000,
        system: body.system,
        messages: body.messages
      })
    });

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(data)
    };

  } catch (err) {
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ error: err.message })
    };
  }
};
