// vietnamese-processor.js
// This JavaScript file processes raw data from Firebase exactly like the ESP32 code

// Firebase configuration
const FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app";

// ===== CALIBRATION VARIABLES (matching ESP32 code) =====
let rawFlexValues = [0, 0, 0, 0];  // Raw analog values from Firebase
let calibrating = false;
let calibrationComplete = false;
let calibrationStartTime = 0;
const CALIBRATION_DURATION = 10000; // 10 seconds

// Fixed straight threshold (as per ESP32 requirement)
const STRAIGHT_THRESHOLD = 150;

// Calibrated bent thresholds (will be found during calibration)
let flexBentThresholds = [300, 450, 350, 300]; // Default values (A0, A1, A2, A3)

// Current flex states (0,1,2 after calibration)
let flexStates = [0, 0, 0, 0];
let lastFlexStates = [-1, -1, -1, -1];
let lastFlexUpdate = 0;

// Tables for word construction - CORRECTED ORDER (matching ESP32)
const tableA = [
  ["IAY","IC","ICH","IE","IEC","IEM","IEN","IENG","IEO"],  // Row 1 (index 0)5
  ["IEP","IET","IEU","IM","IN","ING","INH","IO","IOI"],    // Row 2 (index 1)6  
  ["ENG","ENH","EO","EP","ET","EU","I","IA","IAC"],        // Row 3 (index 2)3
  ["IAI","IAM","IAN","IANG","IANH","IAO","IAP","IAT","IAU"], // Row 8 (index 7)4
  ["AP","AT","AU","AY","E","EC","ECH","EM","EN"],          // Row 5 (index 4)2
  ["A","AC","ACH","AI","AM","AN","ANG","ANH","AO"],        // Row 6 (index 5)1
  ["IUN","IUONG","IUP","O","OA","OAC","OACH","OAI","OAM"], // Row 7 (index 6)8
  ["ION","IONG","IOT","IP","IT","IU","IUA","IUC","IUI"],   // Row 4 (index 3)7
];

const tableB = [
  ["UE","UECH","UEN","UENH","UEO","UET","UI","UM","UN"],                     // Row 5
  ["UNG","UO","UOC","UOI","UOM","UON","UONG","UOP","OUT"],                   // Row 6
  ["ONG","OOC","OONG","OP","OT","U","UA","UAC","UACH"],                      // Row 3
  ["UAI","UAM","UAN","UANG","UANH","UAO","UAT","UAY","UC"],                  // Row 4
  ["OAY","OC","OE","OEN","OEO","OET","OI","OM","ON"],                        // Row 2
  ["COMMIT","_",null,null,"OAN","OANG","OANH","OAP","OAT"],  // Row 1
  ["UYNH","UYP","UYT","UYU","Y","YEM","YEN","YET","YEU"],                    // Row 8
  ["UOU","UP","UT","UU","UY","UYA","UYCH","UYEN","UYET"],                    // Row 7
];

const tableC = [
  [ ["B","C","D"],["Đ","G","H"],["K","L","M"] ],
  [ ["N","P","Q"],["R","S","T"],["V","X","CH"] ],
  [ ["GH","KH","NG"],["NGH","NH","PH"],["TH","TR","_"] ]
];

// Vietnamese conversion table (simplified - you'll need the full table)
const vietnameseTable = [
  {key: "IAY", forms: ["iáy","iày","iảy","iãy","iạy","iay","iấy","iầy","iẩy","iẫy","iậy","iây","iắy","iằy","iẳy","iẵy","iặy","iăy"]},
  {key: "IC", forms: ["íc","ìc","ỉc","ĩc","ịc","ic","íc","ìc","ỉc","ĩc","ịc","ic","íc","ìc","ỉc","ĩc","ịc","ic"]},
  {key: "ICH", forms: ["ích","ìch","ỉch","ĩch","ịch","ich","ích","ìch","ỉch","ĩch","ịch","ich","ích","ìch","ỉch","ĩch","ịch","ich"]},
  // Add more entries from your ESP32 code...
];

// MPU state variables
let currentMPUState = -1;
let currentOrientation = "Unknown";
let currentShakeState = "None";
let isShaking = false;
let lastMPUUpdate = 0;

