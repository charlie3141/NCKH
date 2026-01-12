// Biến xây dựng câu
let slot1 = "";
let slot2 = "";
let displayBuffer = "";
let convertedCurrentWord = "";
let sentenceWords = [];
let fullSentence = "";
let convertedFullSentence = "";

// Trạng thái cảm biến uốn
let flexStates = [0, 0, 0, 0];
let lastFlexStates = [-1, -1, -1, -1];
let stableCount = 0;
let lastDetectedIndex = -1;
let holdStartMs = 0;
let holdFired = false;
let lastActionMs = 0;
let lastStateString = '';

// Bảng dữ liệu (tách riêng)
const tableA = [
    ["IAY","IC","ICH","IE","IEC","IEM","IEN","IENG","IEO"],
    ["IEP","IET","IEU","IM","IN","ING","INH","IO","IOI"],
    ["ENG","ENH","EO","EP","ET","EU","I","IA","IAC"],
    ["IAI","IAM","IAN","IANG","IANH","IAO","IAP","IAT","IAU"],
    ["AP","AT","AU","AY","E","EC","ECH","EM","EN"],
    ["A","AC","ACH","AI","AM","AN","ANG","ANH","AO"],
    ["IUN","IUONG","IUP","O","OA","OAC","OACH","OAI","OAM"],
    ["ION","IONG","IOT","IP","IT","IU","IUA","IUC","IUI"]
];

const tableB = [
    ["UE","UECH","UEN","UENH","UEO","UET","UI","UM","UN"],
    ["UNG","UO","UOC","UOI","UOM","UON","UONG","UOP","OUT"],
    ["ONG","OOC","OONG","OP","OT","U","UA","UAC","UACH"],
    ["UAI","UAM","UAN","UANG","UANH","UAO","UAT","UAY","UC"],
    ["OAY","OC","OE","OEN","OEO","OET","OI","OM","ON"],
    ["COMMIT","_","nullptr","nullptr","OAN","OANG","OANH","OAP","OAT"],
    ["UYNH","UYP","UYT","UYU","Y","YEM","YEN","YET","YEU"],
    ["UOU","UP","UT","UU","UY","UYA","UYCH","UYEN","UYET"]
];

const tableC = [
    [ ["B","C","D"],["Đ","G","H"],["K","L","M"] ],
    [ ["N","P","Q"],["R","S","T"],["V","X","CH"] ],
    [ ["GH","KH","NG"],["NGH","NH","PH"],["TH","TR","_"] ]
];

// CACHE cho tối ưu hóa
const mappingCache = new Map();
const vietnameseCache = new Map();
let translationCache = {};
let audioCache = {};

function processWordConstructionFast(mpu, a0, a1, a2, a3) {
    const currentState = `${mpu}_${a0}_${a1}_${a2}_${a3}`;
    
    if (currentState !== lastStateString) {
        lastStateString = currentState;
        stableCount = 0;
        holdStartMs = Date.now();
        holdFired = false;
    } else {
        stableCount++;
    }
    
    lastFlexStates = [a0, a1, a2, a3];
    
    if (stableCount >= DEBOUNCE_COUNT) {
        const held = Date.now() - holdStartMs;
        if (!holdFired && held >= HOLD_MS_DEFAULT) {
            if (Date.now() - lastActionMs > POST_HOLD_COOLDOWN) {
                performActionSlotLogic(mpu, a0, a1, a2, a3);
                holdFired = true;
                lastActionMs = Date.now();
            }
        }
    }
}

