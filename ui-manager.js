class UIManager {
    constructor() {
        this.commonPhrases = [
            "Xin chào, rất vui được gặp bạn",
            "Bạn khỏe không?",
            "Cảm ơn bạn rất nhiều",
            "Làm ơn cho tôi hỏi đường",
            "Chúc một ngày tốt lành",
            "Tôi yêu ngôn ngữ này",
            "Hẹn gặp lại sau",
            "Tôi đói bụng",
            "Bao nhiêu tiền?",
            "Tôi không hiểu"
        ];
        
        this.logEntries = [];
        this.MAX_LOG_ENTRIES = 20;
    }

    initUI() {
        this.createSentenceBuilderCard();
        this.createCalibrationCard();
        this.createTranslationCard();
        this.createSensorCard();
        this.createLogCard();
        
        this.setupEventListeners();
    }

    createSentenceBuilderCard() {
        const card = document.getElementById('sentenceBuilderCard');
        card.innerHTML = `
            <h3>Xây dựng Câu</h3>
            <div style="text-align: center; padding: 20px; margin-bottom: 20px;">
                <div class="sensor-label">TỪ HIỆN TẠI (Mã hóa)</div>
                <div class="current-word-display" id="displayBuffer">---</div>
                <div class="sensor-label">TỪ HIỆN TẠI (Tiếng Việt)</div>
                <div class="conversion-display" id="convertedCurrentWord">---</div>
                
                <div style="margin: 15px 0; color: #666;">
                    <div><strong>Sử dụng '_' để thêm từ vào câu</strong></div>
                    <div><strong>Sử dụng 'COMMIT' để hoàn thành câu</strong></div>
                </div>
                
                <div class="sensor-label">CÂU ĐẦY ĐỦ (Mã hóa)</div>
                <div class="sentence-display" id="sentenceDisplay">---</div>
                <div class="sensor-label">CÂU ĐẦY ĐỦ (Tiếng Việt)</div>
                <div class="conversion-display" id="convertedSentenceDisplay">---</div>
                
                <!-- Chuyển đổi TTS -->
                <div class="tts-toggle">
                    <button class="tts-toggle-btn active" id="useGeminiTTS">🎯 Giọng AI Gemini</button>
                    <button class="tts-toggle-btn" id="useWebSpeech">🔊 Web Speech</button>
                </div>
                
                <!-- Bảng đề xuất tự động -->
                <div class="auto-suggestions-panel" id="autoSuggestionsPanel" style="display: none;">
                    <div class="auto-suggestions-title">
                        <span>💡 ĐỀ XUẤT DỰA TRÊN CÂU CỦA BẠN</span>
                    </div>
                    <div class="auto-suggestions-grid" id="autoSuggestionsGrid"></div>
                </div>
                
                <!-- Đề xuất cụm từ -->
                <div class="phrase-suggestions">
                    <h4>📝 ĐỀ XUẤT CỤM TỪ THÔNG DỤNG</h4>
                    <div class="phrase-pills" id="phrasePills"></div>
                    <div class="dynamic-suggestions" id="dynamicSuggestions"></div>
                </div>
                
                <!-- Tùy chọn giọng nói -->
                <div class="voice-options">
                    <div class="voice-btn male active" data-lang="vi-VN" data-gender="male">👨 Nam Tiếng Việt</div>
                    <div class="voice-btn female" data-lang="vi-VN" data-gender="female">👩 Nữ Tiếng Việt</div>
                    <div class="voice-btn male" data-lang="en-GB" data-gender="male">👨 Nam Tiếng Anh</div>
                    <div class="voice-btn female" data-lang="en-GB" data-gender="female">👩 Nữ Tiếng Anh</div>
                </div>
                
                <div class="language-voice-display" id="currentVoiceDisplay">
                    Hiện tại: Nam Tiếng Việt (Gemini AI)
                </div>
                
                <div class="ai-speech-status" id="aiSpeechStatus" style="display: none;">
                    <span class="ai-loading">⏳</span> Đang tải giọng AI...
                </div>
                
                <!-- Điều khiển giọng nói -->
                <div class="speech-controls">
                    <button class="speech-btn" id="speakVnBtn">🔊 Đọc Tiếng Việt</button>
                    <button class="speech-btn blue" id="speakTransBtn">🔈 Đọc Bản dịch</button>
                    <button class="speech-btn red" id="stopSpeechBtn">⏹ Dừng đọc</button>
                </div>
                
                <div class="audio-visualizer" id="audioVisualizer"></div>
                
                <div class="word-list" id="wordList">Chưa có từ nào</div>
                <div class="word-count">Số từ trong câu: <span id="wordCount">0</span>/10</div>
                
                <div style="display: flex; justify-content: space-around; margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                    <div>
                        <div class="sensor-label">KHE 1</div>
                        <div class="sensor-value" id="slot1" style="font-size: 1.2rem;">---</div>
                    </div>
                    <div>
                        <div class="sensor-label">KHE 2</div>
                        <div class="sensor-value" id="slot2" style="font-size: 1.2rem;">---</div>
                    </div>
                </div>
                
                <div class="controls">
                    <button class="red" id="clearWordBtn">Xóa từ hiện tại</button>
                    <button id="backspaceBtn">Xóa ký tự</button>
                    <button class="green" id="addWordBtn">Thêm từ (_)</button>
                    <button class="blue" id="commitBtn">Hoàn thành câu</button>
                    <button class="red" id="resetBtn">Đặt lại tất cả</button>
                </div>
            </div>
        `;
    }

    createCalibrationCard() {
        const card = document.getElementById('calibrationCard');
        card.innerHTML = `
            <h3>🎯 Calibration Cảm biến Uốn</h3>
            
            <div class="calibration-instructions">
                <h4>📋 Hướng dẫn Calibration:</h4>
                <div class="calibration-step">Đặt tay thẳng và thư giãn</div>
                <div class="calibration-step">Nhấn "Bắt đầu Calibration"</div>
                <div class="calibration-step">Lần lượt uốn từng ngón tay hết mức có thể (10 giây)</div>
                <div class="calibration-step">Hệ thống sẽ tự động lưu giá trị bent threshold</div>
                <div class="calibration-step">Sau khi hoàn thành, hệ thống sẽ sử dụng giá trị đã calibration</div>
            </div>
            
            <div class="calibration-status" id="calibrationStatus">
                <div class="calibration-ready">Sẵn sàng để Calibration</div>
            </div>
            
            <!-- Hiển thị quá trình calibration -->
            <div id="calibrationProgress" style="display: none;">
                <div class="calibration-countdown" id="calibrationCountdown">10</div>
                <div style="text-align: center; margin: 10px 0; font-weight: bold; color: #4A00E0;">
                    <span id="calibrationMessage">Đang calibration... Vui lòng uốn ngón tay hết mức!</span>
                </div>
                
                <div class="calibration-display" id="calibrationDisplay"></div>
                
                <div class="progress-container">
                    <div class="progress-bar" id="calibrationProgressBar" style="width: 0%"></div>
                </div>
            </div>
            
            <!-- Hiển thị threshold hiện tại -->
            <div class="sensor-calibration" style="margin-top: 20px;">
                <div class="sensor-label">THRESHOLD HIỆN TẠI</div>
                <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; margin-top: 10px;">
                    <div>
                        <div class="sensor-name">Flex 0</div>
                        <div class="sensor-threshold" id="currentThreshold0">300</div>
                    </div>
                    <div>
                        <div class="sensor-name">Flex 1</div>
                        <div class="sensor-threshold" id="currentThreshold1">450</div>
                    </div>
                    <div>
                        <div class="sensor-name">Flex 2</div>
                        <div class="sensor-threshold" id="currentThreshold2">350</div>
                    </div>
                    <div>
                        <div class="sensor-name">Flex 3</div>
                        <div class="sensor-threshold" id="currentThreshold3">300</div>
                    </div>
                </div>
            </div>
            
            <div class="flex-sensor-legend">
                <div class="legend-item">
                    <div class="legend-color" style="background: #4CAF50;"></div>
                    <div class="legend-text">Thẳng (0)</div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #FF9800;"></div>
                    <div class="legend-text">Hơi uốn (1)</div>
                </div>
                <div class="legend-item">
                    <div class="legend-color" style="background: #F44336;"></div>
                    <div class="legend-text">Uốn hết (2)</div>
                </div>
            </div>
            
            <div class="controls">
                <button class="orange" id="calibrateBtn">🎯 Bắt đầu Calibration</button>
                <button class="red" id="stopCalibrateBtn" style="display: none;">⏹ Dừng Calibration</button>
                <button class="purple" id="resetCalibrationBtn">🔄 Reset về Mặc định</button>
                <button class="blue" id="loadCalibrationBtn">💾 Tải Calibration</button>
            </div>
            
            <div class="calibration-info" style="margin-top: 15px; font-size: 0.8rem; color: #666; text-align: center;">
                <div>Threshold thẳng cố định: Flex 0-2: 150, Flex 3: 100</div>
                <div>Threshold bent sẽ được calibration tự động</div>
            </div>
        `;
    }

    createTranslationCard() {
        const card = document.getElementById('translationCard');
        card.innerHTML = `
            <h3>Dịch thuật</h3>
            <div style="margin-bottom: 20px;">
                <div class="sensor-label">CÂU ĐẦY ĐỦ (Tiếng Việt - Để dịch)</div>
                <div class="text-input-container">
                    <textarea id="translationInput" placeholder="Nhập văn bản tiếng Việt ở đây..."></textarea>
                    <div class="dynamic-suggestions" id="translationSuggestions"></div>
                </div>
                
                <div style="margin: 15px 0; padding: 15px; background: #f8f9fa; border-radius: 10px;">
                    <div><strong>Tùy chọn dịch thuật:</strong></div>
                    <div style="display: flex; gap: 15px; margin-top: 10px; flex-wrap: wrap;">
                        <div>
                            <div class="sensor-label">Ngôn ngữ đích</div>
                            <select id="targetLanguage" class="language-select">
                                <option value="en-GB">Tiếng Anh</option>
                                <option value="ja-JP">Tiếng Nhật</option>
                                <option value="ko-KR">Tiếng Hàn</option>
                                <option value="zh-CN">Tiếng Trung</option>
                            </select>
                        </div>
                        <div>
                            <div class="sensor-label">Ngôn ngữ giọng nói</div>
                            <select id="voiceLanguage" class="language-select">
                                <option value="vi-VN">Tiếng Việt</option>
                                <option value="en-GB">Tiếng Anh</option>
                                <option value="ja-JP">Tiếng Nhật</option>
                                <option value="ko-KR">Tiếng Hàn</option>
                                <option value="zh-CN">Tiếng Trung</option>
                            </select>
                        </div>
                    </div>
                </div>
            </div>

            <div class="sensor-label">KẾT QUẢ DỊCH</div>
            <div id="translationOutput" class="conversion-display" style="min-height: 80px; margin-bottom: 15px;">
                Đang chờ dịch...
            </div>

            <div class="controls">
                <button class="blue" id="translateBtn">Dịch câu</button>
                <button class="red" id="clearTranslationBtn">Xóa bản dịch</button>
            </div>
        `;
    }

    createSensorCard() {
        const card = document.getElementById('sensorCard');
        card.innerHTML = `
            <h3>Dữ liệu Cảm biến từ Firebase</h3>
            <div class="sensor-grid">
                <div class="sensor-item mpu">
                    <div class="sensor-label">ĐỊNH HƯỚNG MPU6050</div>
                    <div class="sensor-value" id="mpuOrientation">Không xác định</div>
                    <div class="sensor-label">TRẠNG THÁI LẮC</div>
                    <div class="sensor-value" id="mpuShakeState">Không</div>
                    <div class="sensor-label">ĐANG LẮC?</div>
                    <div class="sensor-value" id="isShaking">KHÔNG</div>
                </div>
                <div class="sensor-item flex">
                    <div class="sensor-label">CẢM BIẾN UỐN</div>
                    <div>
                        <div>
                            <span class="flex-box" id="flex0-box">0</span>
                            <span class="flex-box" id="flex1-box">0</span>
                            <span class="flex-box" id="flex2-box">0</span>
                            <span class="flex-box" id="flex3-box">0</span>
                        </div>
                        <div class="sensor-label" style="margin-top: 10px;">
                            Giá trị thô: <span id="rawValues">0, 0, 0, 0</span>
                        </div>
                        <div class="sensor-label">
                            Trạng thái: <span id="flexFormat">0000</span> (a0,a1,a2,a3)
                        </div>
                    </div>
                </div>
            </div>
            
            <div class="sensor-item" style="margin-top: 15px;">
                <div class="sensor-label">TRẠNG THÁI HỆ THỐNG</div>
                <div>Cập nhật lần cuối: <span id="lastUpdateTime" class="last-update">Chưa bao giờ</span></div>
                <div>Thời gian xử lý: <span id="processingTime" class="last-update">0ms</span></div>
            </div>
            
            <div class="controls" style="margin-top: 15px;">
                <button class="blue" id="refreshBtn">Làm mới ngay</button>
                <button class="green" id="autoRefreshBtn">Tự động: BẬT (300ms)</button>
                <button class="green" id="turboBtn">🚀 Chế độ Turbo</button>
            </div>
        `;
    }

    createLogCard() {
        const card = document.getElementById('logCard');
        card.innerHTML = `
            <h3>Nhật ký Hệ thống</h3>
            <div style="max-height: 300px; overflow-y: auto; background: #f8f9fa; border-radius: 8px; padding: 10px;">
                <div id="logContainer">
                    <div class="log-entry">Hệ thống đã khởi động. Đang chờ dữ liệu Firebase...</div>
                </div>
            </div>
            <div class="controls" style="margin-top: 15px;">
                <button class="red" id="clearLogBtn">Xóa nhật ký</button>
                <button class="blue" id="exportLogBtn">Xuất nhật ký</button>
            </div>
        `;
    }

    setupEventListeners() {
        // Sentence builder events
        document.getElementById('clearWordBtn').addEventListener('click', () => {
            if (window.app && window.app.sensorProcessor) {
                window.app.sensorProcessor.clearCurrentWord();
            }
        });
        
        document.getElementById('backspaceBtn').addEventListener('click', () => {
            if (window.app && window.app.sensorProcessor) {
                window.app.sensorProcessor.backspaceBuffer();
            }
        });
        
        document.getElementById('addWordBtn').addEventListener('click', () => {
            if (window.app && window.app.sensorProcessor) {
                window.app.sensorProcessor.addWordToSentence();
            }
        });
        
        document.getElementById('commitBtn').addEventListener('click', () => {
            if (window.app && window.app.sensorProcessor) {
                window.app.sensorProcessor.commitSentence();
            }
        });
        
        document.getElementById('resetBtn').addEventListener('click', () => {
            if (window.app && window.app.sensorProcessor) {
                window.app.sensorProcessor.resetSentence();
            }
        });
        
        // Speech events
        document.getElementById('speakVnBtn').addEventListener('click', () => {
            if (window.app && window.app.sensorProcessor && window.app.speechTTS) {
                const text = window.app.sensorProcessor.convertedFullSentence || 
                           document.getElementById('convertedSentenceDisplay').textContent;
                if (text && text !== '---') {
                    window.app.speechTTS.speakText(text, window.app.speechTTS.currentVoice.lang);
                }
            }
        });
        
        document.getElementById('speakTransBtn').addEventListener('click', () => {
            if (window.app && window.app.speechTTS) {
                const text = document.getElementById('translationOutput').textContent;
                if (text && !text.includes('Đang chờ dịch') && !text.includes('Vui lòng nhập')) {
                    const lang = document.getElementById('voiceLanguage').value;
                    window.app.speechTTS.speakText(text, lang);
                }
            }
        });
        
        document.getElementById('stopSpeechBtn').addEventListener('click', () => {
            if (window.app && window.app.speechTTS) {
                window.app.speechTTS.stopAllSpeech();
            }
        });
        
        // TTS mode toggle
        document.getElementById('useGeminiTTS').addEventListener('click', () => {
            if (window.app && window.app.speechTTS) {
                window.app.speechTTS.toggleTTSMode(true);
            }
        });
        
        document.getElementById('useWebSpeech').addEventListener('click', () => {
            if (window.app && window.app.speechTTS) {
                window.app.speechTTS.toggleTTSMode(false);
            }
        });
        
        // Voice selection
        document.querySelectorAll('.voice-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const lang = btn.getAttribute('data-lang');
                const gender = btn.getAttribute('data-gender');
                if (window.app && window.app.speechTTS) {
                    window.app.speechTTS.selectVoice(lang, gender);
                }
            });
        });
        
        // Calibration events
        document.getElementById('calibrateBtn').addEventListener('click', () => {
            if (window.app && window.app.calibration) {
                window.app.calibration.startCalibration();
            }
        });
        
        document.getElementById('stopCalibrateBtn').addEventListener('click', () => {
            if (window.app && window.app.calibration) {
                window.app.calibration.stopCalibration();
            }
        });
        
        document.getElementById('resetCalibrationBtn').addEventListener('click', () => {
            if (window.app && window.app.calibration) {
                window.app.calibration.resetCalibration();
            }
        });
        
        document.getElementById('loadCalibrationBtn').addEventListener('click', () => {
            if (window.app && window.app.calibration) {
                window.app.calibration.loadSavedThresholds();
            }
        });
        
        // Translation events
        document.getElementById('translateBtn').addEventListener('click', () => {
            if (window.app && window.app.translation) {
                const text = document.getElementById('translationInput').value.trim();
                const targetLang = document.getElementById('targetLanguage').value;
                window.app.translation.translateSentence(text, targetLang)
                    .then(translated => {
                        document.getElementById('translationOutput').textContent = translated;
                        document.getElementById('translationOutput').className = 'conversion-display success';
                    })
                    .catch(error => {
                        document.getElementById('translationOutput').textContent = 
                            'Lỗi dịch thuật: ' + error;
                        document.getElementById('translationOutput').className = 'conversion-display error';
                    });
            }
        });
        
        document.getElementById('clearTranslationBtn').addEventListener('click', () => {
            document.getElementById('translationOutput').textContent = 'Đang chờ dịch...';
            document.getElementById('translationOutput').className = 'conversion-display';
            if (window.app && window.app.translation) {
                window.app.translation.clearCache();
            }
        });
        
        // Firebase control events
        document.getElementById('refreshBtn').addEventListener('click', () => {
            if (window.app && window.app.firebaseService) {
                window.app.firebaseService.fetchData();
            }
        });
        
        document.getElementById('autoRefreshBtn').addEventListener('click', () => {
            if (window.app && window.app.firebaseService) {
                const isAutoRefresh = window.app.firebaseService.toggleAutoRefresh();
                const btn = document.getElementById('autoRefreshBtn');
                if (isAutoRefresh) {
                    btn.textContent = `Tự động: BẬT (${window.app.firebaseService.pollingInterval}ms)`;
                    btn.className = 'green';
                } else {
                    btn.textContent = 'Tự động: TẮT';
                    btn.className = 'red';
                }
            }
        });
        
        document.getElementById('turboBtn').addEventListener('click', () => {
            if (window.app && window.app.firebaseService) {
                const isTurbo = !window.app.firebaseService.turboMode;
                window.app.firebaseService.setTurboMode(isTurbo);
                const btn = document.getElementById('turboBtn');
                const indicator = document.getElementById('fastModeIndicator');
                if (isTurbo) {
                    btn.textContent = '🚀 Turbo: BẬT';
                    btn.className = 'red';
                    indicator.style.display = 'block';
                } else {
                    btn.textContent = '🚀 Chế độ Turbo';
                    btn.className = 'green';
                    indicator.style.display = 'none';
                }
            }
        });
        
        // Log events
        document.getElementById('clearLogBtn').addEventListener('click', () => {
            this.clearLog();
        });
        
        document.getElementById('exportLogBtn').addEventListener('click', () => {
            this.exportLog();
        });
        
        // Translation input events
        document.getElementById('translationInput').addEventListener('input', (e) => {
            this.handleTranslationInput(e.target.value);
        });
    }

    // ... (All the UI update methods from the original code)
    // Due to character limits, I'll include a few key methods, but you get the idea

    updateSensorDisplay(data, flexStates) {
        // Update MPU orientation
        if (data.o !== undefined) {
            document.getElementById('mpuOrientation').textContent = data.o || 'N/A';
        }
        
        if (data.d !== undefined) {
            document.getElementById('mpuShakeState').textContent = data.d || 'No';
        }
        
        if (data.sf !== undefined) {
            document.getElementById('isShaking').textContent = data.sf || 'NO';
        }
        
        // Update flex boxes
        for (let i = 0; i < 4; i++) {
            const box = document.getElementById(`flex${i}-box`);
            if (box) {
                box.textContent = flexStates[i];
                box.className = `flex-box active-${flexStates[i]}`;
            }
        }
        
        // Update raw values
        if (data.f0 !== undefined) {
            const rawValues = [data.f0 || 0, data.f1 || 0, data.f2 || 0, data.f3 || 0];
            document.getElementById('rawValues').textContent = rawValues.join(', ');
            document.getElementById('flexFormat').textContent = flexStates.join('');
        }
        
        // Update last update time
        document.getElementById('lastUpdate').textContent = 
            `Cập nhật: ${this.formatTime(Date.now())}`;
        document.getElementById('lastUpdateTime').textContent = this.formatTime(Date.now());
    }

    updateCurrentWord(displayBuffer, convertedWord) {
        document.getElementById('displayBuffer').textContent = displayBuffer || '---';
        document.getElementById('convertedCurrentWord').textContent = convertedWord || '---';
        
        if (window.app && window.app.sensorProcessor) {
            document.getElementById('slot1').textContent = window.app.sensorProcessor.slot1 || '---';
            document.getElementById('slot2').textContent = window.app.sensorProcessor.slot2 || '---';
        }
    }

    updateSentenceDisplay() {
        if (window.app && window.app.sensorProcessor) {
            document.getElementById('sentenceDisplay').textContent = 
                window.app.sensorProcessor.fullSentence || '---';
            document.getElementById('convertedSentenceDisplay').textContent = 
                window.app.sensorProcessor.convertedFullSentence || '---';
            
            // Update word list
            const wordListDiv = document.getElementById('wordList');
            if (window.app.sensorProcessor.sentenceWords.length > 0) {
                wordListDiv.innerHTML = window.app.sensorProcessor.sentenceWords.map(word => 
                    `<div class="word-item">${word}</div>`
                ).join('');
            } else {
                wordListDiv.innerHTML = 'Chưa có từ nào';
            }
            
            // Update word count
            document.getElementById('wordCount').textContent = 
                window.app.sensorProcessor.sentenceWords.length;
        }
    }

    showCalibrationProgress() {
        document.getElementById('calibrationProgress').style.display = 'block';
        document.getElementById('calibrateBtn').style.display = 'none';
        document.getElementById('stopCalibrateBtn').style.display = 'inline-block';
        
        // Create sensor displays
        const display = document.getElementById('calibrationDisplay');
        display.innerHTML = '';
        
        for (let i = 0; i < 4; i++) {
            const sensorDiv = document.createElement('div');
            sensorDiv.className = 'sensor-calibration';
            sensorDiv.id = `calibrationSensor${i}`;
            sensorDiv.innerHTML = `
                <div class="sensor-name">FLEX ${i}</div>
                <div class="sensor-value">0</div>
                <div class="sensor-max">Max: 0</div>
                <div class="progress-container">
                    <div class="progress-bar" id="progressBar${i}" style="width: 0%"></div>
                </div>
            `;
            display.appendChild(sensorDiv);
        }
    }

    updateCalibrationCountdown(countdown) {
        document.getElementById('calibrationCountdown').textContent = countdown;
    }

    updateCalibrationProgress(current, total) {
        const progress = (current / total) * 100;
        document.getElementById('calibrationProgressBar').style.width = `${progress}%`;
    }

    updateCalibrationSensors(flexValues, maxValues) {
        for (let i = 0; i < 4; i++) {
            const valueElement = document.querySelector(`#calibrationSensor${i} .sensor-value`);
            if (valueElement) {
                valueElement.textContent = flexValues[i] || 0;
            }
            
            // Update max values
            if (flexValues[i] > maxValues[i]) {
                maxValues[i] = flexValues[i];
                const maxElement = document.querySelector(`#calibrationSensor${i} .sensor-max`);
                if (maxElement) {
                    maxElement.textContent = `Max: ${flexValues[i]}`;
                    maxElement.style.color = '#F44336';
                }
            }
            
            // Update progress bars
            const progressValue = Math.min((flexValues[i] / 1024) * 100, 100);
            const progressBar = document.getElementById(`progressBar${i}`);
            if (progressBar) {
                progressBar.style.width = `${progressValue}%`;
                
                // Change color based on bend level
                if (progressValue < 30) {
                    progressBar.style.background = '#4CAF50';
                } else if (progressValue < 70) {
                    progressBar.style.background = '#FF9800';
                } else {
                    progressBar.style.background = '#F44336';
                }
            }
        }
    }

    updateCalibrationStatus(status, message) {
        const statusDiv = document.getElementById('calibrationStatus');
        statusDiv.innerHTML = '';
        
        let statusClass = "";
        let statusText = "";
        
        switch(status) {
            case "calibrating":
                statusClass = "calibrating";
                statusText = "ĐANG CALIBRATION";
                break;
            case "calibrated":
                statusClass = "calibrated";
                statusText = "ĐÃ CALIBRATION";
                break;
            case "error":
                statusClass = "calibration-error";
                statusText = "LỖI CALIBRATION";
                break;
            default:
                statusClass = "calibration-ready";
                statusText = "SẴN SÀNG";
        }
        
        const div = document.createElement('div');
        div.className = statusClass;
        div.innerHTML = `
            <div>${statusText}</div>
            <div style="font-size: 0.9rem; margin-top: 5px;">${message}</div>
        `;
        statusDiv.appendChild(div);
    }

    hideCalibrationProgress() {
        document.getElementById('calibrationProgress').style.display = 'none';
        document.getElementById('calibrateBtn').style.display = 'inline-block';
        document.getElementById('stopCalibrateBtn').style.display = 'none';
    }

    updateThresholdDisplay(thresholds) {
        for (let i = 0; i < 4; i++) {
            document.getElementById(`currentThreshold${i}`).textContent = thresholds[i];
        }
    }

    loadPhraseSuggestions() {
        const phrasePills = document.getElementById('phrasePills');
        phrasePills.innerHTML = '';
        
        this.commonPhrases.forEach(phrase => {
            const pill = document.createElement('button');
            pill.className = 'phrase-pill';
            pill.textContent = phrase.length > 30 ? phrase.substring(0, 27) + '...' : phrase;
            pill.onclick = () => {
                document.getElementById('translationInput').value = phrase;
                if (window.app && window.app.translation) {
                    window.app.translation.translateSentence(phrase)
                        .then(translated => {
                            document.getElementById('translationOutput').textContent = translated;
                            document.getElementById('translationOutput').className = 'conversion-display success';
                        });
                }
                if (window.app) {
                    window.app.log('PHRASE', `Selected phrase: "${phrase}"`);
                }
            };
            pill.title = phrase;
            phrasePills.appendChild(pill);
        });
    }

    showAutoSuggestions(fullSentence, convertedSentence) {
        if (!fullSentence || fullSentence.length === 0) {
            document.getElementById('autoSuggestionsPanel').style.display = 'none';
            return;
        }
        
        const panel = document.getElementById('autoSuggestionsPanel');
        const grid = document.getElementById('autoSuggestionsGrid');
        
        // Create suggestions based on current sentence
        const suggestions = [];
        
        if (convertedSentence.includes('xin chào') || convertedSentence.includes('chào')) {
            suggestions.push({
                text: 'Xin chào, rất vui được gặp bạn',
                type: 'greeting'
            });
        }
        
        if (convertedSentence.includes('cảm ơn')) {
            suggestions.push({
                text: 'Không có gì, rất vui được giúp đỡ',
                type: 'response'
            });
        }
        
        if (convertedSentence.includes('tên') || convertedSentence.includes('bạn tên')) {
            suggestions.push({
                text: 'Tôi là trợ lý ngôn ngữ, rất vui được giúp bạn',
                type: 'introduction'
            });
        }
        
        // Add default suggestions
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
                    <button class="auto-suggestion-btn speak" onclick="window.app.speechTTS.speakText('${suggestion.text}', 'vi-VN')">🔊 Đọc</button>
                    <button class="auto-suggestion-btn use" onclick="window.app.uiManager.useSuggestion('${suggestion.text}')">📝 Dùng</button>
                    <button class="auto-suggestion-btn translate" onclick="window.app.uiManager.translateSuggestion('${suggestion.text}')">🌐 Dịch</button>
                </div>
            </div>
        `).join('');
        
        panel.style.display = 'block';
    }

    useSuggestion(text) {
        document.getElementById('translationInput').value = text;
        if (window.app && window.app.translation) {
            window.app.translation.translateSentence(text);
        }
        if (window.app) {
            window.app.log('SUGGESTION', `Using suggestion: "${text}"`);
        }
    }

    translateSuggestion(text) {
        document.getElementById('translationInput').value = text;
        if (window.app && window.app.translation) {
            window.app.translation.translateSentence(text);
        }
        if (window.app) {
            window.app.log('SUGGESTION', `Translating suggestion: "${text}"`);
        }
    }

    hideAutoSuggestions() {
        document.getElementById('autoSuggestionsPanel').style.display = 'none';
    }

    hideDynamicSuggestions() {
        const suggestionsDiv = document.getElementById('dynamicSuggestions');
        suggestionsDiv.innerHTML = '';
        suggestionsDiv.classList.remove('show');
    }

    setTranslationInput(text) {
        document.getElementById('translationInput').value = text;
    }

    handleTranslationInput(input) {
        const suggestionsDiv = document.getElementById('translationSuggestions');
        
        if (!input || input.trim().length === 0) {
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.remove('show');
            return;
        }
        
        const inputLower = input.toLowerCase();
        const filteredPhrases = this.commonPhrases.filter(phrase => 
            phrase.toLowerCase().includes(inputLower)
        );
        
        if (filteredPhrases.length > 0) {
            suggestionsDiv.innerHTML = filteredPhrases.map(phrase => `
                <div class="suggestion-item" onclick="window.app.uiManager.selectTranslationSuggestion('${phrase}')">
                    ${phrase}
                </div>
            `).join('');
            suggestionsDiv.classList.add('show');
        } else {
            suggestionsDiv.innerHTML = '';
            suggestionsDiv.classList.remove('show');
        }
    }

    selectTranslationSuggestion(phrase) {
        document.getElementById('translationInput').value = phrase;
        document.getElementById('translationSuggestions').innerHTML = '';
        document.getElementById('translationSuggestions').classList.remove('show');
        if (window.app && window.app.translation) {
            window.app.translation.translateSentence(phrase);
        }
    }

    addLogEntry(source, message) {
        const timestamp = new Date().toLocaleTimeString();
        const logEntry = { timestamp, source, message };
        
        this.logEntries.unshift(logEntry);
        if (this.logEntries.length > this.MAX_LOG_ENTRIES) {
            this.logEntries.pop();
        }
        
        this.updateLogDisplay();
    }

    updateLogDisplay() {
        const logContainer = document.getElementById('logContainer');
        const visibleEntries = this.logEntries.slice(0, 5);
        
        logContainer.innerHTML = visibleEntries.map(entry => 
            `<div class="log-entry">
                <span style="color: #666; font-size: 0.8rem;">[${entry.timestamp}] ${entry.source}:</span>
                <span style="color: #333;"> ${entry.message}</span>
            </div>`
        ).join('');
    }

    clearLog() {
        this.logEntries = [];
        this.updateLogDisplay();
        if (window.app) {
            window.app.log('SYSTEM', 'Log cleared');
        }
    }

    exportLog() {
        const logText = this.logEntries.map(entry => 
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
        
        if (window.app) {
            window.app.log('SYSTEM', 'Log exported');
        }
    }

    updateConnectionStatus(connected) {
        const indicator = document.getElementById('connectionStatus');
        const statusText = document.getElementById('statusText');
        const firebaseStatus = document.getElementById('firebaseStatus');
        
        if (connected) {
            indicator.className = 'indicator online';
            statusText.textContent = 'Đã kết nối với Firebase';
            firebaseStatus.textContent = 'Đã kết nối với Firebase';
            firebaseStatus.style.color = '#4CAF50';
        } else {
            indicator.className = 'indicator';
            indicator.style.background = '#F44336';
            statusText.textContent = 'Mất kết nối với Firebase';
            firebaseStatus.textContent = 'Mất kết nối với Firebase';
            firebaseStatus.style.color = '#F44336';
        }
    }

    updateLatency(latency) {
        document.getElementById('latency').textContent = latency;
    }

    updateFPS(fps) {
        document.getElementById('fps').textContent = fps;
    }

    updatePollingRate(rate) {
        document.getElementById('pollingRate').textContent = rate;
    }

    updateVoiceDisplay(lang, gender, useGeminiTTS) {
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
            `Hiện tại: ${langNames[lang] || lang} ${genderNames[gender] || gender} (${ttsMode})`;
        
        // Update active button
        document.querySelectorAll('.voice-btn').forEach(btn => {
            btn.classList.remove('active');
            if (btn.getAttribute('data-lang') === lang && btn.getAttribute('data-gender') === gender) {
                btn.classList.add('active');
            }
        });
    }

    updateTTSMode(useGemini) {
        document.getElementById('useGeminiTTS').classList.toggle('active', useGemini);
        document.getElementById('useWebSpeech').classList.toggle('active', !useGemini);
    }

    showAISpeechLoading(show) {
        document.getElementById('aiSpeechStatus').style.display = show ? 'flex' : 'none';
    }

    startAudioVisualizer() {
        this.stopAudioVisualizer();
        
        const visualizer = document.getElementById('audioVisualizer');
        visualizer.innerHTML = '';
        
        for (let i = 0; i < 20; i++) {
            const bar = document.createElement('div');
            bar.className = 'audio-bar';
            bar.style.height = '5px';
            visualizer.appendChild(bar);
        }
        
        const bars = visualizer.querySelectorAll('.audio-bar');
        this.audioVisualizerInterval = setInterval(() => {
            bars.forEach(bar => {
                const height = 5 + Math.random() * 35;
                bar.style.height = `${height}px`;
                bar.style.backgroundColor = `hsl(${120 + Math.random() * 60}, 70%, 50%)`;
            });
        }, 100);
    }

    stopAudioVisualizer() {
        if (this.audioVisualizerInterval) {
            clearInterval(this.audioVisualizerInterval);
            this.audioVisualizerInterval = null;
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

    formatTime(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }
}
