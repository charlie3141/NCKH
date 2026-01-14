// netlify/functions/translate.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  const GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent";
  
  if (!GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Gemini API key not configured" }),
    };
  }

  try {
    const { text, sourceLang, targetLang } = JSON.parse(event.body);
    
    if (!text || !sourceLang || !targetLang) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Missing required parameters: text, sourceLang, targetLang" }),
      };
    }

    // Prepare prompt for Gemini
    const prompt = `Hãy dịch văn bản sau từ ${sourceLang} sang ${targetLang}. Chỉ trả về bản dịch cuối cùng, không thêm bất kỳ giải thích nào.
Văn bản: "${text}"`;
    
    // Call Gemini API
    const response = await axios.post(
      `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
      {
        contents: [{
          parts: [{ text: prompt }]
        }]
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    // Extract translation
    const translatedText = response.data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || text;
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        originalText: text,
        translatedText: translatedText,
        sourceLang: sourceLang,
        targetLang: targetLang
      }),
    };
  } catch (error) {
    console.error('Translation error:', error.response?.data || error.message);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.response?.data?.error?.message || error.message || "Translation failed"
      }),
    };
  }
};
