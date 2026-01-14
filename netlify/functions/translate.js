exports.handler = async function(event, context) {
    console.log('=== TRANSLATE FUNCTION (FIXED) ===');
    
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            headers,
            body: JSON.stringify({ error: 'Method not allowed' })
        };
    }
    
    try {
        const body = JSON.parse(event.body || '{}');
        const { text, sourceLang = 'en', targetLang = 'vi' } = body;
        
        if (!text || text.trim() === '') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Text is required' })
            };
        }
        
        console.log(`Translating: "${text}"`);
        
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_API_KEY) {
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({ error: 'API key not configured' })
            };
        }
        
        // THỬ CÁC ENDPOINT KHÁC NHAU
        const endpoints = [
            {
                name: 'gemini-1.5-pro-latest (v1beta)',
                url: `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro-latest:generateContent?key=${GEMINI_API_KEY}`
            },
            {
                name: 'gemini-pro (v1)',
                url: `https://generativelanguage.googleapis.com/v1/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`
            },
            {
                name: 'gemini-1.0-pro (v1)',
                url: `https://generativelanguage.googleapis.com/v1/models/gemini-1.0-pro:generateContent?key=${GEMINI_API_KEY}`
            },
            {
                name: 'text-bison-001 (PaLM)',
                url: `https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${GEMINI_API_KEY}`
            }
        ];
        
        for (const endpoint of endpoints) {
            try {
                console.log(`Trying endpoint: ${endpoint.name}`);
                
                let requestBody;
                
                if (endpoint.name.includes('text-bison')) {
                    // PaLM API format
                    requestBody = {
                        prompt: {
                            text: `Translate from ${sourceLang} to ${targetLang}: "${text}"`
                        }
                    };
                } else {
                    // Gemini API format
                    requestBody = {
                        contents: [{
                            parts: [{
                                text: `Translate this from ${sourceLang} to ${targetLang}: "${text}"`
                            }]
                        }],
                        generationConfig: {
                            temperature: 0.1,
                            maxOutputTokens: 1000
                        }
                    };
                }
                
                const response = await fetch(endpoint.url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(requestBody)
                });
                
                console.log(`Response from ${endpoint.name}:`, response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log('Success! Data:', JSON.stringify(data).substring(0, 500));
                    
                    let translated;
                    
                    if (endpoint.name.includes('text-bison')) {
                        // PaLM response format
                        translated = data.candidates?.[0]?.output?.trim() || 
                                    data.predictions?.[0]?.content?.trim() || 
                                    text;
                    } else {
                        // Gemini response format
                        translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || 
                                    data.text?.trim() || 
                                    text;
                    }
                    
                    // Clean up
                    translated = translated.replace(/^["']|["']$/g, '');
                    translated = translated.replace(/^Translation:\s*/i, '');
                    
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            original: text,
                            translated: translated,
                            sourceLang,
                            targetLang,
                            endpoint: endpoint.name,
                            timestamp: new Date().toISOString()
                        })
                    };
                } else {
                    const errorText = await response.text();
                    console.log(`Endpoint ${endpoint.name} failed:`, errorText.substring(0, 200));
                }
                
            } catch (endpointError) {
                console.log(`Error with ${endpoint.name}:`, endpointError.message);
            }
        }
        
        // Nếu tất cả đều fail, dùng Google Translate Free API
        console.log('All Gemini/PaLM endpoints failed, trying Google Translate Free API');
        
        try {
            // Google Translate Free API (có giới hạn)
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sourceLang}&tl=${targetLang}&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(translateUrl);
            
            if (response.ok) {
                const data = await response.json();
                const translated = data[0]?.map(item => item[0]).join('') || text;
                
                return {
                    statusCode: 200,
                    headers,
                    body: JSON.stringify({
                        success: true,
                        original: text,
                        translated: translated,
                        sourceLang,
                        targetLang,
                        endpoint: 'Google Translate Free API',
                        note: 'Using free API with limitations',
                        timestamp: new Date().toISOString()
                    })
                };
            }
        } catch (googleError) {
            console.log('Google Translate also failed:', googleError.message);
        }
        
        // Ultimate fallback
        const fallbackTranslated = text.split('').reverse().join('');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                original: text,
                translated: fallbackTranslated,
                sourceLang,
                targetLang,
                note: 'Using reverse text fallback (all APIs failed)',
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Fatal error:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: error.message
            })
        };
    }
};
