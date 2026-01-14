exports.handler = async function(event, context) {
    console.log('=== TRANSLATE FUNCTION CALLED ===');
    
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
    
    // Kiểm tra body
    if (!event.body || event.body.trim() === '') {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ error: 'Request body is empty' })
        };
    }
    
    try {
        const body = JSON.parse(event.body);
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
        
        console.log(`Translating: "${text.substring(0, 50)}..."`);
        
        // SỬA ENDPOINT: dùng gemini-1.5-pro hoặc gemini-1.0-pro
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Translate from ${sourceLang} to ${targetLang}. 
                        Return ONLY the translated text, no explanations, no quotes.
                        
                        Original text: ${text}`
                    }]
                }],
                generationConfig: {
                    temperature: 0.3,
                    maxOutputTokens: 1000
                }
            })
        });
        
        console.log('API Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('API error response:', errorText);
            throw new Error(`API error ${response.status}: ${errorText.substring(0, 100)}`);
        }
        
        const data = await response.json();
        console.log('API response data:', JSON.stringify(data, null, 2).substring(0, 500));
        
        let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        
        // Clean up response
        translated = translated.replace(/^["']|["']$/g, '');
        translated = translated.replace(/^Translation:\s*/i, '');
        translated = translated.replace(/^Here(?:'s| is) the translation:\s*/i, '');
        
        console.log('Cleaned translation:', translated.substring(0, 100));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ 
                translated,
                original: text
            })
        };
        
    } catch (error) {
        console.error('ERROR in translate function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                note: 'Check Netlify logs for details'
            })
        };
    }
};
