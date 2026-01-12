class Translation {
    constructor() {
        this.translationCache = {};
        this.lastTranslationTime = 0;
        this.TRANSLATION_COOLDOWN = 2000;
    }

    async translateSentence(text, targetLang = 'en-GB') {
        if (!text || text.trim().length === 0) {
            return Promise.reject('No text to translate');
        }
        
        const now = Date.now();
        if (now - this.lastTranslationTime < this.TRANSLATION_COOLDOWN) {
            return Promise.reject('Please wait before translating again');
        }
        
        const cacheKey = text + '|' + targetLang;
        if (this.translationCache[cacheKey]) {
            this.lastTranslationTime = now;
            return Promise.resolve(this.translationCache[cacheKey]);
        }
        
        try {
            const langMap = {
                'en-GB': 'en',
                'ja-JP': 'ja',
                'ko-KR': 'ko',
                'zh-CN': 'zh'
            };
            
            const langCode = langMap[targetLang] || 'en';
            const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=vi|${langCode}`);
            const data = await response.json();
            
            if (data.responseStatus === 200 && data.responseData) {
                const translated = data.responseData.translatedText;
                this.translationCache[cacheKey] = translated;
                this.lastTranslationTime = Date.now();
                
                if (window.app) {
                    window.app.log('TRANSLATION', `Translated to ${targetLang}: ${translated}`);
                }
                
                return translated;
            } else {
                throw new Error('Translation failed');
            }
        } catch (error) {
            console.error('Translation error:', error);
            if (window.app) {
                window.app.log('TRANSLATION', `Translation error: ${error.message}`);
            }
            throw error;
        }
    }

    clearCache() {
        this.translationCache = {};
    }
}
