exports.handler = async function(event, context) {
    console.log('=== TTS FUNCTION CALLED ===');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (!event.body || event.body.trim() === '') {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body is empty' })
        };
    }
    
    try {
        const body = JSON.parse(event.body);
        const { text } = body;
        
        if (!text) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Text is required' })
            };
        }
        
        console.log(`TTS requested for: "${text.substring(0, 50)}..."`);
        
        // Gemini TTS API hiện tại không dễ truy cập
        // Tạm thời trả về text và để frontend dùng Web Speech
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                success: true,
                text: text,
                note: "Use browser's Web Speech API for TTS",
                instruction: "Frontend should use speechSynthesis API"
            })
        };
        
    } catch (error) {
        console.error('ERROR in TTS function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message
            })
        };
    }
};