// Word construction state (matching ESP32)
const DEBOUNCE_COUNT = 3;
let stableCount = 0;
let lastDetectedIndex = -1;
let lastF0 = -1, lastF1 = -1, lastF2 = -1, lastF3idx = -1;
let holdStartMs = 0;
let holdFired = false;
const HOLD_MS_DEFAULT = 800;
const POST_HOLD_COOLDOWN = 600;
let lastActionMs = 0;

let slot1 = "";
let slot2 = "";
let displayBuffer = "";

// Sentence building system
const MAX_WORDS = 10;
const MAX_WORD_LENGTH = 50;
let sentenceWords = [];
let sentenceWordCount = 0;
let fullSentence = "";
let sentenceComplete = false;
let lastSentenceUpdate = 0;

// Conversion system
let convertedCurrentWord = "";
let convertedFullSentence = "";

// Logging system
const MAX_LOG_ENTRIES = 20;
let logEntries = [];
let logEntryCount = 0;
let newLogAvailable = false;

// Firebase data
let lastFirebaseData = null;
let lastUpdateTime = 0;

// Initialize
document.addEventListener('DOMContentLoaded', function() {
    console.log("Vietnamese Processor Loaded");
    startFirebaseListener();
    startProcessingLoop();
});

// ===== FIREBASE LISTENER =====
function startFirebaseListener() {
    // Fetch data from Firebase every 100ms
    setInterval(fetchFirebaseData, 100);
}

function fetchFirebaseData() {
    fetch(`${FIREBASE_URL}/sensorData.json`)
        .then(response => response.json())
        .then(data => {
            lastFirebaseData = data;
            lastUpdateTime = Date.now();
            
            // Process the raw data exactly like ESP32 would
            processRawData(data);
            
            // Update UI
            updateSensorDisplay(data);
            updateConnectionStatus(true);
        })
        .catch(error => {
            console.error('Firebase error:', error);
            updateConnectionStatus(false);
        });
}

// ===== PROCESS RAW DATA (MATCHING ESP32 LOGIC) =====
function processRawData(data) {
    if (!data) return;
    
    // Extract raw flex values
    if (data.rawFlex && data.rawFlex.length === 4) {
        rawFlexValues = data.rawFlex;
        
        // Update calibration if active
        if (calibrating) {
            updateCalibration();
        }
        
        // Calculate flex states from raw values
        for (let i = 0; i < 4; i++) {
            const newState = calculateFlexState(rawFlexValues[i], i);
            if (newState !== flexStates[i]) {
                flexStates[i] = newState;
                lastFlexUpdate = Date.now();
            }
        }
    }
    
    // Extract MPU data
    if (data.mpuState !== undefined) {
        currentMPUState = data.mpuState;
    }
    
    if (data.mpuOrientation) {
        currentOrientation = data.mpuOrientation;
    }
    
    if (data.shakeState) {
        currentShakeState = data.shakeState;
    }
    
    if (data.isShaking !== undefined) {
        isShaking = data.isShaking;
    }
    
    // Debug output
    console.log(`Raw Flex: ${rawFlexValues[0]}->${flexStates[0]}, ${rawFlexValues[1]}->${flexStates[1]}, ${rawFlexValues[2]}->${flexStates[2]}, ${rawFlexValues[3]}->${flexStates[3]}`);
    console.log(`MPU: ${currentOrientation}, State: ${currentMPUState}, Shake: ${currentShakeState}`);
}

// ===== FLEX CALIBRATION FUNCTIONS =====
function startCalibration() {
    calibrating = true;
    calibrationComplete = false;
    calibrationStartTime = Date.now();
    
    // Reset bent thresholds to minimum
    for (let i = 0; i < 4; i++) {
        flexBentThresholds[i] = STRAIGHT_THRESHOLD + 1;
    }
    
    addLog("CALIB", "Calibration started - bend sensors for 10 seconds");
    
    // Start calibration timer
    const calibrationInterval = setInterval(() => {
        if (!calibrating) {
            clearInterval(calibrationInterval);
            return;
        }
        
        const elapsed = Date.now() - calibrationStartTime;
        
        // Update bent thresholds (find maximum values)
        for (let i = 0; i < 4; i++) {
            if (rawFlexValues[i] > flexBentThresholds[i]) {
                flexBentThresholds[i] = rawFlexValues[i];
            }
        }
        
        // Update UI
        updateCalibrationDisplay(elapsed);
        
        if (elapsed >= CALIBRATION_DURATION) {
            endCalibration();
            clearInterval(calibrationInterval);
        }
    }, 100);
}

