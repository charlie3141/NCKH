exports.handler = async function(event, context) {
    console.log('=== TRANSLATE FUNCTION CALLED ===');
    console.log('HTTP Method:', event.httpMethod);
    console.log('Path:', event.path);
    console.log('Headers:', JSON.stringify(event.headers));
    console.log('Raw body:', event.body);
    console.log('Body length:', event.body?.length);
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        console.log('Preflight request');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    // Kiểm tra body
    if (!event.body) {
        console.error('No body received');
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                error: 'No request body',
                received: event.body 
            })
        };
    }
    
    try {
        console.log('Parsing JSON body...');
        const body = JSON.parse(event.body);
        console.log('Parsed body:', JSON.stringify(body, null, 2));
        
        const { text, sourceLang, targetLang } = body;
        
        if (!text) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Text is required' })
            };
        }
        
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'API key not configured' })
            };
        }
        
        console.log(`Translating: "${text.substring(0, 50)}..." from ${sourceLang} to ${targetLang}`);
        
        // API call
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Translate from ${sourceLang} to ${targetLang}. Output ONLY the translated text: "${text}"`
                    }]
                }]
            })
        });
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error:', response.status, errorText);
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        translated = translated.replace(/^["']|["']$/g, '');
        
        console.log('Success! Translation:', translated.substring(0, 50));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                translated,
                original: text,
                sourceLang,
                targetLang 
            })
        };
        
    } catch (error) {
        console.error('ERROR DETAILS:', error);
        console.error('Error stack:', error.stack);
        console.error('Raw body that caused error:', event.body);
        
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                rawBody: event.body,
                bodyType: typeof event.body,
                stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
            })
        };
    }
};
