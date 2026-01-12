class SensorProcessor {
    constructor() {
        this.flexStates = [0, 0, 0, 0];
        this.lastFlexStates = [-1, -1, -1, -1];
        this.displayBuffer = "";
        this.slot1 = "";
        this.slot2 = "";
        
        // Word construction state
        this.sentenceWords = [];
        this.fullSentence = "";
        this.convertedFullSentence = "";
        
        // State tracking
        this.stableCount = 0;
        this.lastDetectedIndex = -1;
        this.holdStartMs = 0;
        this.holdFired = false;
        this.lastActionMs = 0;
        this.lastStateString = '';
        
        // Constants
        this.DEBOUNCE_COUNT = 3;
        this.HOLD_MS_DEFAULT = 800;
        this.POST_HOLD_COOLDOWN = 600;
    }

    processSensorData(data) {
        // Update flex sensor states
        if (data.f0 !== undefined) {
            const flexValues = [data.f0, data.f1 || 0, data.f2 || 0, data.f3 || 0];
            for (let i = 0; i < 4; i++) {
                const newState = this.calculateFlexState(flexValues[i], i);
                if (this.flexStates[i] !== newState) {
                    this.flexStates[i] = newState;
                }
            }
        }
    }

    calculateFlexState(rawValue, sensorIndex) {
        const STRAIGHT_THRESHOLDS = [150, 150, 150, 100];
        const bentThresholds = window.app ? window.app.calibration.bentThresholds : [300, 450, 350, 300];
        
        const STRAIGHT_THRESHOLD = STRAIGHT_THRESHOLDS[sensorIndex];
        
        if (rawValue <= STRAIGHT_THRESHOLD) return 0;
        if (rawValue <= bentThresholds[sensorIndex]) return 1;
        return 2;
    }

    processWordConstruction(mpu, a0, a1, a2, a3) {
        const currentState = `${mpu}_${a0}_${a1}_${a2}_${a3}`;
        
        if (currentState !== this.lastStateString) {
            this.lastStateString = currentState;
            this.stableCount = 0;
            this.holdStartMs = Date.now();
            this.holdFired = false;
        } else {
            this.stableCount++;
        }
        
        this.lastFlexStates = [a0, a1, a2, a3];
        
        if (this.stableCount >= this.DEBOUNCE_COUNT) {
            const held = Date.now() - this.holdStartMs;
            if (!this.holdFired && held >= this.HOLD_MS_DEFAULT) {
                if (Date.now() - this.lastActionMs > this.POST_HOLD_COOLDOWN) {
                    this.performActionSlotLogic(mpu, a0, a1, a2, a3);
                    this.holdFired = true;
                    this.lastActionMs = Date.now();
                }
            }
        }
    }

    performActionSlotLogic(mpu, a0, a1, a2, a3) {
        const mapping = vietnameseConverter.getMappingForIndices(mpu, a0, a1, a2, a3);
        if (!mapping || mapping === "nullptr") return false;
        
        // Handle special mappings
        if (mapping === "_") {
            if (this.displayBuffer && this.displayBuffer.length > 0 && this.displayBuffer !== "---") {
                this.addWordToSentence();
            } else if (window.app) {
                window.app.log('WORD', 'Word separator detected, but no word in buffer');
            }
            return true;
        }
        
        if (mapping === "COMMIT") {
            this.commitSentence();
            return true;
        }
        
        if (mapping === "<") {
            this.backspaceBuffer();
            return true;
        }
        
        const isSlot1 = (a3 === 2);
        const held = Date.now() - this.holdStartMs;
        
        if (isSlot1 && this.stableCount >= this.DEBOUNCE_COUNT && held < this.HOLD_MS_DEFAULT) {
            const mode = this.flexModeCharFromA0(a0);
            this.slot2 = `${mapping}_${mode}`;
        } else if (isSlot1) {
            this.slot1 = `${mapping}_${mpu}`;
        } else {
            const mode = this.flexModeCharFromA0(a0);
            this.slot2 = `${mapping}_${mode}`;
        }
        
        this.updateDisplayBufferFromSlots();
        
        if (window.app) {
            window.app.log('WORD', `Action: ${this.displayBuffer}`);
        }
        return true;
    }

    flexModeCharFromA0(a0) {
        switch(a0) {
            case 0: return 's';
            case 1: return 'b';
            case 2: return 'p';
            default: return 'x';
        }
    }

    updateDisplayBufferFromSlots() {
        const oldBuffer = this.displayBuffer;
        this.displayBuffer = '';
        
        if (this.slot1) this.displayBuffer += this.slot1.toLowerCase();
        if (this.slot2) this.displayBuffer += this.slot2.toLowerCase();
        
        if (oldBuffer !== this.displayBuffer && window.app) {
            window.app.log('WORD', `Updated: ${this.displayBuffer}`);
        }
    }

    backspaceBuffer() {
        if (this.displayBuffer.length > 0) {
            this.displayBuffer = this.displayBuffer.slice(0, -1);
            if (window.app) {
                window.app.log('WORD', `Backspace - Buffer: ${this.displayBuffer}`);
            }
        }
    }

    addWordToSentence() {
        if (!this.displayBuffer || this.displayBuffer === "---" || this.displayBuffer.length === 0) {
            if (window.app) {
                window.app.log('SENTENCE', 'Cannot add empty word to sentence');
            }
            return;
        }
        
        if (this.sentenceWords.length < 10) {
            this.sentenceWords.push(this.displayBuffer);
            this.fullSentence = this.sentenceWords.join(' ');
            this.convertedFullSentence = vietnameseConverter.convertVietnameseText(this.fullSentence);
            
            if (window.app) {
                window.app.log('SENTENCE', `Added: '${this.displayBuffer}'`);
                window.app.uiManager.showAutoSuggestions(this.fullSentence, this.convertedFullSentence);
            }
            
            // Clear for next word
            this.slot1 = '';
            this.slot2 = '';
            this.displayBuffer = '';
        } else {
            if (window.app) {
                window.app.log('SENTENCE', 'Sentence full! Max 10 words.');
            }
        }
    }

    commitSentence() {
        if (this.sentenceWords.length === 0) {
            if (window.app) {
                window.app.log('SENTENCE', 'No words to commit!');
            }
            return;
        }
        
        // If there's a word in the buffer, add it first
        if (this.displayBuffer && this.displayBuffer.length > 0 && this.displayBuffer !== "---") {
            this.addWordToSentence();
        }
        
        if (window.app) {
            window.app.log('SENTENCE', '=== SENTENCE COMMITTED ===');
            window.app.log('SENTENCE', `Full: ${this.fullSentence}`);
            window.app.log('CONVERSION', `Converted: ${this.convertedFullSentence}`);
            
            // Auto-translate the sentence
            if (this.convertedFullSentence && this.convertedFullSentence !== "---") {
                window.app.uiManager.setTranslationInput(this.convertedFullSentence);
                setTimeout(() => {
                    window.app.translation.translateSentence(this.convertedFullSentence);
                }, 500);
            }
        }
        
        this.resetSentence();
    }

    resetSentence() {
        this.sentenceWords = [];
        this.fullSentence = '';
        this.convertedFullSentence = '';
        this.slot1 = '';
        this.slot2 = '';
        this.displayBuffer = '';
        
        if (window.app) {
            window.app.uiManager.hideAutoSuggestions();
            window.app.log('SENTENCE', 'Sentence reset');
        }
    }

    clearCurrentWord() {
        this.slot1 = '';
        this.slot2 = '';
        this.displayBuffer = '';
        
        if (window.app) {
            window.app.uiManager.hideDynamicSuggestions();
            window.app.log('WORD', 'Current word cleared');
        }
    }
}
