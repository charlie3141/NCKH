// netlify/functions/log-event.js
const axios = require('axios');

exports.handler = async (event, context) => {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  const FIREBASE_URL = process.env.VITE_FIREBASE_URL;
  
  if (!FIREBASE_URL) {
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Firebase URL not configured" }),
    };
  }

  try {
    const { eventType, eventData, userId = 'anonymous', timestamp = new Date().toISOString() } = JSON.parse(event.body);
    
    if (!eventType) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "eventType is required" }),
      };
    }

    // Create log entry
    const logEntry = {
      eventType,
      eventData,
      userId,
      timestamp,
      userAgent: event.headers['user-agent'] || 'unknown',
      ip: event.headers['client-ip'] || 'unknown'
    };

    // Generate unique ID for the log entry
    const logId = Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    
    // Post to Firebase
    const response = await axios.post(`${FIREBASE_URL.replace('.json', '')}/logs/${logId}.json`, logEntry);
    
    return {
      statusCode: 200,
      headers: {
        "Content-Type": "application/json",
        "Access-Control-Allow-Origin": "*",
      },
      body: JSON.stringify({ 
        success: true,
        message: "Event logged successfully",
        logId: logId
      }),
    };
  } catch (error) {
    console.error('Error logging event:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ 
        error: error.message || "Failed to log event"
      }),
    };
  }
};