function performActionSlotLogic(mpu, a0, a1, a2, a3) {
    const mapping = getMappingForIndicesCached(mpu, a0, a1, a2, a3);
    if (!mapping || mapping === "nullptr") return false;
    
    // FIX: When mapping is "_" (word separator), automatically add word to sentence
    if (mapping === "_") {
        // If there's a current word in the buffer, add it to the sentence
        if (displayBuffer && displayBuffer.length > 0 && displayBuffer !== "---") {
            addWordToSentence();
        } else {
            log('WORD', 'Word separator detected, but no word in buffer');
        }
        return true;
    }
    
    if (mapping === "COMMIT") {
        commitSentence();
        return true;
    }
    
    if (mapping === "<") {
        backspaceBuffer();
        scheduleUIUpdate();
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
    log('WORD', `Action: ${displayBuffer}`);
    return true;
}

function flexModeCharFromA0(a0) {
    switch(a0) {
        case 0: return 's';
        case 1: return 'b';
        case 2: return 'p';
        default: return 'x';
    }
}

function updateDisplayBufferFromSlots() {
    const oldBuffer = displayBuffer;
    displayBuffer = '';
    
    if (slot1) displayBuffer += slot1.toLowerCase();
    if (slot2) displayBuffer += slot2.toLowerCase();
    
    if (oldBuffer !== displayBuffer) {
        scheduleUIUpdate();
        log('WORD', `Updated: ${displayBuffer}`);
    }
}

function getMappingForIndicesCached(mpuState, a0, a1, a2, a3) {
    const cacheKey = `${mpuState}_${a0}_${a1}_${a2}_${a3}`;
    
    if (mappingCache.has(cacheKey)) {
        return mappingCache.get(cacheKey);
    }
    
    const result = getMappingForIndicesOriginal(mpuState, a0, a1, a2, a3);
    mappingCache.set(cacheKey, result);
    return result;
}

function getMappingForIndicesOriginal(mpuState, a0, a1, a2, a3) {
    if (mpuState < 0 || mpuState > 7) return null;
    
    if (a3 === 2) {
        if (a0 < 3 && a1 < 3 && a2 < 3) {
            return tableC[a0][a1][a2];
        }
        return null;
    }
    
    const a3bin = a3 === 1 ? 1 : 0;
    if (a1 < 0 || a1 >= 3 || a2 < 0 || a2 >= 3) return null;
    
    const flatIndex = a1 * 3 + a2;
    
    if (flatIndex >= 0 && flatIndex < 9) {
        return a3bin === 0 ? tableA[mpuState][flatIndex] : tableB[mpuState][flatIndex];
    }
    
    return null;
}

function convertVietnameseWordCached(encodedWord) {
    if (!encodedWord || encodedWord.length === 0) return "";
    
    if (vietnameseCache.has(encodedWord)) {
        return vietnameseCache.get(encodedWord);
    }
    
    const result = convertVietnameseWordOriginal(encodedWord);
    vietnameseCache.set(encodedWord, result);
    return result;
}

function convertVietnameseWordOriginal(encodedWord) {
    if (!encodedWord || encodedWord.length === 0) return "";
    
    const firstUnderscore = encodedWord.indexOf('_');
    if (firstUnderscore === -1) return encodedWord;
    
    const secondUnderscore = encodedWord.indexOf('_', firstUnderscore + 1);
    if (secondUnderscore === -1) return encodedWord;
    
    const consonant = encodedWord.substring(0, firstUnderscore);
    const middle = encodedWord.substring(firstUnderscore + 1, secondUnderscore);
    const vowelTypeStr = encodedWord.substring(secondUnderscore + 1);
    
    if (middle.length < 2) return encodedWord;
    
    const toneChar = middle[0];
    if (toneChar < '1' || toneChar > '6') return encodedWord;
    
    const tone = parseInt(toneChar);
    const vowelKey = middle.substring(1);
    
    let vowelType = 0;
    if (vowelTypeStr === "b") {
        vowelType = 1;
    } else if (vowelTypeStr === "p") {
        vowelType = 2;
    } else if (vowelTypeStr !== "s") {
        return encodedWord;
    }
    
    const tableIndex = (tone - 1) + (vowelType * 6);
    
    if (tableIndex < 0 || tableIndex >= 18) {
        return encodedWord;
    }
    
    const vowelKeyUpper = vowelKey.toUpperCase();
    
    for (let i = 0; i < vietnameseTable.length; i++) {
        if (vowelKeyUpper === vietnameseTable[i].key) {
            const convertedVowel = vietnameseTable[i].forms[tableIndex];
            return consonant + convertedVowel;
        }
    }
    
    return encodedWord;
}

function convertVietnameseTextFast(encodedText) {
    if (!encodedText || encodedText.length === 0) return "";
    
    const words = encodedText.split(' ');
    const convertedWords = words.map(word => convertVietnameseWordCached(word));
    return convertedWords.join(' ');
}

// === HÀM XÂY DỰNG CÂU ===
function addWordToSentence() {
    if (!displayBuffer || displayBuffer === "---" || displayBuffer.length === 0) {
        log('SENTENCE', 'Cannot add empty word to sentence');
        return;
    }
    
    if (sentenceWords.length < 10) {
        sentenceWords.push(displayBuffer);
        scheduleUIUpdate();
        log('SENTENCE', `Added: '${displayBuffer}'`);
        
        // Clear for next word
        slot1 = '';
        slot2 = '';
        displayBuffer = '';
        convertedCurrentWord = '';
        
        // Auto-show suggestions after adding a word
        showAutoSuggestions();
        
        scheduleUIUpdate();
    } else {
        log('SENTENCE', 'Sentence full! Max 10 words.');
    }
}

function commitSentence() {
    if (sentenceWords.length === 0) {
        log('SENTENCE', 'No words to commit!');
        return;
    }
    
    // If there's a word in the buffer, add it first
    if (displayBuffer && displayBuffer.length > 0 && displayBuffer !== "---") {
        addWordToSentence();
    }
    
    log('SENTENCE', '=== SENTENCE COMMITTED ===');
    log('SENTENCE', `Full: ${fullSentence}`);
    log('CONVERSION', `Converted: ${convertedFullSentence}`);
    
    // Auto-translate the sentence
    if (convertedFullSentence && convertedFullSentence !== "---") {
        document.getElementById('translationInput').value = convertedFullSentence;
        setTimeout(() => {
            translateSentence();
        }, 500);
    }
    
    resetSentence();
}

function resetSentence() {
    sentenceWords = [];
    fullSentence = '';
    convertedFullSentence = '';
    slot1 = '';
    slot2 = '';
    displayBuffer = '';
    convertedCurrentWord = '';
    
    document.getElementById('autoSuggestionsPanel').style.display = 'none';
    document.getElementById('dynamicSuggestions').innerHTML = '';
    document.getElementById('dynamicSuggestions').classList.remove('show');
    
    log('SENTENCE', 'Sentence reset');
    scheduleUIUpdate();
}

function clearCurrentWord() {
    slot1 = '';
    slot2 = '';
    displayBuffer = '';
    convertedCurrentWord = '';
    
    document.getElementById('dynamicSuggestions').innerHTML = '';
    document.getElementById('dynamicSuggestions').classList.remove('show');
    
    scheduleUIUpdate();
    log('WORD', 'Current word cleared');
}

function backspaceBuffer() {
    if (displayBuffer.length > 0) {
        displayBuffer = displayBuffer.slice(0, -1);
        log('WORD', `Backspace - Buffer: ${displayBuffer}`);
    }
}

function backspace() {
    backspaceBuffer();
    scheduleUIUpdate();
}
