exports.handler = async function(event, context) {
    console.log('=== TTS FUNCTION CALLED ===');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    // Chỉ chấp nhận POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({
                error: 'Method not allowed',
                allowed: ['POST', 'OPTIONS']
            })
        };
    }
    
    try {
        const body = JSON.parse(event.body || '{}');
        const { text } = body;
        
        if (!text || text.trim() === '') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Text is required'
                })
            };
        }
        
        console.log(`TTS requested for: "${text.substring(0, 100)}"`);
        
        // Hiện tại Gemini TTS API khó truy cập
        // Trả về success nhưng không có audio, frontend sẽ dùng Web Speech
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                text: text,
                note: 'Use browser Web Speech API for TTS',
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Error in TTS function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
