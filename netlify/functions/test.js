exports.handler = async function(event, context) {
    console.log('=== SIMPLE TRANSLATE CALLED ===');
    console.log('Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers));
    console.log('Body exists:', !!event.body);
    
    // Cho phép tất cả origin
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Xử lý preflight OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS preflight');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    // Xử lý GET request (cho test)
    if (event.httpMethod === 'GET') {
        console.log('GET request received');
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                message: 'Translate API is working!',
                method: 'GET',
                note: 'Use POST for translation',
                timestamp: new Date().toISOString()
            })
        };
    }
    
    // Xử lý POST request
    if (event.httpMethod === 'POST') {
        console.log('POST request received');
        
        try {
            // Parse body
            let body;
            try {
                body = JSON.parse(event.body || '{}');
                console.log('Parsed body:', JSON.stringify(body));
            } catch (parseError) {
                console.error('JSON parse error:', parseError.message);
                console.error('Raw body:', event.body);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Invalid JSON',
                        rawBody: event.body,
                        parseError: parseError.message
                    })
                };
            }
            
            const { text = 'Hello', sourceLang = 'en', targetLang = 'vi' } = body;
            
            console.log(`Processing: "${text}" from ${sourceLang} to ${targetLang}`);
            
            // Đơn giản: trả về text đảo ngược để test
            const translated = text.split('').reverse().join('');
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    original: text,
                    translated: translated,
                    sourceLang,
                    targetLang,
                    note: 'This is a test response',
                    timestamp: new Date().toISOString()
                })
            };
            
        } catch (error) {
            console.error('Error:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: error.message,
                    stack: error.stack
                })
            };
        }
    }
    
    // Method không hỗ trợ
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({
            error: 'Method not allowed',
            allowed: ['GET', 'POST', 'OPTIONS']
        })
    };
};
