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
        const { text, voiceName = "Aoede" } = body;
        
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
        
        console.log(`Generating TTS for: "${text.substring(0, 50)}..."`);
        
        // SỬA: Dùng Gemini API với audio support
        // Model cần hỗ trợ audio (gemini-1.5-pro)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ 
                        text: `Generate speech audio for this text: "${text}"` 
                    }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    audioConfig: {
                        audioEncoding: "LINEAR16",
                        speakingRate: 1.0,
                        pitch: 0.0
                    }
                }
            })
        });
        
        console.log('TTS API Response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('TTS API error:', errorText);
            
            // Fallback: Trả về text nếu TTS không hoạt động
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    audioData: null,
                    text: text,
                    error: "TTS not available, using fallback",
                    note: "Gemini TTS API might not be enabled for your API key"
                })
            };
        }
        
        const data = await response.json();
        console.log('TTS response received');
        
        // Gemini TTS trả về audio dưới dạng base64
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.find(p => p.inlineData?.data);
        const audioData = part?.inlineData?.data;
        
        if (audioData) {
            console.log('Audio data received, length:', audioData.length);
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    audioData,
                    textLength: text.length
                })
            };
        } else {
            console.log('No audio data in response, using fallback');
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({ 
                    audioData: null,
                    text: text,
                    note: "No audio data returned from API"
                })
            };
        }
        
    } catch (error) {
        console.error('ERROR in TTS function:', error);
        return {
            statusCode: 200, // Vẫn trả về 200 để frontend không bị lỗi
            headers,
            body: JSON.stringify({ 
                audioData: null,
                text: event.body ? JSON.parse(event.body).text : '',
                error: error.message,
                note: "Using text fallback"
            })
        };
    }
};
