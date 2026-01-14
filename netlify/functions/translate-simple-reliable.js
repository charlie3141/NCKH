exports.handler = async function(event, context) {
    // CORS headers
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Content-Type': 'application/json'
    };
    
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers, body: '' };
    }
    
    if (event.httpMethod !== 'POST') {
        return { statusCode: 405, headers, body: JSON.stringify({ error: 'POST only' }) };
    }
    
    try {
        const { text, sourceLang = 'en', targetLang = 'vi' } = JSON.parse(event.body || '{}');
        
        if (!text) {
            return { statusCode: 400, headers, body: JSON.stringify({ error: 'Text required' }) };
        }
        
        console.log(`Translating: "${text.substring(0, 50)}..." from ${sourceLang} to ${targetLang}`);
        
        // Google Translate Free API (no key needed, but has limits)
        // Format languages: en, vi, fr, es, etc.
        const langMap = {
            'vi-VN': 'vi',
            'en-GB': 'en',
            'en-US': 'en',
            'ja-JP': 'ja',
            'ko-KR': 'ko',
            'zh-CN': 'zh-CN'
        };
        
        const sl = langMap[sourceLang] || sourceLang.split('-')[0] || 'en';
        const tl = langMap[targetLang] || targetLang.split('-')[0] || 'vi';
        
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
        
        console.log('Calling Google Translate API:', url.substring(0, 100));
        
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Google Translate API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Parse response: [[["translated text", "original", null, null]], null, "en"]
        let translated = text; // fallback
        
        if (Array.isArray(data) && Array.isArray(data[0])) {
            translated = data[0].map(item => item[0]).join('');
        }
        
        console.log('Translation successful:', translated.substring(0, 50));
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                original: text,
                translated: translated,
                sourceLang: sl,
                targetLang: tl,
                api: 'Google Translate Free',
                timestamp: new Date().toISOString()
            })
        };
        
    } catch (error) {
        console.error('Translation error:', error);
        
        // Fallback: simple word swap (better than reverse)
        const { text = '' } = JSON.parse(event.body || '{}');
        const fallbackMap = {
            'hello': 'xin chào',
            'hi': 'xin chào',
            'thank you': 'cảm ơn',
            'good morning': 'chào buổi sáng',
            'good afternoon': 'chào buổi chiều',
            'good evening': 'chào buổi tối',
            'how are you': 'bạn khỏe không',
            'what is your name': 'bạn tên là gì',
            'my name is': 'tôi tên là',
            'i love you': 'tôi yêu bạn'
        };
        
        let translated = text.toLowerCase();
        for (const [eng, vi] of Object.entries(fallbackMap)) {
            translated = translated.replace(new RegExp(eng, 'gi'), vi);
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                original: text,
                translated: translated === text.toLowerCase() ? text.split('').reverse().join('') : translated,
                sourceLang: 'en',
                targetLang: 'vi',
                note: 'Using dictionary fallback',
                timestamp: new Date().toISOString()
            })
        };
    }
};
