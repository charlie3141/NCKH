const fetch = require('node-fetch');

exports.handler = async function(event, context) {
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
    
    if (!GEMINI_API_KEY) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'API key not configured' })
        };
    }
    
    const { text, sourceLang, targetLang } = JSON.parse(event.body);
    
    try {
        const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
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
        
        if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
        }
        
        const data = await response.json();
        let translated = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || "";
        translated = translated.replace(/^["']|["']$/g, '');
        
        return {
            statusCode: 200,
            body: JSON.stringify({ translated })
        };
    } catch (error) {
        return {
            statusCode: 500,
            body: JSON.stringify({ error: error.message })
        };
    }
};
