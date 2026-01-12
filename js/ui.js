let logEntries = [];

function scheduleUIUpdate() {
    if (!uiUpdateScheduled) {
        uiUpdateScheduled = true;
        requestAnimationFrame(() => {
            updateCriticalUI();
            uiUpdateScheduled = false;
        });
    }
}

function updateCriticalUI() {
    const startTime = performance.now();
    
    // Chỉ cập nhật các phần quan trọng
    updateSensorDisplay();
    updateWordDisplays();
    updateSentenceDisplay();
    
    // Cập nhật thời gian
    const updateTime = document.getElementById('lastUpdate');
    const currentTime = formatTime(Date.now());
    if (updateTime.textContent !== `Cập nhật: ${currentTime}`) {
        updateTime.textContent = `Cập nhật: ${currentTime}`;
        document.getElementById('lastUpdateTime').textContent = currentTime;
    }
    
    const uiTime = performance.now() - startTime;
    if (uiTime > 16) {
        console.warn(`UI update slow: ${Math.round(uiTime)}ms`);
    }
}

function updateSensorDisplay() {
    // Cập nhật flex boxes nếu cần
    for (let i = 0; i < 4; i++) {
        const box = document.getElementById(`flex${i}-box`);
        if (box && box.textContent !== flexStates[i].toString()) {
            box.textContent = flexStates[i];
            box.className = `flex-box active-${flexStates[i]}`;
        }
    }
    
    // Cập nhật raw values
    if (firebaseData) {
        const rawValues = [firebaseData.f0 || 0, firebaseData.f1 || 0, firebaseData.f2 || 0, firebaseData.f3 || 0];
        const rawValuesElement = document.getElementById('rawValues');
        const newRawText = rawValues.join(', ');
        if (rawValuesElement.textContent !== newRawText) {
            rawValuesElement.textContent = newRawText;
        }
        
        const flexFormatElement = document.getElementById('flexFormat');
        const newFlexText = flexStates.join('');
        if (flexFormatElement.textContent !== newFlexText) {
            flexFormatElement.textContent = newFlexText;
        }
    }
}

function updateWordDisplays() {
    const displayBufferElement = document.getElementById('displayBuffer');
    if (displayBufferElement.textContent !== displayBuffer) {
        displayBufferElement.textContent = displayBuffer || '---';
    }
    
    const slot1Element = document.getElementById('slot1');
    if (slot1Element.textContent !== slot1) {
        slot1Element.textContent = slot1 || '---';
    }
    
    const slot2Element = document.getElementById('slot2');
    if (slot2Element.textContent !== slot2) {
        slot2Element.textContent = slot2 || '---';
    }
    
    // Cập nhật từ đã convert
    if (displayBuffer.length > 0) {
        convertedCurrentWord = convertVietnameseWordCached(displayBuffer);
    } else {
        convertedCurrentWord = "";
    }
    
    const convertedWordElement = document.getElementById('convertedCurrentWord');
    if (convertedWordElement.textContent !== convertedCurrentWord) {
        convertedWordElement.textContent = convertedCurrentWord || '---';
    }
}

function updateSentenceDisplay() {
    const sentenceElement = document.getElementById('sentenceDisplay');
    const newSentence = sentenceWords.join(' ');
    
    if (fullSentence !== newSentence) {
        fullSentence = newSentence;
        sentenceElement.textContent = fullSentence || '---';
        
        // Convert sentence
        convertedFullSentence = convertVietnameseTextFast(fullSentence);
        const convertedElement = document.getElementById('convertedSentenceDisplay');
        convertedElement.textContent = convertedFullSentence || '---';
        
        // Cập nhật word list
        updateWordList();
        
        // Cập nhật word count
        const wordCountElement = document.getElementById('wordCount');
        wordCountElement.textContent = sentenceWords.length;
    }
}

function updateWordList() {
    const wordListDiv = document.getElementById('wordList');
    if (sentenceWords.length > 0) {
        wordListDiv.innerHTML = sentenceWords.map(word => 
            `<div class="word-item">${word}</div>`
        ).join('');
    } else {
        wordListDiv.innerHTML = 'Chưa có từ nào';
    }
}

function updateUI() {
    updateWordDisplays();
    updateSentenceDisplay();
    
    const speakVnBtn = document.getElementById('speakVnBtn');
    const speakTransBtn = document.getElementById('speakTransBtn');
    const stopSpeechBtn = document.getElementById('stopSpeechBtn');
    
    speakVnBtn.disabled = !convertedFullSentence || isSpeaking;
    speakTransBtn.disabled = !document.getElementById('translationOutput').textContent || isSpeaking;
    stopSpeechBtn.disabled = !isSpeaking;
    
    if (isSpeaking) {
        speakVnBtn.classList.add('speaking');
    } else {
        speakVnBtn.classList.remove('speaking');
    }
    
    const langNames = {
        'vi-VN': 'Tiếng Việt',
        'en-GB': 'Tiếng Anh',
        'ja-JP': 'Tiếng Nhật',
        'ko-KR': 'Tiếng Hàn',
        'zh-CN': 'Tiếng Trung'
    };
    const genderNames = {
        'male': 'Nam',
        'female': 'Nữ'
    };
    const ttsMode = useGeminiTTS ? 'Gemini AI' : 'Web Speech';
    document.getElementById('currentVoiceDisplay').textContent = 
        `Hiện tại: ${langNames[currentVoice.lang] || currentVoice.lang} ${genderNames[currentVoice.gender] || currentVoice.gender} (${ttsMode})`;
    
    document.getElementById('useGeminiTTS').classList.toggle('active', useGeminiTTS);
    document.getElementById('useWebSpeech').classList.toggle('active', !useGeminiTTS);
}

