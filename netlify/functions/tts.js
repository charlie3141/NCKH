exports.handler = async function(event, context) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    // Preflight
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: 'API key not configured' })
        };
    }
    
    try {
        const { text, voiceName = "Aoede" } = JSON.parse(event.body);
        
        if (!text) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ error: 'Text is required' })
            };
        }
        
        // Sử dụng fetch built-in (Node.js 18+)
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: `Say this naturally: ${text}` }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: { voiceName }
                        }
                    }
                }
            })
        });
        
        if (!response.ok) throw new Error(`API error: ${response.status}`);
        
        const data = await response.json();
        const candidate = data.candidates?.[0];
        const part = candidate?.content?.parts?.find(p => p.inlineData?.data);
        const audioData = part?.inlineData?.data;
        
        if (!audioData) throw new Error("No audio data received");
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({ audioData })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ error: error.message })
        };
    }
};
