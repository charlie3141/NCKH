const fetch = require('node-fetch');

exports.handler = async function(event, context) {
  // Chỉ cho phép POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Lấy API key từ biến môi trường
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
  if (!GEMINI_API_KEY) {
    return { statusCode: 500, body: JSON.stringify({ error: 'Gemini API key is not configured' }) };
  }

  try {
    const body = JSON.parse(event.body);
    
    // Kiểm tra xem body có chứa nội dung không
    if (!body) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Bad Request: No body provided' }) };
    }

    // Gọi API Gemini
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Gemini API error:', errorText);
      return { statusCode: response.status, body: errorText };
    }

    const data = await response.json();

    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type'
      },
      body: JSON.stringify(data),
    };
  } catch (error) {
    console.error('Function error:', error);
    return { 
      statusCode: 500, 
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      },
      body: JSON.stringify({ error: error.message }) 
    };
  }
};