function log(source, message) {
    const timestamp = new Date().toLocaleTimeString();
    const logEntry = { timestamp, source, message };
    
    logEntries.unshift(logEntry);
    if (logEntries.length > MAX_LOG_ENTRIES) {
        logEntries.pop();
    }
    
    updateLogDisplay();
}

function updateLogDisplay() {
    const logContainer = document.getElementById('logContainer');
    // Chỉ render 5 dòng đầu để tối ưu
    const visibleEntries = logEntries.slice(0, 5);
    
    logContainer.innerHTML = visibleEntries.map(entry => 
        `<div class="log-entry">
            <span style="color: #666; font-size: 0.8rem;">[${entry.timestamp}] ${entry.source}:</span>
            <span style="color: #333;"> ${entry.message}</span>
        </div>`
    ).join('');
}

function clearLog() {
    logEntries = [];
    updateLogDisplay();
}

function exportLog() {
    const logText = logEntries.map(entry => 
        `[${entry.timestamp}] ${entry.source}: ${entry.message}`
    ).join('\n');
    
    const blob = new Blob([logText], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `log_${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function loadPhraseSuggestions() {
    const phrasePills = document.getElementById('phrasePills');
    phrasePills.innerHTML = '';
    
    commonPhrases.forEach(phrase => {
        const pill = document.createElement('button');
        pill.className = 'phrase-pill';
        pill.textContent = phrase.length > 30 ? phrase.substring(0, 27) + '...' : phrase;
        pill.onclick = () => {
            document.getElementById('translationInput').value = phrase;
            translatePhrase(phrase);
            log('PHRASE', `Selected phrase: "${phrase}"`);
        };
        pill.title = phrase;
        phrasePills.appendChild(pill);
    });
}

function showAutoSuggestions() {
    if (sentenceWords.length === 0) {
        document.getElementById('autoSuggestionsPanel').style.display = 'none';
        return;
    }
    
    const panel = document.getElementById('autoSuggestionsPanel');
    const grid = document.getElementById('autoSuggestionsGrid');
    
    // Create suggestions based on current sentence
    const currentSentence = convertedFullSentence || '';
    const suggestions = [];
    
    if (currentSentence.includes('xin chào') || currentSentence.includes('chào')) {
        suggestions.push({
            text: 'Xin chào, rất vui được gặp bạn',
            type: 'greeting'
        });
    }
    
    if (currentSentence.includes('cảm ơn')) {
        suggestions.push({
            text: 'Không có gì, rất vui được giúp đỡ',
            type: 'response'
        });
    }
    
    if (currentSentence.includes('tên') || currentSentence.includes('bạn tên')) {
        suggestions.push({
            text: 'Tôi là trợ lý ngôn ngữ, rất vui được giúp bạn',
            type: 'introduction'
        });
    }
    
    // Add some default suggestions if none matched
    if (suggestions.length === 0) {
        suggestions.push(
            { text: 'Bạn có thể nói chậm hơn được không?', type: 'request' },
            { text: 'Tôi không hiểu, bạn có thể giải thích không?', type: 'clarification' },
            { text: 'Rất vui được trò chuyện với bạn', type: 'conversation' }
        );
    }
    
    grid.innerHTML = suggestions.map(suggestion => `
        <div class="auto-suggestion-item">
            <div class="auto-suggestion-text">${suggestion.text}</div>
            <div class="auto-suggestion-actions">
                <button class="auto-suggestion-btn speak" onclick="speakText('${suggestion.text}', 'vi-VN')">🔊 Đọc</button>
                <button class="auto-suggestion-btn use" onclick="useSuggestion('${suggestion.text}')">📝 Dùng</button>
                <button class="auto-suggestion-btn translate" onclick="translateSuggestion('${suggestion.text}')">🌐 Dịch</button>
            </div>
        </div>
    `).join('');
    
    panel.style.display = 'block';
}

function useSuggestion(text) {
    document.getElementById('translationInput').value = text;
    translateSentence();
    log('SUGGESTION', `Using suggestion: "${text}"`);
}

function translateSuggestion(text) {
    document.getElementById('translationInput').value = text;
    translateSentence();
    log('SUGGESTION', `Translating suggestion: "${text}"`);
}

// Gemini Voice Map (add this to config.js or keep here)
const geminiVoiceMap = {
    'vi-VN': {
        'male': 'Aoede',
        'female': 'Kore'
    },
    'en-GB': {
        'male': 'Aoede',
        'female': 'Kore'
    }
};
