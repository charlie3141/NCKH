exports.handler = async function(event, context) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            hasApiKey: !!GEMINI_API_KEY,
            apiKeyLength: GEMINI_API_KEY ? GEMINI_API_KEY.length : 0,
            apiKeyPreview: GEMINI_API_KEY ? GEMINI_API_KEY.substring(0, 10) + '...' : null
        })
    };
};
