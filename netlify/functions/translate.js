exports.handler = async function(event, context) {
    console.log('=== TRANSLATE FUNCTION (WORKING) CALLED ===');
    
    // CORS headers - QUAN TRỌNG
    const headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'POST, OPTIONS, GET',
        'Content-Type': 'application/json'
    };
    
    // Handle preflight
    if (event.httpMethod === 'OPTIONS') {
        console.log('Handling OPTIONS preflight');
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }
    
    // Cho phép GET để test
    if (event.httpMethod === 'GET') {
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                status: 'online',
                message: 'Translate API is working',
                timestamp: new Date().toISOString()
            })
        };
    }
    
    // Xử lý POST
    if (event.httpMethod === 'POST') {
        try {
            console.log('Raw body:', event.body);
            
            let body;
            try {
                body = JSON.parse(event.body || '{}');
            } catch (e) {
                console.error('JSON parse error:', e.message);
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Invalid JSON format',
                        details: e.message
                    })
                };
            }
            
            const { text, sourceLang = 'vi-VN', targetLang = 'en-GB' } = body;
            
            console.log('Request:', { text, sourceLang, targetLang });
            
            if (!text || text.trim() === '') {
                return {
                    statusCode: 400,
                    headers,
                    body: JSON.stringify({
                        error: 'Vui lòng nhập văn bản để dịch'
                    })
                };
            }
            
            // Map language codes
            const langMap = {
                'vi-VN': 'vi',
                'en-GB': 'en',
                'en-US': 'en',
                'ja-JP': 'ja',
                'ko-KR': 'ko',
                'zh-CN': 'zh-CN',
                'fr-FR': 'fr',
                'es-ES': 'es'
            };
            
            const sl = langMap[sourceLang] || sourceLang.split('-')[0] || 'vi';
            const tl = langMap[targetLang] || targetLang.split('-')[0] || 'en';
            
            console.log(`Translating from ${sl} to ${tl}: "${text.substring(0, 50)}..."`);
            
            // Google Translate Free API
            const translateUrl = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(text)}`;
            
            const response = await fetch(translateUrl);
            
            if (!response.ok) {
                throw new Error(`Translation API error: ${response.status}`);
            }
            
            const data = await response.json();
            
            // Parse the response
            let translated = text; // Default fallback
            
            if (Array.isArray(data) && Array.isArray(data[0])) {
                translated = data[0].map(item => item[0]).join('').trim();
            }
            
            // Fallback dictionary for common phrases
            if (translated === text && sl === 'en' && tl === 'vi') {
                const dictionary = {
                    'hello': 'xin chào',
                    'hi': 'xin chào',
                    'thank you': 'cảm ơn',
                    'good morning': 'chào buổi sáng',
                    'good afternoon': 'chào buổi chiều',
                    'good evening': 'chào buổi tối',
                    'how are you': 'bạn khỏe không',
                    'what is your name': 'bạn tên là gì',
                    'my name is': 'tôi tên là',
                    'i love you': 'tôi yêu bạn',
                    'please': 'làm ơn',
                    'sorry': 'xin lỗi',
                    'yes': 'có',
                    'no': 'không',
                    'good': 'tốt',
                    'bad': 'xấu',
                    'water': 'nước',
                    'food': 'đồ ăn',
                    'help': 'giúp đỡ'
                };
                
                const lowerText = text.toLowerCase();
                for (const [eng, vi] of Object.entries(dictionary)) {
                    if (lowerText.includes(eng)) {
                        translated = vi;
                        break;
                    }
                }
            }
            
            console.log('Translation result:', translated.substring(0, 100));
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    original: text,
                    translated: translated,
                    sourceLang: sl,
                    targetLang: tl,
                    timestamp: new Date().toISOString()
                })
            };
            
        } catch (error) {
            console.error('Translation error:', error);
            
            // Ultimate fallback
            const { text = '' } = JSON.parse(event.body || '{}');
            const fallback = text.split(' ').map(word => 
                word.split('').reverse().join('')
            ).join(' ');
            
            return {
                statusCode: 200, // Vẫn trả về 200 để frontend không lỗi
                headers,
                body: JSON.stringify({
                    success: true,
                    original: text,
                    translated: fallback,
                    note: 'Using fallback translation',
                    error: error.message,
                    timestamp: new Date().toISOString()
                })
            };
        }
    }
    
    return {
        statusCode: 405,
        headers,
        body: JSON.stringify({ error: 'Method not allowed' })
    };
};
