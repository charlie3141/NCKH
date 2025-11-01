// netlify/functions/tts.js
const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  try {
    const text = (event.queryStringParameters && event.queryStringParameters.text)
                  || (event.body && JSON.parse(event.body).text);
    if (!text || !text.trim()) {
      return { statusCode: 400, body: 'missing text' };
    }
    const ELEVEN_KEY = process.env.ELEVEN_API_KEY;
    const VOICE_ID = process.env.ELEVEN_VOICE_ID || 'vi'; // set proper voice id in Netlify env

    if (!ELEVEN_KEY) return { statusCode: 500, body: 'server missing ELEVEN_API_KEY' };

    const payload = {
      text: text,
      // optional: tuning for ElevenLabs, feel free to change or remove
      voice_settings: { stability: 0.6, similarity_boost: 0.75 }
    };

    const resp = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(VOICE_ID)}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'xi-api-key': ELEVEN_KEY
      },
      body: JSON.stringify(payload)
    });

    if (!resp.ok) {
      const t = await resp.text();
      return { statusCode: resp.status, body: t || 'elevenlabs error' };
    }

    const arrayBuffer = await resp.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'audio/mpeg',
        'Cache-Control': 'no-store'
      },
      isBase64Encoded: true,
      body: buffer.toString('base64')
    };
  } catch (err) {
    console.error('tts func err', err);
    return { statusCode: 500, body: 'internal error' };
  }
};