function updateCalibration() {
    if (!calibrating) return;
    
    for (let i = 0; i < 4; i++) {
        if (rawFlexValues[i] > flexBentThresholds[i]) {
            flexBentThresholds[i] = rawFlexValues[i];
        }
    }
}

function endCalibration() {
    calibrating = false;
    calibrationComplete = true;
    
    // Validate bent thresholds
    for (let i = 0; i < 4; i++) {
        if (flexBentThresholds[i] <= STRAIGHT_THRESHOLD + 50) {
            console.warn(`Flex ${i} bent threshold too low (${flexBentThresholds[i]}), using default`);
            flexBentThresholds[i] = getDefaultBentThreshold(i);
        }
    }
    
    addLog("CALIB", "Calibration complete - bent thresholds set");
}

function getDefaultBentThreshold(sensorIndex) {
    switch(sensorIndex) {
        case 0: return 300; // A0
        case 1: return 450; // A1  
        case 2: return 350; // A2
        case 3: return 300; // A3
        default: return 350;
    }
}

function calculateFlexState(rawValue, sensorIndex) {
    if (!calibrationComplete) {
        // Use default bent thresholds if not calibrated
        const defaultBent = getDefaultBentThreshold(sensorIndex);
        return mapFlexStateSimple(rawValue, defaultBent);
    }
    
    return mapFlexStateSimple(rawValue, flexBentThresholds[sensorIndex]);
}

function mapFlexStateSimple(rawValue, bentThreshold) {
    if (rawValue <= STRAIGHT_THRESHOLD) {
        return 0; // Straight/not bent
    } else if (rawValue <= bentThreshold) {
        return 1; // Partially bent
    } else {
        return 2; // Fully bent
    }
}

// ===== WORD CONSTRUCTION FUNCTIONS (MATCHING ESP32) =====
function getMappingForIndices(mpuState, a0, a1, a2, a3) {
    console.log(`getMapping: MPU=${mpuState}, a0=${a0}, a1=${a1}, a2=${a2}, a3=${a3}`);
    
    if (mpuState < 0 || mpuState > 7) {
        console.log("  -> Invalid MPU state");
        return null;
    }
    
    if (a3 === 2) {  // Use tableC (3x3x3)
        if (a0 < 3 && a1 < 3 && a2 < 3) {
            const result = tableC[a0][a1][a2];
            console.log(`  -> TableC[${a0}][${a1}][${a2}] = ${result}`);
            return result;
        }
        console.log("  -> Invalid indices for TableC");
        return null;
    }
    
    // For tableA (a3=0) and tableB (a3=1)
    const a3bin = (a3 === 1) ? 1 : 0;
    if (a1 < 0 || a1 >= 3 || a2 < 0 || a2 >= 3) {
        console.log("  -> Invalid a1 or a2 for tableA/B");
        return null;
    }
    
    const flatIndex = a1 * 3 + a2;
    
    if (flatIndex >= 0 && flatIndex < 9) {
        let result;
        if (a3bin === 0) {
            result = tableA[mpuState][flatIndex];
            console.log(`  -> TableA[${mpuState}][${flatIndex}] = ${result}`);
        } else {
            result = tableB[mpuState][flatIndex];
            console.log(`  -> TableB[${mpuState}][${flatIndex}] = ${result}`);
        }
        return result;
    }
    
    console.log("  -> Flat index out of range");
    return null;
}

function flexModeCharFromA0(a0) {
    switch(a0) {
        case 0: return 's';
        case 1: return 'b';
        case 2: return 'p';
        default: return 'x';
    }
}

function backspaceBuffer() {
    if (displayBuffer.length > 0) {
        displayBuffer = displayBuffer.slice(0, -1);
        // Update conversion
        updateConversions();
        addLog("WORD", `Backspace - Buffer: ${displayBuffer}`);
    }
}

function updateDisplayBufferFromSlots() {
    const oldBuffer = displayBuffer;
    
    displayBuffer = (slot1 + slot2).toLowerCase();
    
    if (oldBuffer !== displayBuffer) {
        // Update conversion when display buffer changes
        updateConversions();
        addLog("WORD", `Word updated: ${displayBuffer}`);
    }
}

