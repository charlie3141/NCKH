exports.handler = async function(event, context) {
    // Chỉ cho phép POST
    if (event.httpMethod !== 'POST') {
        return {
            statusCode: 405,
            body: JSON.stringify({ error: 'Method Not Allowed' })
        };
    }

    try {
        const { text, sourceLang, targetLang } = JSON.parse(event.body);
        const GEMINI_API_KEY = process.env.GEMINI_API_KEY;

        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: `Translate from ${sourceLang} to ${targetLang}. 
                        Maintain natural and formal tone. Output ONLY the translated text, no quotes, no extra notes.
                        Text: "${text}"`
                    }]
                }]
            })
        });

        const data = await response.json();
        
        if (!response.ok) {
            return {
                statusCode: response.status,
                body: JSON.stringify({ error: data.error || 'Translation failed' })
            };
        }

        const translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        
        return {
            statusCode: 200,
            headers: {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            body: JSON.stringify({ 
                translatedText: translated.replace(/^["']|["']$/g, ''),
                originalText: text,
                sourceLang,
                targetLang
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
