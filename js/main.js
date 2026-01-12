document.addEventListener('DOMContentLoaded', function() {
    log('SYSTEM', 'Optimized app started with calibration');
    
    // Khởi tạo FPS counter
    function updateFPS() {
        frameCount++;
        const currentTime = performance.now();
        if (currentTime - lastFrameTime >= 1000) {
            currentFPS = frameCount;
            frameCount = 0;
            lastFrameTime = currentTime;
            
            document.getElementById('fps').textContent = currentFPS;
            
            if (currentFPS < 30 && pollingInterval > 150) {
                pollingInterval = Math.min(pollingInterval * 1.5, 1000);
                updatePollingDisplay();
                log('PERF', `Low FPS (${currentFPS}), increased polling to ${pollingInterval}ms`);
            } else if (currentFPS > 50 && pollingInterval < 1000) {
                pollingInterval = Math.max(pollingInterval * 0.8, 150);
                updatePollingDisplay();
            }
        }
        requestAnimationFrame(updateFPS);
    }
    
    requestAnimationFrame(updateFPS);
    
    // Tải calibration từ localStorage nếu có
    loadCalibration();
    
    loadPhraseSuggestions();
    
    if ('speechSynthesis' in window) {
        speechSynthesis.getVoices();
        
        speechSynthesis.onvoiceschanged = function() {
            log('SPEECH', 'Loaded speech synthesis voices');
        };
    }
    
    // Setup event listeners
    setupEventListeners();
    
    if (!GEMINI_API_KEY) {
        log('SYSTEM', 'Note: Gemini API key not configured. Using Web Speech API.');
        useGeminiTTS = false;
    }
});

function setupEventListeners() {
    // Calibration buttons
    document.getElementById('calibrateBtn').addEventListener('click', startCalibration);
    document.getElementById('stopCalibrateBtn').addEventListener('click', stopCalibration);
    document.getElementById('resetCalibrationBtn').addEventListener('click', resetCalibration);
    document.getElementById('loadCalibrationBtn').addEventListener('click', loadCalibration);
    
    // Word construction buttons
    document.getElementById('clearCurrentWordBtn').addEventListener('click', clearCurrentWord);
    document.getElementById('backspaceBtn').addEventListener('click', backspace);
    document.getElementById('addWordBtn').addEventListener('click', addWordToSentence);
    document.getElementById('commitSentenceBtn').addEventListener('click', commitSentence);
    document.getElementById('resetSentenceBtn').addEventListener('click', resetSentence);
    
    // Translation buttons
    document.getElementById('translateBtn').addEventListener('click', translateSentence);
    document.getElementById('clearTranslationBtn').addEventListener('click', clearTranslation);
    document.getElementById('translationInput').addEventListener('input', handleTranslationInput);
    
    // Firebase controls
    document.getElementById('refreshDataBtn').addEventListener('click', refreshData);
    document.getElementById('autoRefreshBtn').addEventListener('click', toggleAutoRefresh);
    document.getElementById('turboBtn').addEventListener('click', toggleTurboMode);
    
    // Speech controls
    document.getElementById('speakVnBtn').addEventListener('click', speakVietnameseSentence);
    document.getElementById('speakTransBtn').addEventListener('click', speakTranslation);
    document.getElementById('stopSpeechBtn').addEventListener('click', stopAllSpeech);
    
    // TTS mode toggle
    document.getElementById('useGeminiTTS').addEventListener('click', () => toggleTTSMode(true));
    document.getElementById('useWebSpeech').addEventListener('click', () => toggleTTSMode(false));
    
    // Voice selection
    document.querySelectorAll('.voice-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            selectVoice(this);
        });
    });
    
    // Log controls
    document.getElementById('clearLogBtn').addEventListener('click', clearLog);
    document.getElementById('exportLogBtn').addEventListener('click', exportLog);
    
    setTimeout(() => {
        fetchFirebaseDataOptimized();
        toggleAutoRefresh();
    }, 100);
}