function performActionSlotLogic(mpu, a0, a1, a2, a3) {
    const mapping = getMappingForIndices(mpu, a0, a1, a2, a3);
    if (!mapping || mapping === "nullptr") {
        return false;
    }
    
    // Handle underscore (word separator)
    if (mapping === "_") {
        addWordToSentence();
        return true;
    }
    
    // Handle COMMIT (sentence finalizer)
    if (mapping === "COMMIT") {
        commitSentence();
        return true;
    }
    
    // Handle backspace
    if (mapping === "<") {
        backspaceBuffer();
        updateDisplayBufferFromSlots();
        return true;
    }
    
    const isSlot1 = (a3 === 2);
    const held = Date.now() - holdStartMs;
    
    if (isSlot1 && stableCount >= DEBOUNCE_COUNT && held < HOLD_MS_DEFAULT) {
        const mode = flexModeCharFromA0(a0);
        slot2 = `${mapping}_${mode}`;
    } else if (isSlot1) {
        slot1 = `${mapping}_${mpu}`;
    } else {
        const mode = flexModeCharFromA0(a0);
        slot2 = `${mapping}_${mode}`;
    }
    
    updateDisplayBufferFromSlots();
    return true;
}

function updateWordConstruction() {
    if (currentMPUState < 0) return;
    
    if (currentMPUState === lastDetectedIndex && 
        flexStates[0] === lastF0 && 
        flexStates[1] === lastF1 && 
        flexStates[2] === lastF2 && 
        flexStates[3] === lastF3idx) {
        stableCount++;
    } else {
        stableCount = 1;
        lastDetectedIndex = currentMPUState;
        lastF0 = flexStates[0];
        lastF1 = flexStates[1];
        lastF2 = flexStates[2];
        lastF3idx = flexStates[3];
        holdStartMs = Date.now();
        holdFired = false;
    }
    
    if (stableCount >= DEBOUNCE_COUNT) {
        const held = Date.now() - holdStartMs;
        if (!holdFired && (Date.now() - lastActionMs) > POST_HOLD_COOLDOWN && held >= HOLD_MS_DEFAULT) {
            if (performActionSlotLogic(currentMPUState, flexStates[0], flexStates[1], flexStates[2], flexStates[3])) {
                holdFired = true;
                lastActionMs = Date.now();
                addLog("WORD", `Action performed: ${displayBuffer}`);
            }
        }
    }
}

// ===== SENTENCE FUNCTIONS =====
function addWordToSentence() {
    if (!displayBuffer || displayBuffer.length === 0) return;
    
    if (sentenceWordCount < MAX_WORDS) {
        // Copy the current word to sentence array
        sentenceWords[sentenceWordCount] = displayBuffer;
        sentenceWordCount++;
        
        // Update full sentence string
        fullSentence = sentenceWords.slice(0, sentenceWordCount).join(' ');
        
        // Update conversions
        updateConversions();
        
        addLog("SENTENCE", `Added word: '${displayBuffer}' | Sentence: ${fullSentence}`);
        
        // Clear current word buffers
        slot1 = "";
        slot2 = "";
        displayBuffer = "";
        convertedCurrentWord = "";
        
        lastSentenceUpdate = Date.now();
        
        // Update UI
        updateSentenceDisplay();
    } else {
        addLog("SENTENCE", `Sentence full! Max ${MAX_WORDS} words reached.`);
    }
}

function commitSentence() {
    if (sentenceWordCount === 0) {
        addLog("SENTENCE", "No words to commit!");
        return;
    }
    
    // First, add any current word if it exists
    if (displayBuffer && displayBuffer.length > 0) {
        addWordToSentence();
    }
    
    sentenceComplete = true;
    addLog("SENTENCE", "=== COMMIT SENTENCE ===");
    addLog("SENTENCE", `Full sentence: ${fullSentence}`);
    addLog("CONVERSION", `Converted sentence: ${convertedFullSentence}`);
    
    // Process each word in the sentence
    for (let i = 0; i < sentenceWordCount; i++) {
        addLog("SENTENCE", `Word ${i + 1}: ${sentenceWords[i]}`);
        
        // Convert and log each word
        const convertedWord = convertVietnameseWord(sentenceWords[i]);
        addLog("CONVERSION", `Word ${i + 1} converted: ${convertedWord}`);
    }
    
    // Reset sentence after commit
    resetSentence();
}

function resetSentence() {
    sentenceWords = [];
    sentenceWordCount = 0;
    fullSentence = "";
    convertedFullSentence = "";
    sentenceComplete = false;
    slot1 = "";
    slot2 = "";
    displayBuffer = "";
    convertedCurrentWord = "";
    addLog("SENTENCE", "Sentence reset - ready for new input");
    addLog("CONVERSION", "Conversion reset");
    
    // Update UI
    updateSentenceDisplay();
}

