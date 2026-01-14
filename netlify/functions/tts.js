const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key not configured' })
        };
    }
    
    const { text, voiceName, langCode } = JSON.parse(event.body);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{
                        text: `Say this naturally in a clear voice: ${text}`
                    }]
                }],
                generationConfig: {
                    responseModalities: ["AUDIO"],
                    speechConfig: {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: voiceName || "Aoede"
                            }
                        }
                    }
                }
            })
        });
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        const candidate = data.candidates?.[0];
        if (!candidate) {
            throw new Error("No candidates found in response");
        }
        
        const part = candidate.content?.parts?.find(p => p.inlineData && p.inlineData.data);
        const audioData = part?.inlineData?.data;
        
        if (!audioData) {
            throw new Error("No audio data found");
        }
        
        return {
            statusCode: 200,
            body: JSON.stringify({ audioData })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
