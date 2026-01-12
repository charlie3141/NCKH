// === BIẾN TỐI ƯU HÓA ===
let firebaseData = null;
let lastUpdateTime = 0;
let autoRefresh = true;
let autoRefreshInterval;
let isFetching = false;
let lastFirebaseData = null;
let uiUpdateScheduled = false;
let lastFrameTime = performance.now();
let frameCount = 0;
let currentFPS = 60;
let pollingInterval = 300;
let turboMode = false;
let currentFetchController = null;

// === HÀM TỐI ƯU HÓA FIREBASE ===
async function fetchFirebaseDataOptimized() {
    if (isFetching) return null;
    
    // Hủy request trước nếu đang chạy
    if (currentFetchController) {
        currentFetchController.abort();
    }
    
    isFetching = true;
    const startTime = performance.now();
    currentFetchController = new AbortController();
    const signal = currentFetchController.signal;
    
    try {
        // Thêm timestamp để tránh cache
        const timestamp = Date.now();
        const url = `${FIREBASE_URL}?t=${timestamp}`;
        
        const response = await fetch(url, {
            signal,
            method: 'GET',
            headers: {
                'Cache-Control': 'no-cache, no-store, must-revalidate',
                'Pragma': 'no-cache',
                'Expires': '0'
            },
            priority: 'high'
        });
        
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        
        const data = await response.json();
        const fetchTime = performance.now() - startTime;
        
        // Cập nhật thông tin độ trễ
        document.getElementById('latency').textContent = Math.round(fetchTime);
        
        // Chỉ xử lý nếu dữ liệu thay đổi
        if (JSON.stringify(data) !== JSON.stringify(lastFirebaseData)) {
            lastFirebaseData = data;
            firebaseData = data;
            lastUpdateTime = Date.now();
            
            updateConnectionStatus(true);
            
            // Xử lý nhanh, không chờ UI update
            processDataImmediately(data);
            
            // Lên lịch update UI cho frame tiếp theo
            scheduleUIUpdate();
            
            log('Firebase', `Data updated (${Math.round(fetchTime)}ms)`);
            
            // Điều chỉnh polling interval dựa trên tốc độ
            if (fetchTime < 100) {
                pollingInterval = turboMode ? 150 : 250;
            } else if (fetchTime > 500) {
                pollingInterval = 1000;
            }
            
            updatePollingDisplay();
        } else {
            // Chỉ cập nhật thời gian
            lastUpdateTime = Date.now();
            document.getElementById('lastUpdate').textContent = 
                `Cập nhật: ${formatTime(Date.now())}`;
        }
        
        return data;
        
    } catch (error) {
        if (error.name !== 'AbortError') {
            console.warn('Fetch error:', error);
            updateConnectionStatus(false);
            log('Firebase', `Error: ${error.message}`);
            
            // Tăng interval khi có lỗi
            pollingInterval = Math.min(pollingInterval * 2, 5000);
            updatePollingDisplay();
        }
        return null;
    } finally {
        isFetching = false;
        const totalTime = performance.now() - startTime;
        document.getElementById('processingTime').textContent = `${Math.round(totalTime)}ms`;
    }
}

function processDataImmediately(data) {
    const startTime = performance.now();
    
    // 1. Cập nhật sensor data nhanh
    if (data.o !== undefined) {
        const mpuElement = document.getElementById('mpuOrientation');
        if (mpuElement.textContent !== data.o) {
            mpuElement.textContent = data.o || 'N/A';
        }
    }
    
    if (data.d !== undefined) {
        const shakeElement = document.getElementById('mpuShakeState');
        if (shakeElement.textContent !== data.d) {
            shakeElement.textContent = data.d || 'No';
        }
    }
    
    if (data.sf !== undefined) {
        const isShakingElement = document.getElementById('isShaking');
        if (isShakingElement.textContent !== data.sf) {
            isShakingElement.textContent = data.sf || 'NO';
        }
    }
    
    // 2. Cập nhật flex sensors nhanh
    if (data.f0 !== undefined) {
        const flexValues = [data.f0, data.f1 || 0, data.f2 || 0, data.f3 || 0];
        for (let i = 0; i < 4; i++) {
            const newState = calculateFlexState(flexValues[i], i);
            if (flexStates[i] !== newState) {
                flexStates[i] = newState;
            }
        }
    }
    
    // 3. Xử lý word construction (bất đồng bộ)
    setTimeout(() => {
        const mpuState = getMPUState(data.o || "", data.d || "");
        const a0 = flexStates[0];
        const a1 = flexStates[1];
        const a2 = flexStates[2];
        const a3 = flexStates[3];
        
        processWordConstructionFast(mpuState, a0, a1, a2, a3);
    }, 0);
}

function updatePollingDisplay() {
    document.getElementById('pollingRate').textContent = pollingInterval;
    const btn = document.getElementById('autoRefreshBtn');
    if (autoRefresh) {
        btn.textContent = `Tự động: BẬT (${pollingInterval}ms)`;
    }
}

function updateConnectionStatus(connected) {
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

function formatTime(timestamp) {
    const date = new Date(timestamp);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getMPUState(orientation, shakeState) {
    if (shakeState === "Shake Left") return 6;
    if (shakeState === "Shake Right") return 7;
    
    switch(orientation) {
        case "Up": return 0;
        case "Down": return 1;
        case "Left": return 2;
        case "Right": return 3;
        case "Forward": return 4;
        case "Backward": return 5;
        default: return -1;
    }
}

// === HÀM ĐIỀU KHIỂN ===
function refreshData() {
    fetchFirebaseDataOptimized();
}

function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefresh) {
        btn.textContent = `Tự động: BẬT (${pollingInterval}ms)`;
        btn.className = 'green';
        
        // Dùng recursive setTimeout thay vì setInterval
        function scheduleNextRefresh() {
            if (!autoRefresh) return;
            
            setTimeout(() => {
                if (autoRefresh) {
                    fetchFirebaseDataOptimized().then(() => {
                        if (autoRefresh) {
                            scheduleNextRefresh();
                        }
                    });
                }
            }, pollingInterval);
        }
        
        scheduleNextRefresh();
        log('SYSTEM', `Bật tự động làm mới ${pollingInterval}ms`);
    } else {
        btn.textContent = 'Tự động: TẮT';
        btn.className = 'red';
        log('SYSTEM', 'Tắt tự động làm mới');
    }
}

function toggleTurboMode() {
    turboMode = !turboMode;
    const btn = document.getElementById('turboBtn');
    
    if (turboMode) {
        pollingInterval = 150;
        btn.textContent = '🚀 Turbo: BẬT';
        btn.className = 'red';
        document.getElementById('fastModeIndicator').style.display = 'block';
        log('SYSTEM', 'Bật chế độ Turbo (150ms polling)');
    } else {
        pollingInterval = 300;
        btn.textContent = '🚀 Chế độ Turbo';
        btn.className = 'green';
        document.getElementById('fastModeIndicator').style.display = 'none';
        log('SYSTEM', 'Tắt chế độ Turbo');
    }
    
    updatePollingDisplay();
    
    // Nếu auto refresh đang bật, cập nhật lại
    if (autoRefresh) {
        toggleAutoRefresh();
        toggleAutoRefresh(); // Bật lại với interval mới
    }
}
