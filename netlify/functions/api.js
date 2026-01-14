const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // CORS headers
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  // Lấy biến môi trường
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  const FIREBASE_URL = process.env.VITE_FIREBASE_URL;

  if (!FIREBASE_URL) {
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: "Chưa cấu hình Firebase URL trên Netlify" })
    };
  }

  // Xử lý các endpoint khác nhau
  const { path } = event;
  
  // GET: Lấy dữ liệu từ Firebase
  if (event.httpMethod === 'GET' && path.includes('/api/get-data')) {
    try {
      const response = await fetch(`${FIREBASE_URL}/sensorData.json`);
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          data,
          timestamp: new Date().toISOString()
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  // POST: Ghi log vào Firebase
  if (event.httpMethod === 'POST' && path.includes('/api/log')) {
    try {
      const body = JSON.parse(event.body);
      const { action, data } = body;
      
      if (!action) {
        return {
          statusCode: 400,
          headers,
          body: JSON.stringify({ error: "Action là bắt buộc" })
        };
      }
      
      // Tạo log entry
      const logEntry = {
        action,
        data,
        timestamp: new Date().toISOString(),
        userAgent: event.headers['user-agent'],
        ip: event.headers['x-forwarded-for'] || 'unknown'
      };
      
      // Gửi log lên Firebase
      const logResponse = await fetch(`${FIREBASE_URL}/logs.json`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(logEntry)
      });
      
      const result = await logResponse.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: "Đã ghi log",
          logId: result.name 
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  // POST: Dịch với Gemini
  if (event.httpMethod === 'POST' && path.includes('/api/translate')) {
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Chưa cấu hình Gemini API Key" })
      };
    }
    
    try {
      const body = JSON.parse(event.body);
      const { text, sourceLang, targetLang } = body;
      
      const GEMINI_TRANSLATE_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
      
      const sourceName = getLanguageName(sourceLang);
      const targetName = getLanguageName(targetLang);
      
      const response = await fetch(GEMINI_TRANSLATE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `Translate from ${sourceName} to ${targetName}. 
              Maintain natural and formal tone. Output ONLY the translated text, no quotes, no extra notes.
              Text: "${text}"`
            }]
          }]
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
      translated = translated.replace(/^["']|["']$/g, '');
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          translated,
          sourceLang,
          targetLang
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  // POST: TTS với Gemini
  if (event.httpMethod === 'POST' && path.includes('/api/tts')) {
    if (!GEMINI_API_KEY) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: "Chưa cấu hình Gemini API Key" })
      };
    }
    
    try {
      const body = JSON.parse(event.body);
      const { text, voiceName } = body;
      
      const GEMINI_TTS_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${GEMINI_API_KEY}`;
      
      const response = await fetch(GEMINI_TTS_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ 
            role: "user",
            parts: [{ text: `Say this naturally in a clear voice: ${text}` }] 
          }],
          generationConfig: {
            responseModalities: ["AUDIO"],
            speechConfig: {
              voiceConfig: { 
                prebuiltVoiceConfig: { 
                  voiceName: voiceName || "Aoede"
                } 
              }
            }
          }
        })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      const data = await response.json();
      const candidate = data.candidates?.[0];
      const part = candidate.content?.parts?.find(p => p.inlineData && p.inlineData.data);
      const audioData = part?.inlineData?.data;
      
      if (!audioData) {
        throw new Error("Không nhận được dữ liệu âm thanh");
      }
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true,
          audioData
        })
      };
    } catch (error) {
      return {
        statusCode: 500,
        headers,
        body: JSON.stringify({ error: error.message })
      };
    }
  }
  
  return {
    statusCode: 404,
    headers,
    body: JSON.stringify({ error: "Endpoint không tồn tại" })
  };
};

// Helper function
function getLanguageName(langCode) {
  const langMap = {
    "vi-VN": "Vietnamese",
    "en-GB": "English",
    "ja-JP": "Japanese", 
    "ko-KR": "Korean",
    "zh-CN": "Chinese"
  };
  return langMap[langCode] || langCode;
}
