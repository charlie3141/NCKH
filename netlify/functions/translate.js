exports.handler = async function(event, context) {
    console.log('=== TRANSLATE FUNCTION (REAL) CALLED ===');
    console.log('Method:', event.httpMethod);
    console.log('Headers:', JSON.stringify(event.headers, null, 2));
    
    // CORS headers - QUAN TRỌNG
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight OPTIONS
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS preflight');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
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
        // Parse body
        let body;
        try {
            body = JSON.parse(event.body || '{}');
            console.log('Parsed body:', JSON.stringify(body, null, 2));
        } catch (parseError) {
            console.error('JSON parse error:', parseError.message);
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Invalid JSON format',
                    details: parseError.message
                })
            };
        }
        
        const { text, sourceLang = 'en', targetLang = 'vi' } = body;
        
        if (!text || text.trim() === '') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({
                    error: 'Text is required and cannot be empty'
                })
            };
        }
        
        console.log(`Translating: "${text.substring(0, 100)}" from ${sourceLang} to ${targetLang}`);
        
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
        
        if (!GEMINI_API_KEY) {
            console.error('GEMINI_API_KEY is not configured');
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    error: 'API key not configured',
                    note: 'Please set GEMINI_API_KEY in Netlify environment variables'
                })
            };
        }
        
        console.log('API Key length:', GEMINI_API_KEY.length);
        console.log('API Key preview:', GEMINI_API_KEY.substring(0, 10) + '...');
        
        // THỬ CÁC MODEL - BẮT ĐẦU VỚI MODEL ĐƠN GIẢN
        const modelsToTry = [
            'gemini-1.5-flash',  // Model nhanh, ít tốn token
            'gemini-1.0-pro',    // Model cơ bản
            'gemini-pro',        // Model mặc định
            'models/gemini-pro'  // Định dạng đầy đủ
        ];
        
        for (const model of modelsToTry) {
            try {
                console.log(`Trying model: ${model}`);
                
                const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`;
                console.log('API URL:', apiUrl);
                
                const prompt = `Translate from ${sourceLang} to ${targetLang}. 
                Return ONLY the translated text, nothing else.
                
                Original text: "${text}"`;
                
                const requestBody = {
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.1,
                        maxOutputTokens: 1000,
                        topP: 0.8,
                        topK: 40
                    }
                };
                
                console.log('Sending request to Gemini API...');
                
                const response = await fetch(apiUrl, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json'
                    },
                    body: JSON.stringify(requestBody)
                });
                
                console.log(`Response status for ${model}:`, response.status);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Success with model ${model}!`);
                    
                    let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';
                    
                    // Clean up
                    translated = translated.replace(/^["']|["']$/g, '');
                    translated = translated.replace(/^Translation:\s*/i, '');
                    translated = translated.replace(/^Here(?:'s| is) the translation:\s*/i, '');
                    translated = translated.replace(/^In .*?:/i, '').trim();
                    
                    console.log('Raw translation:', translated);
                    console.log('Cleaned translation:', translated);
                    
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({
                            success: true,
                            original: text,
                            translated: translated || text, // Fallback to original
                            sourceLang,
                            targetLang,
                            modelUsed: model,
                            timestamp: new Date().toISOString()
                        })
                    };
                    
                } else {
                    const errorText = await response.text();
                    console.log(`Model ${model} failed:`, response.status, errorText.substring(0, 200));
                    // Continue to next model
                }
                
            } catch (modelError) {
                console.log(`Error with model ${model}:`, modelError.message);
                // Continue to next model
            }
        }
        
        // Nếu tất cả model đều fail, dùng fallback
        console.log('All Gemini models failed, using fallback translation');
        
        // Simple fallback: đảo ngược text (hoặc có thể dùng Google Translate API free)
        const fallbackTranslated = text.split(' ').map(word => 
            word.split('').reverse().join('')
        ).join(' ');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                original: text,
                translated: fallbackTranslated,
                sourceLang,
                targetLang,
                note: 'Using fallback translation (Gemini API unavailable)',
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Unexpected error in translate function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                error: 'Internal server error',
                message: error.message,
                timestamp: new Date().toISOString()
            })
        };
    }
};
