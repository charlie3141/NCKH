const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Get environment variables
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  const FIREBASE_URL = process.env.VITE_FIREBASE_URL;
  const FIREBASE_LOGS_URL = process.env.VITE_FIREBASE_LOGS_URL || FIREBASE_URL.replace('/sensorData.json', '/logs.json');

  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const path = event.path.replace('/.netlify/functions/proxy', '');
    
    // Route 1: Get sensor data from Firebase
    if (event.httpMethod === 'GET' && path === '/sensor') {
      if (!FIREBASE_URL) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Firebase URL not configured" })
        };
      }

      const response = await fetch(FIREBASE_URL);
      const data = await response.json();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: "Success", 
          sensorData: data
        }),
      };
    }

    // Route 2: Post logs/events to Firebase
    if (event.httpMethod === 'POST' && path === '/log') {
      if (!FIREBASE_LOGS_URL) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Firebase logs URL not configured" })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { eventName, eventData, userInfo, timestamp } = body;

      if (!eventName) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Event name is required" })
        };
      }

      const logEntry = {
        event: eventName,
        data: eventData || {},
        userInfo: userInfo || { userAgent: event.headers['user-agent'] },
        timestamp: timestamp || new Date().toISOString(),
        ip: event.headers['client-ip'] || 'unknown'
      };

      const response = await fetch(FIREBASE_LOGS_URL, {
        method: 'POST',
        body: JSON.stringify(logEntry),
        headers: {
          'Content-Type': 'application/json'
        }
      });

      const result = await response.json();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          message: "Log posted successfully",
          logId: result.name
        })
      };
    }

    // Route 3: Translate with Gemini
    if (event.httpMethod === 'POST' && path === '/translate') {
      if (!GEMINI_API_KEY) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Gemini API key not configured" })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { text, sourceLang, targetLang } = body;

      if (!text) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Text is required" })
        };
      }

      const sourceName = getLanguageName(sourceLang);
      const targetName = getLanguageName(targetLang);

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate from ${sourceName} to ${targetName}.\nPreserve context and meaning.\nOutput only the translation, no explanations.\n\nText: "${text}"`
            }]
          }],
          generationConfig: {
            temperature: 0.1,
            topP: 0.8,
            topK: 40
          }
        })
      });

      const data = await response.json();
      let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";

      // Clean up response
      translated = translated.replace(/^["']|["']$/g, '');
      translated = translated.replace(/^Translation:|Result:|Dịch:/i, '').trim();

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ translated })
      };
    }

    // Route 4: TTS with Gemini
    if (event.httpMethod === 'POST' && path === '/tts') {
      if (!GEMINI_API_KEY) {
        return {
          statusCode: 500,
          headers,
          body: JSON.stringify({ error: "Gemini API key not configured" })
        };
      }

      const body = JSON.parse(event.body || '{}');
      const { text } = body;

      if (!text) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Text is required" })
        };
      }

      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-exp-tts:generateContent?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{
            parts: [{ text }]
          }],
          generationConfig: {
            response_modalities: ["AUDIO"],
            audio_config: {
              audio_encoding: "MP3",
              speaking_rate: 1.0,
              pitch: 0,
              volume_gain_db: 0,
              effects_profile_id: ["headphone-class-device"]
            }
          }
        })
      });

      const data = await response.json();
      const audioContent = data.audioContent;

      if (!audioContent) {
        throw new Error("No audio content received");
      }

      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ audioContent })
      };
    }

    // Default: Not found
    return {
      statusCode: 404,
      headers,
      body: JSON.stringify({ error: "Endpoint not found" })
    };

  } catch (error) {
    console.error("Proxy error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: error.message })
    };
  }
};

// Helper function to get language names
function getLanguageName(langCode) {
  const languageNames = {
    "vi-VN": "Vietnamese",
    "en-GB": "English",
    "ja-JP": "Japanese",
    "ko-KR": "Korean",
    "zh-CN": "Chinese"
  };
  return languageNames[langCode] || langCode;
}
