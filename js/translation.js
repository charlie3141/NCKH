let lastTranslationTime = 0;

function handleTranslationInput() {
    const input = document.getElementById('translationInput').value;
    const suggestionsDiv = document.getElementById('translationSuggestions');
    
    if (!input || input.trim().length === 0) {
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.classList.remove('show');
        return;
    }
    
    const inputLower = input.toLowerCase();
    const filteredPhrases = commonPhrases.filter(phrase => 
        phrase.toLowerCase().includes(inputLower)
    );
    
    if (filteredPhrases.length > 0) {
        suggestionsDiv.innerHTML = filteredPhrases.map(phrase => `
            <div class="suggestion-item" onclick="selectTranslationSuggestion('${phrase}')">
                ${phrase}
            </div>
        `).join('');
        suggestionsDiv.classList.add('show');
    } else {
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.classList.remove('show');
    }
}

function selectTranslationSuggestion(phrase) {
    document.getElementById('translationInput').value = phrase;
    document.getElementById('translationSuggestions').innerHTML = '';
    document.getElementById('translationSuggestions').classList.remove('show');
    translateSentence();
}

async function translateSentence() {
    const textarea = document.getElementById('translationInput');
    const text = textarea.value.trim();
    const targetLang = document.getElementById('targetLanguage').value;
    const outputDiv = document.getElementById('translationOutput');
    
    if (!text) {
        outputDiv.innerHTML = '<span style="color: #F44336;">Vui lòng nhập văn bản để dịch!</span>';
        outputDiv.className = 'conversion-display error';
        return;
    }
    
    const now = Date.now();
    if (now - lastTranslationTime < TRANSLATION_COOLDOWN) {
        outputDiv.innerHTML = '<span style="color: #FF9800;">Vui lòng đợi trước khi dịch lại...</span>';
        outputDiv.className = 'conversion-display';
        return;
    }
    
    const cacheKey = text + '|' + targetLang;
    if (translationCache[cacheKey]) {
        outputDiv.innerHTML = translationCache[cacheKey];
        outputDiv.className = 'conversion-display success';
        lastTranslationTime = now;
        return;
    }
    
    outputDiv.innerHTML = '<span class="loading">Đang dịch với AI... ⏳</span>';
    outputDiv.className = 'conversion-display loading';
    
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
            translationCache[cacheKey] = translated;
            outputDiv.innerHTML = translated;
            outputDiv.className = 'conversion-display success';
            lastTranslationTime = Date.now();
            log('TRANSLATION', `Translated to ${targetLang}: ${translated}`);
        } else {
            throw new Error('Translation failed');
        }
    } catch (error) {
        console.error('Translation error:', error);
        outputDiv.innerHTML = '<span style="color: #F44336;">Dịch vụ dịch thuật không khả dụng. Vui lòng thử lại sau.</span>';
        outputDiv.className = 'conversion-display error';
    }
}

function clearTranslation() {
    document.getElementById('translationOutput').innerHTML = 'Đang chờ dịch...';
    document.getElementById('translationOutput').className = 'conversion-display';
    translationCache = {};
}

function translatePhrase(phrase) {
    const textarea = document.getElementById('translationInput');
    const outputDiv = document.getElementById('translationOutput');
    
    textarea.value = phrase;
    translateSentence();
}