// ===== VIETNAMESE CONVERSION FUNCTIONS =====
function convertVietnameseWord(encodedWord) {
    if (!encodedWord || encodedWord.length === 0) return "";
    
    // Parse the encoded word format: "b_1ac_s"
    // Format: [consonant]_[tone][vowel]_[vowelType]
    
    const firstUnderscore = encodedWord.indexOf('_');
    if (firstUnderscore === -1) return encodedWord;
    
    const secondUnderscore = encodedWord.indexOf('_', firstUnderscore + 1);
    if (secondUnderscore === -1) return encodedWord;
    
    // Extract parts
    const consonant = encodedWord.substring(0, firstUnderscore);
    const middle = encodedWord.substring(firstUnderscore + 1, secondUnderscore);
    const vowelTypeStr = encodedWord.substring(secondUnderscore + 1);
    
    if (middle.length < 2) return encodedWord;
    
    const toneChar = middle[0];
    if (toneChar < '1' || toneChar > '6') return encodedWord;
    
    const tone = parseInt(toneChar); // Convert '1' to 1, etc.
    const vowelKey = middle.substring(1).toUpperCase();
    
    // Convert vowelType
    let vowelType = 0; // 's' -> 0
    if (vowelTypeStr === "b") {
        vowelType = 1; // 'b' -> 1
    } else if (vowelTypeStr === "p") {
        vowelType = 2; // 'p' -> 2
    } else if (vowelTypeStr !== "s") {
        return encodedWord; // Invalid vowel type
    }
    
    // Calculate index in the table
    // 6 tones × 3 vowel types = 18 entries per vowel
    // Index formula: (tone - 1) + (vowelType * 6)
    const tableIndex = (tone - 1) + (vowelType * 6);
    
    if (tableIndex < 0 || tableIndex >= 18) {
        return encodedWord;
    }
    
    // Search for the vowel key in the table
    for (const entry of vietnameseTable) {
        if (vowelKey === entry.key) {
            // Found the vowel, get the converted form
            const convertedVowel = entry.forms[tableIndex];
            return consonant + convertedVowel;
        }
    }
    
    // If not found in table, return original
    return encodedWord;
}

function convertVietnameseText(encodedText) {
    if (!encodedText || encodedText.length === 0) return "";
    
    const words = encodedText.split(' ');
    const convertedWords = words.map(word => convertVietnameseWord(word));
    return convertedWords.join(' ');
}

function updateConversions() {
    // Update current word conversion
    if (displayBuffer && displayBuffer.length > 0) {
        convertedCurrentWord = convertVietnameseWord(displayBuffer);
    } else {
        convertedCurrentWord = "";
    }
    
    // Update full sentence conversion
    if (fullSentence && fullSentence.length > 0) {
        convertedFullSentence = convertVietnameseText(fullSentence);
    } else {
        convertedFullSentence = "";
    }
}

// ===== PROCESSING LOOP =====
function startProcessingLoop() {
    // Process word construction every 10ms (matching ESP32)
    setInterval(() => {
        updateWordConstruction();
        updateUI();
    }, 10);
}

// ===== UI UPDATE FUNCTIONS =====
function updateSensorDisplay(data) {
    // Update raw values
    document.getElementById('rawFlex0').textContent = rawFlexValues[0];
    document.getElementById('rawFlex1').textContent = rawFlexValues[1];
    document.getElementById('rawFlex2').textContent = rawFlexValues[2];
    document.getElementById('rawFlex3').textContent = rawFlexValues[3];
    
    // Update calculated states
    document.getElementById('flexState0').textContent = flexStates[0];
    document.getElementById('flexState1').textContent = flexStates[1];
    document.getElementById('flexState2').textContent = flexStates[2];
    document.getElementById('flexState3').textContent = flexStates[3];
    
    // Update MPU
    document.getElementById('mpuState').textContent = currentMPUState;
    document.getElementById('mpuOrientation').textContent = currentOrientation;
    document.getElementById('shakeState').textContent = currentShakeState;
    
    // Update flex boxes with colors
    updateFlexBoxes();
}

function updateFlexBoxes() {
    for (let i = 0; i < 4; i++) {
        const box = document.getElementById(`flex${i}-box`);
        if (box) {
            box.textContent = flexStates[i];
            box.className = `flex-box state-${flexStates[i]}`;
        }
    }
}

