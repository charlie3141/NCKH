class SpeechTTS {
    constructor() {
        this.GEMINI_API_KEY = "AIzaSyDdUj2SX83qODeZ1hhru0e9KN1fwDrtUP8";
        this.GEMINI_API_URL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent";
        
        this.isSpeaking = false;
        this.currentSpeech = null;
        this.audioVisualizerInterval = null;
        this.useGeminiTTS = true;
        
        this.currentVoice = {
            lang: 'vi-VN',
            gender: 'male'
        };
        
        this.geminiVoiceMap = {
            'vi-VN': { male: 'Aoede', female: 'Kore' },
            'en-GB': { male: 'Aoede', female: 'Kore' },
            'ja-JP': { male: 'Aoede', female: 'Kore' },
            'ko-KR': { male: 'Aoede', female: 'Kore' },
            'zh-CN': { male: 'Aoede', female: 'Kore' }
        };
    }

    async speakText(text, langCode) {
        if (this.isSpeaking) {
            this.stopAllSpeech();
            return;
        }
        
        if (this.useGeminiTTS && this.GEMINI_API_KEY) {
            this.speakWithGeminiTTS(text, langCode);
        } else {
            this.speakWithWebSpeech(text, langCode);
        }
    }

    async speakWithGeminiTTS(text, langCode) {
        const voiceName = this.geminiVoiceMap[langCode]?.[this.currentVoice.gender] || 
                         (this.currentVoice.gender === 'male' ? 'Aoede' : 'Kore');
        
        // Show loading status
        if (window.app && window.app.uiManager) {
            window.app.uiManager.showAISpeechLoading(true);
        }
        
        try {
            const response = await fetch(
                `${this.GEMINI_API_URL}?key=${this.GEMINI_API_KEY}`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
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

            if (!response.ok) {
                throw new Error(`API_ERROR_${response.status}`);
            }

            const data = await response.json();
            const inlineData = data.candidates?.[0]?.content?.parts?.[0]?.inlineData;
            
            if (!inlineData || !inlineData.data) {
                throw new Error("NO_DATA");
            }

            // Convert base64 PCM to WAV and play
            const audioBlob = this.pcmToWav(inlineData.data);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            
            audio.onplay = () => {
                this.isSpeaking = true;
                if (window.app && window.app.uiManager) {
                    window.app.uiManager.showAISpeechLoading(false);
                    window.app.uiManager.startAudioVisualizer();
                    window.app.log('SPEECH', `Started Gemini TTS: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
                }
            };
            
            audio.onended = () => {
                this.isSpeaking = false;
                this.currentSpeech = null;
                if (window.app && window.app.uiManager) {
                    window.app.uiManager.stopAudioVisualizer();
                    window.app.log('SPEECH', 'Ended Gemini TTS');
                }
            };
            
            audio.onerror = (error) => {
                this.isSpeaking = false;
                this.currentSpeech = null;
                if (window.app && window.app.uiManager) {
                    window.app.uiManager.showAISpeechLoading(false);
                    window.app.uiManager.stopAudioVisualizer();
                    window.app.log('SPEECH', `Gemini TTS error: ${error}`);
                }
            };
            
            this.currentSpeech = audio;
            audio.play();
            
        } catch (error) {
            console.error('Gemini TTS error:', error);
            if (window.app && window.app.uiManager) {
                window.app.uiManager.showAISpeechLoading(false);
                window.app.log('SPEECH', `Gemini TTS failed, falling back to Web Speech: ${error.message}`);
            }
            // Fall back to Web Speech
            this.speakWithWebSpeech(text, langCode);
        }
    }

    speakWithWebSpeech(text, langCode) {
        if (this.isSpeaking) {
            this.stopAllSpeech();
            return;
        }
        
        if (!('speechSynthesis' in window)) {
            if (window.app) {
                window.app.log('SPEECH', 'Speech synthesis not supported in this browser');
            }
            return;
        }
        
        window.speechSynthesis.cancel();
        
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = langCode;
        utterance.rate = 0.9;
        utterance.pitch = this.currentVoice.gender === 'male' ? 0.8 : 1.2;
        utterance.volume = 1;
        
        utterance.onstart = () => {
            this.isSpeaking = true;
            if (window.app && window.app.uiManager) {
                window.app.uiManager.startAudioVisualizer();
                window.app.log('SPEECH', `Started Web Speech: "${text.substring(0, 50)}${text.length > 50 ? '...' : ''}"`);
            }
        };
        
        utterance.onend = () => {
            this.isSpeaking = false;
            this.currentSpeech = null;
            if (window.app && window.app.uiManager) {
                window.app.uiManager.stopAudioVisualizer();
                window.app.log('SPEECH', 'Ended Web Speech');
            }
        };
        
        utterance.onerror = (event) => {
            this.isSpeaking = false;
            this.currentSpeech = null;
            if (window.app && window.app.uiManager) {
                window.app.uiManager.stopAudioVisualizer();
                window.app.log('SPEECH', `Web Speech error: ${event.error}`);
            }
        };
        
        this.currentSpeech = utterance;
        window.speechSynthesis.speak(utterance);
    }

    pcmToWav(base64PCM, sampleRate = 24000) {
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
    }

    stopAllSpeech() {
        if (window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        
        if (this.currentSpeech && this.currentSpeech.pause) {
            this.currentSpeech.pause();
            this.currentSpeech.currentTime = 0;
        }
        
        this.isSpeaking = false;
        this.currentSpeech = null;
        
        if (window.app && window.app.uiManager) {
            window.app.uiManager.stopAudioVisualizer();
            window.app.uiManager.showAISpeechLoading(false);
            window.app.log('SPEECH', 'Stopped all speech');
        }
    }

    selectVoice(lang, gender) {
        this.currentVoice = { lang, gender };
        
        if (window.app && window.app.uiManager) {
            window.app.uiManager.updateVoiceDisplay(lang, gender, this.useGeminiTTS);
            window.app.log('VOICE', `Selected voice: ${lang} ${gender}`);
        }
    }

    toggleTTSMode(useGemini) {
        this.useGeminiTTS = useGemini;
        
        if (window.app && window.app.uiManager) {
            window.app.uiManager.updateTTSMode(useGemini);
            window.app.log('TTS', `Switched to ${useGemini ? 'Gemini AI' : 'Web Speech'} TTS`);
        }
    }
}
