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
        
        // THỬ CÁC MODEL KHÁC NHAU:
        const models = [
            'gemini-1.5-flash',      // Model mới nhất, nhanh
            'gemini-1.5-pro',        // Pro model
            'gemini-1.0-pro',        // Phiên bản cũ
            'gemini-pro',            // Model cơ bản
            'models/gemini-pro'      // Định dạng đầy đủ
        ];
        
        let lastError = null;
        
        // Thử từng model
        for (const model of models) {
            try {
                console.log(`Trying model: ${model}`);
                
                const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`, {
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
                
                console.log(`Model ${model} response: ${response.status}`);
                
                if (response.ok) {
                    const data = await response.json();
                    console.log(`Success with model: ${model}`);
                    
                    let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
                    
                    // Clean up response
                    translated = translated.replace(/^["']|["']$/g, '');
                    translated = translated.replace(/^Translation:\s*/i, '');
                    translated = translated.replace(/^Here(?:'s| is) the translation:\s*/i, '');
                    
                    console.log('Translation:', translated.substring(0, 100));
                    
                    return {
                        statusCode: 200,
                        headers,
                        body: JSON.stringify({ 
                            translated,
                            original: text,
                            modelUsed: model
                        })
                    };
                } else {
                    const errorText = await response.text();
                    console.log(`Model ${model} failed: ${response.status}`);
                    lastError = `Model ${model}: ${response.status}`;
                    // Tiếp tục thử model tiếp theo
                }
                
            } catch (modelError) {
                console.log(`Model ${model} error:`, modelError.message);
                lastError = modelError.message;
            }
        }
        
        // Nếu tất cả model đều lỗi
        throw new Error(`All models failed. Last error: ${lastError}`);
        
    } catch (error) {
        console.error('FINAL ERROR in translate function:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                error: error.message,
                note: 'Check Netlify logs for which models were tried'
            })
        };
    }
};
