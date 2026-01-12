// js/firebase.js - REPLACE THE ENTIRE FILE WITH THIS:

const FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/sensorData.json";

// Persistent connection with keep-alive
let firebaseConnection = null;
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 5;

async function fetchFirebaseDataOptimized() {
    const startTime = performance.now();
    
    // Use persistent connection if available
    if (currentFetchController) {
        currentFetchController.abort();
    }
    
    try {
        // Use HTTP/2 multiplexing - keep connection alive
        const headers = {
            'Accept': 'application/json',
            'Cache-Control': 'no-cache, max-age=0',
            'Connection': 'keep-alive',
            'Keep-Alive': 'timeout=5, max=1000'
        };
        
        // Use a faster approach with native fetch options
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 2000);
        
        currentFetchController = controller;
        
        const response = await fetch(FIREBASE_URL, {
            signal: controller.signal,
            method: 'GET',
            headers: headers,
            // Critical: These options improve speed
            mode: 'cors',
            cache: 'no-store',
            referrerPolicy: 'no-referrer',
            priority: 'high' // Chrome only
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const fetchTime = performance.now() - startTime;
        
        // Update latency display
        document.getElementById('latency').textContent = Math.round(fetchTime);
        
        // Process only if data changed
        if (JSON.stringify(data) !== JSON.stringify(lastFirebaseData)) {
            firebaseData = data;
            lastFirebaseData = data;
            lastUpdateTime = Date.now();
            
            updateConnectionStatus(true);
            
            // FAST processing - no setTimeout
            processFirebaseDataImmediately(data);
            scheduleUIUpdate();
            
            // Adaptive polling based on latency
            adjustPollingInterval(fetchTime);
            
            log('Firebase', `Data updated (${Math.round(fetchTime)}ms)`);
            
            // Reset reconnect attempts on success
            reconnectAttempts = 0;
        }
        
        return data;
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.warn('Fetch error:', error);
            updateConnectionStatus(false);
            
            reconnectAttempts++;
            if (reconnectAttempts > MAX_RECONNECT_ATTEMPTS) {
                // Switch to exponential backoff
                pollingInterval = Math.min(pollingInterval * 1.5, 5000);
                log('Firebase', `High error rate, slowing to ${pollingInterval}ms`);
                reconnectAttempts = 0;
            }
        }
        return null;
    } finally {
        currentFetchController = null;
    }
}

function processFirebaseDataImmediately(data) {
    // ULTRA-FAST processing - minimize work
    
    // 1. Update MPU orientation (fastest first)
    if (data.o !== undefined) {
        const el = document.getElementById('mpuOrientation');
        el.textContent = data.o || 'N/A';
    }
    
    // 2. Update flex sensors (batch update)
    if (data.f0 !== undefined) {
        updateFlexSensors(data);
    }
    
    // 3. Process word construction in microtask
    queueMicrotask(() => {
        const mpuState = getMPUState(data.o || "", data.d || "");
        processWordConstructionFast(mpuState, flexStates[0], flexStates[1], flexStates[2], flexStates[3]);
    });
}

function updateFlexSensors(data) {
    // Batch update all flex sensors at once
    const flexValues = [
        data.f0 || 0,
        data.f1 || 0, 
        data.f2 || 0,
        data.f3 || 0
    ];
    
    // Update raw values display
    const rawEl = document.getElementById('rawValues');
    if (rawEl) {
        rawEl.textContent = flexValues.join(', ');
    }
    
    // Update flex boxes
    for (let i = 0; i < 4; i++) {
        const newState = calculateFlexState(flexValues[i], i);
        if (flexStates[i] !== newState) {
            flexStates[i] = newState;
            
            const box = document.getElementById(`flex${i}-box`);
            if (box) {
                box.textContent = newState;
                box.className = `flex-box active-${newState}`;
            }
        }
    }
    
    // Update flex format
    const formatEl = document.getElementById('flexFormat');
    if (formatEl) {
        formatEl.textContent = flexStates.join('');
    }
}

function adjustPollingInterval(fetchTime) {
    // Dynamic adjustment based on network conditions
    if (fetchTime < 50) {
        // Excellent connection - go faster
        pollingInterval = turboMode ? 100 : 200;
    } else if (fetchTime < 100) {
        // Good connection
        pollingInterval = turboMode ? 150 : 250;
    } else if (fetchTime < 200) {
        // Moderate connection
        pollingInterval = 350;
    } else {
        // Slow connection - back off
        pollingInterval = 500;
    }
    
    // Cap at reasonable limits
    pollingInterval = Math.max(100, Math.min(pollingInterval, 1000));
    
    updatePollingDisplay();
}
