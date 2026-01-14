exports.handler = async function(event, context) {
    // Chỉ cho phép POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { text, langCode, voiceName } = JSON.parse(event.body);
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    role: "user",
                    parts: [{ text: `Say this naturally in a clear voice: ${text}` }]
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

        const data = await response.json();
        
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: data.error || 'TTS failed' })
            };
        }

        const candidate = data.candidates?.[0];
        if (!candidate) {
            throw new Error("No candidates found in response");
        }

        const part = candidate.content?.parts?.find(p => p.inlineData && p.inlineData.data);
        const audioData = part?.inlineData?.data || "";

        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                audioData: audioData,
                text: text,
                voiceName: voiceName
            })
        };

    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ 
                error: error.message,
                message: 'Internal server error'
            })
        };
    }
};