function updateCalibrationDisplay(elapsed) {
    const timeLeft = Math.max(0, (CALIBRATION_DURATION - elapsed) / 1000);
    document.getElementById('calibrationStatus').innerHTML = 
        `<span class="calibrating">CALIBRATING... ${timeLeft.toFixed(1)}s left</span>`;
}

function updateSentenceDisplay() {
    document.getElementById('displayBuffer').textContent = displayBuffer || '---';
    document.getElementById('convertedCurrentWord').textContent = convertedCurrentWord || '---';
    document.getElementById('sentenceDisplay').textContent = fullSentence || '---';
    document.getElementById('convertedSentenceDisplay').textContent = convertedFullSentence || '---';
    document.getElementById('wordCount').textContent = sentenceWordCount;
    document.getElementById('slot1').textContent = slot1 || '---';
    document.getElementById('slot2').textContent = slot2 || '---';
    
    // Update word list
    updateWordList();
}

function updateWordList() {
    const wordListDiv = document.getElementById('wordList');
    if (sentenceWordCount > 0) {
        wordListDiv.innerHTML = '';
        for (let i = 0; i < sentenceWordCount; i++) {
            const wordDiv = document.createElement('div');
            wordDiv.className = 'word-item';
            wordDiv.textContent = sentenceWords[i];
            wordListDiv.appendChild(wordDiv);
        }
    } else {
        wordListDiv.textContent = 'No words yet';
    }
}

function updateUI() {
    // Update stable count and hold time
    document.getElementById('stableCount').textContent = stableCount;
    document.getElementById('holdTime').textContent = ((Date.now() - holdStartMs) / 1000).toFixed(1);
    
    // Update calibration status
    if (calibrating) {
        const timeLeft = Math.max(0, (CALIBRATION_DURATION - (Date.now() - calibrationStartTime)) / 1000);
        document.getElementById('calibrationStatus').innerHTML = 
            `<span class="calibrating">CALIBRATING... ${timeLeft.toFixed(1)}s left</span>`;
    } else if (calibrationComplete) {
        document.getElementById('calibrationStatus').innerHTML = 
            '<span class="calibrated">CALIBRATION COMPLETE ✓</span>';
    } else {
        document.getElementById('calibrationStatus').textContent = 'Not calibrated (using defaults)';
    }
}

function updateConnectionStatus(connected) {
    const indicator = document.getElementById('connectionStatus');
    const statusText = document.getElementById('statusText');
    
    if (connected) {
        indicator.className = 'indicator online';
        statusText.textContent = 'Connected to Firebase';
        
        const now = new Date();
        document.getElementById('lastUpdate').textContent = 
            `Last update: ${now.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit', second:'2-digit'})}`;
    } else {
        indicator.className = 'indicator offline';
        statusText.textContent = 'Disconnected from Firebase';
    }
}

// ===== LOGGING FUNCTIONS =====
function addLog(source, message) {
    const logEntry = {
        timestamp: Date.now(),
        source: source,
        message: message
    };
    
    if (logEntryCount < MAX_LOG_ENTRIES) {
        logEntries[logEntryCount] = logEntry;
        logEntryCount++;
    } else {
        // Shift logs
        logEntries.shift();
        logEntries.push(logEntry);
    }
    newLogAvailable = true;
    
    // Also log to console
    console.log(`[${source}] ${message}`);
}

// ===== EXPORT FUNCTIONS FOR HTML =====
window.processor = {
    startCalibration: startCalibration,
    endCalibration: endCalibration,
    addWordToSentence: addWordToSentence,
    commitSentence: commitSentence,
    resetSentence: resetSentence,
    clearWord: function() {
        slot1 = "";
        slot2 = "";
        displayBuffer = "";
        convertedCurrentWord = "";
        updateDisplayBufferFromSlots();
    },
    backspace: backspaceBuffer,
    setThresholds: function(thresholds) {
        if (thresholds && thresholds.length === 4) {
            flexBentThresholds = thresholds;
            calibrationComplete = true;
            calibrating = false;
        }
    },
    getFlexStates: function() {
        return flexStates;
    },
    getCurrentWord: function() {
        return displayBuffer;
    },
    getConvertedWord: function() {
        return convertedCurrentWord;
    },
    getSentence: function() {
        return fullSentence;
    },
    getConvertedSentence: function() {
        return convertedFullSentence;
    }
};
