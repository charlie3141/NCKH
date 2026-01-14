// netlify/functions/api.js
const fetch = require('node-fetch');

exports.handler = async (event, context) => {
  // Get environment variables
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  const FIREBASE_URL = process.env.VITE_FIREBASE_URL;
  
  // Check if environment variables are configured
  if (!GEMINI_API_KEY || !FIREBASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Server configuration error" }),
    };
  }
  
  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
  
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: '',
    };
  }
  
  // Parse the path
  const path = event.path.replace('/.netlify/functions/api', '');
  
  try {
    // Route based on path
    if (event.httpMethod === 'GET' && path === '/firebase') {
      // Get data from Firebase
      const response = await fetch(`${FIREBASE_URL}/sensorData.json`);
      const data = await response.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          data: data,
        }),
      };
      
    } else if (event.httpMethod === 'POST' && path === '/firebase/log') {
      // Write log to Firebase
      const body = JSON.parse(event.body);
      const timestamp = Date.now();
      
      const logResponse = await fetch(`${FIREBASE_URL}/logs/${timestamp}.json`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ...body,
          timestamp: timestamp,
          userAgent: event.headers['user-agent'],
          ip: event.headers['client-ip'] || 'unknown',
        }),
      });
      
      const logData = await logResponse.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          message: "Log saved",
          logId: timestamp,
        }),
      };
      
    } else if (event.httpMethod === 'POST' && path === '/gemini/translate') {
      // Translate with Gemini
      const body = JSON.parse(event.body);
      
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: body.prompt
              }]
            }]
          }),
        }
      );
      
      const geminiData = await geminiResponse.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          data: geminiData,
        }),
      };
      
    } else if (event.httpMethod === 'POST' && path === '/gemini/tts') {
      // TTS with Gemini
      const body = JSON.parse(event.body);
      
      const geminiResponse = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            contents: [{
              role: "user",
              parts: [{ text: body.text }]
            }],
            generationConfig: {
              responseModalities: ["AUDIO"],
              audioConfig: {
                audioEncoding: "MP3",
                speakingRate: 1.0,
                pitch: 0.0,
                volumeGainDb: 0.0,
                effectsProfileId: ["headphone-class-device"],
                voiceConfig: {
                  prebuiltVoiceConfig: {
                    voiceName: body.voiceName || "Aoede"
                  }
                }
              }
            }
          }),
        }
      );
      
      const geminiData = await geminiResponse.json();
      
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({ 
          success: true, 
          data: geminiData,
        }),
      };
      
    } else {
      return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: "Endpoint not found" }),
      };
    }
    
  } catch (error) {
    console.error("API Error:", error);
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: error.message,
        success: false,
      }),
    };
  }
};
