// Biến tổng hợp giọng nói
let isSpeaking = false;
let currentSpeech = null;
let audioVisualizerInterval = null;

// Chế độ TTS
let useGeminiTTS = true;

// Cài đặt giọng nói hiện tại
let currentVoice = {
    lang: 'vi-VN',
    gender: 'male'
};

const pcmToWav = (base64PCM, sampleRate = 24000) => {
    try {
        const binaryString = atob(base64PCM);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        const wavHeader = new ArrayBuffer(44);
        const view = new DataView(wavHeader);

        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        writeString(view, 0, "RIFF");
        view.setUint32(4, 36 + len, true);
        writeString(view, 8, "WAVE");
        writeString(view, 12, "fmt ");
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, 1, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2, true);
        view.setUint16(32, 2, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, "data");
        view.setUint32(40, len, true);

        return new Blob([wavHeader, bytes], { type: "audio/wav" });
    } catch (error) {
        console.error("PCM to WAV error:", error);
        return null;
    }
};

async function speakWithRetry(text, langCode, retries = 3) {
    const voiceName = geminiVoiceMap[langCode]?.[currentVoice.gender] || 
                    (currentVoice.gender === 'male' ? 'Aoede' : 'Kore');
    
    for (let i = 0; i < retries; i++) {
        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 15000);

            const response = await fetch(
                `${GEMINI_API_URL}?key=${GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    signal: controller.signal,
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: text }] }],
                        generationConfig: {
                            responseModalities: ["AUDIO"],
                            speechConfig: {
                                voiceConfig: { prebuiltVoiceConfig: { voiceName } },
                            },
                        },
                    }),
                }
            );

            clearTimeout(timeoutId);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(`API_ERROR_${response.status}: ${errorData?.error?.message || response.statusText}`);
            }

            const data = await response.json();
            const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            
            if (!inlineData || !inlineData.data) {
                throw new Error("NO_DATA");
            }

            return inlineData.data;
        } catch (err) {
            if (i === retries - 1) throw err;
            const delay = Math.pow(2, i) * 1000;
            await new Promise(r => setTimeout(r, delay));
        }
    }
}

async function speakVietnameseSentence() {
    const text = convertedFullSentence || document.getElementById('convertedSentenceDisplay').textContent;
    if (!text || text === '---') {
        log('SPEECH', 'No Vietnamese text to speak');
        return;
    }
    
    speakText(text, currentVoice.lang);
}

async function speakTranslation() {
    const text = document.getElementById('translationOutput').textContent;
    if (!text || text.includes('Đang chờ dịch') || text.includes('Vui lòng nhập')) {
        log('SPEECH', 'No translation text to speak');
        return;
    }
    
    const lang = document.getElementById('voiceLanguage').value;
    speakText(text, lang);
}

async function speakText(text, langCode) {
    if (isSpeaking) {
        stopAllSpeech();
        return;
    }
    
    if (useGeminiTTS) {
        document.getElementById('aiSpeechStatus').style.display = 'flex';
    }
    
    if (useGeminiTTS && GEMINI_API_KEY) {
        await speakWithGeminiTTS(text, langCode);
    } else {
        speakWithWebSpeech(text, langCode);
    }
}

function speakWithWebSpeech(text, langCode) {
    if (isSpeaking) {
        stopAllSpeech();
        return;
    }
    
    if (!('speechSynthesis' in window)) {
        log('SPEECH', 'Speech synthesis not supported in this browser');
        return;
    }
    
    window.speechSynthesis.cancel();
    
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = langCode;
    utterance.rate = 0.9;
    utterance.pitch = currentVoice.gender === 'male' ? 0.8 : 1.2;
    utterance.volume = 1;
    
    utterance.onstart = function() {
        setIsSpeaking(true);
        updateUI();
        startAudioVisualizer();
        log('SPEECH', `Started Web Speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
    };
    
    utterance.onend = function() {
        setIsSpeaking(false);
        currentSpeech = null;
        stopAudioVisualizer();
        updateUI();
        log('SPEECH', 'Ended Web Speech');
    };
    
    utterance.onerror = function(event) {
        setIsSpeaking(false);
        currentSpeech = null;
        stopAudioVisualizer();
        updateUI();
        log('SPEECH', `Web Speech error: ${event.error}`);
    };
    
    currentSpeech = utterance;
    window.speechSynthesis.speak(utterance);
}

function setIsSpeaking(speaking) {
    isSpeaking = speaking;
    updateUI();
}

function stopAllSpeech() {
    if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
    }
    
    if (currentSpeech && currentSpeech.pause) {
        currentSpeech.pause();
        currentSpeech.currentTime = 0;
    }
    
    setIsSpeaking(false);
    currentSpeech = null;
    stopAudioVisualizer();
    updateUI();
    
    document.getElementById('aiSpeechStatus').style.display = 'none';
    
    log('SPEECH', 'Stopped all speech');
}

function startAudioVisualizer() {
    stopAudioVisualizer();
    
    const visualizer = document.getElementById('audioVisualizer');
    visualizer.innerHTML = '';
    
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'audio-bar';
        bar.style.height = '5px';
        visualizer.appendChild(bar);
    }
    
    const bars = visualizer.querySelectorAll('.audio-bar');
    audioVisualizerInterval = setInterval(() => {
        bars.forEach(bar => {
            const height = 5 + Math.random() * 35;
            bar.style.height = `${height}px`;
            bar.style.backgroundColor = `hsl(${120 + Math.random() * 60}, 70%, 50%)`;
        });
    }, 100);
}

function stopAudioVisualizer() {
    if (audioVisualizerInterval) {
        clearInterval(audioVisualizerInterval);
        audioVisualizerInterval = null;
    }
    
    const visualizer = document.getElementById('audioVisualizer');
    visualizer.innerHTML = '';
    
    for (let i = 0; i < 20; i++) {
        const bar = document.createElement('div');
        bar.className = 'audio-bar';
        bar.style.height = '5px';
        bar.style.backgroundColor = '#e0e0e0';
        visualizer.appendChild(bar);
    }
}

function selectVoice(button) {
    const lang = button.getAttribute('data-lang');
    const gender = button.getAttribute('data-gender');
    
    currentVoice = {
        lang: lang,
        gender: gender
    };
    
    document.querySelectorAll('.voice-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    button.classList.add('active');
    
    updateUI();
    log('VOICE', `Selected voice: ${lang} ${gender}`);
}

function toggleTTSMode(useGemini) {
    useGeminiTTS = useGemini;
    
    document.getElementById('useGeminiTTS').classList.toggle('active', useGemini);
    document.getElementById('useWebSpeech').classList.toggle('active', !useGemini);
    
    updateUI();
    log('TTS', `Switched to ${useGemini ? 'Gemini AI' : 'Web Speech'} TTS`);
}
