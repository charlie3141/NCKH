// netlify/functions/get-config.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Get environment variables
  const FIREBASE_URL = process.env.VITE_FIREBASE_URL;
  const GEMINI_API_KEY = process.env.VITE_GEMINI_API_KEY;
  
  // Check if environment variables are configured
  if (!FIREBASE_URL || !GEMINI_API_KEY) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: "Chưa cấu hình biến môi trường trên Netlify",
        firebaseUrl: null,
        geminiApiKey: null
      }),
    };
  }

  try {
    // Return the configuration (these will be used by the client)
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*", // Allow CORS
      },
      body: JSON.stringify({ 
        success: true,
        firebaseUrl: FIREBASE_URL,
        // Note: In production, you might want to handle Gemini calls server-side
        // For now, we'll return it but consider making separate server-side functions
        geminiApiKey: GEMINI_API_KEY
      }),
    };
  } catch (error) {
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message,
        firebaseUrl: null,
        geminiApiKey: null
      }),
    };
  }
};
