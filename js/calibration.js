// === BIẾN CALIBRATION ===
let bentThresholds = [300, 450, 350, 300]; // Giá trị mặc định cho bent threshold

let isCalibrating = false;
let calibrationTimeout = null;
let calibrationInterval = null;
let calibrationCountdown = 10;
let calibrationStartTime = 0;
let calibrationMaxValues = [0, 0, 0, 0];
let calibrationCurrentSensor = 0;
let calibrationStep = "waiting"; // waiting, calibrating, done

// === HÀM CALIBRATION ===
function startCalibration() {
    if (isCalibrating) return;
    
    isCalibrating = true;
    calibrationCountdown = 10;
    calibrationStartTime = Date.now();
    calibrationMaxValues = [0, 0, 0, 0];
    calibrationCurrentSensor = 0;
    calibrationStep = "calibrating";
    
    // Hiển thị giao diện calibration
    document.getElementById('calibrationProgress').style.display = 'block';
    document.getElementById('calibrateBtn').style.display = 'none';
    document.getElementById('stopCalibrateBtn').style.display = 'inline-block';
    
    // Cập nhật trạng thái
    updateCalibrationStatus("calibrating", "Đang calibration... Vui lòng uốn tất cả ngón tay hết mức có thể!");
    
    // Tạo display cho các sensor
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
    
    // Bắt đầu đếm ngược
    calibrationInterval = setInterval(updateCalibration, 1000);
    
    // Cập nhật thông báo
    document.getElementById('calibrationMessage').textContent = `Đang calibration... Vui lòng uốn TẤT CẢ ngón tay hết mức!`;
    
    log('CALIBRATION', 'Bắt đầu calibration cảm biến uốn');
}

function updateCalibration() {
    if (!isCalibrating) return;
    
    calibrationCountdown--;
    document.getElementById('calibrationCountdown').textContent = calibrationCountdown;
    
    // Cập nhật thanh tiến trình
    const progress = ((10 - calibrationCountdown) / 10) * 100;
    document.getElementById('calibrationProgressBar').style.width = `${progress}%`;
    
    // Cập nhật giá trị cảm biến nếu có dữ liệu
    if (firebaseData) {
        const flexValues = [firebaseData.f0 || 0, firebaseData.f1 || 0, firebaseData.f2 || 0, firebaseData.f3 || 0];
        
        for (let i = 0; i < 4; i++) {
            // Cập nhật giá trị hiện tại
            const valueElement = document.querySelector(`#calibrationSensor${i} .sensor-value`);
            if (valueElement) {
                valueElement.textContent = flexValues[i];
            }
            
            // Cập nhật giá trị lớn nhất
            if (flexValues[i] > calibrationMaxValues[i]) {
                calibrationMaxValues[i] = flexValues[i];
                const maxElement = document.querySelector(`#calibrationSensor${i} .sensor-max`);
                if (maxElement) {
                    maxElement.textContent = `Max: ${flexValues[i]}`;
                    maxElement.style.color = '#F44336';
                }
            }
            
            // Cập nhật thanh tiến trình cho từng sensor
            const progressValue = Math.min((flexValues[i] / 1024) * 100, 100);
            const progressBar = document.getElementById(`progressBar${i}`);
            if (progressBar) {
                progressBar.style.width = `${progressValue}%`;
                
                // Thay đổi màu dựa trên mức độ uốn
                if (progressValue < 30) {
                    progressBar.style.background = '#4CAF50'; // Thẳng
                } else if (progressValue < 70) {
                    progressBar.style.background = '#FF9800'; // Hơi uốn
                } else {
                    progressBar.style.background = '#F44336'; // Uốn hết
                }
            }
        }
    }
    
    // Kiểm tra kết thúc calibration
    if (calibrationCountdown <= 0) {
        finishCalibration();
    }
}

function finishCalibration() {
    isCalibrating = false;
    clearInterval(calibrationInterval);
    calibrationStep = "done";
    
    // Cập nhật bentThresholds với giá trị mới
    let hasValidCalibration = false;
    for (let i = 0; i < 4; i++) {
        if (calibrationMaxValues[i] > STRAIGHT_THRESHOLDS[i] + 50) {
            bentThresholds[i] = calibrationMaxValues[i];
            hasValidCalibration = true;
        } else {
            log('CALIBRATION', `Cảm biến ${i} không có dữ liệu calibration hợp lệ (Max: ${calibrationMaxValues[i]})`);
        }
    }
    
    if (hasValidCalibration) {
        // Lưu calibration vào localStorage
        localStorage.setItem('bentThresholds', JSON.stringify(bentThresholds));
        
        // Cập nhật giao diện với threshold mới
        updateThresholdDisplay();
        
        // Cập nhật trạng thái
        updateCalibrationStatus("calibrated", `Calibration hoàn thành! Threshold đã được cập nhật.`);
        
        log('CALIBRATION', `Calibration hoàn thành: ${bentThresholds}`);
        
        // Ẩn phần calibration sau 3 giây
        setTimeout(() => {
            document.getElementById('calibrationProgress').style.display = 'none';
            document.getElementById('calibrateBtn').style.display = 'inline-block';
            document.getElementById('stopCalibrateBtn').style.display = 'none';
        }, 3000);
    } else {
        updateCalibrationStatus("error", "Calibration thất bại! Không có dữ liệu hợp lệ. Vui lòng thử lại.");
        log('CALIBRATION', 'Calibration thất bại: Không có dữ liệu hợp lệ');
        
        setTimeout(() => {
            document.getElementById('calibrationProgress').style.display = 'none';
            document.getElementById('calibrateBtn').style.display = 'inline-block';
            document.getElementById('stopCalibrateBtn').style.display = 'none';
        }, 3000);
    }
}

function stopCalibration() {
    if (isCalibrating) {
        isCalibrating = false;
        clearInterval(calibrationInterval);
        
        updateCalibrationStatus("ready", "Calibration đã dừng");
        
        document.getElementById('calibrationProgress').style.display = 'none';
        document.getElementById('calibrateBtn').style.display = 'inline-block';
        document.getElementById('stopCalibrateBtn').style.display = 'none';
        
        log('CALIBRATION', 'Calibration đã dừng bởi người dùng');
    }
}

function resetCalibration() {
    bentThresholds = [300, 450, 350, 300];
    localStorage.removeItem('bentThresholds');
    
    updateThresholdDisplay();
    updateCalibrationStatus("ready", "Đã reset về giá trị mặc định");
    
    log('CALIBRATION', 'Reset calibration về giá trị mặc định');
}

function loadCalibration() {
    const savedThresholds = localStorage.getItem('bentThresholds');
    if (savedThresholds) {
        try {
            bentThresholds = JSON.parse(savedThresholds);
            updateThresholdDisplay();
            updateCalibrationStatus("calibrated", "Đã tải calibration từ bộ nhớ");
            log('CALIBRATION', `Đã tải calibration: ${bentThresholds}`);
        } catch (e) {
            log('CALIBRATION', `Lỗi khi tải calibration: ${e.message}`);
        }
    } else {
        updateCalibrationStatus("ready", "Không tìm thấy calibration đã lưu");
        log('CALIBRATION', 'Không tìm thấy calibration đã lưu');
    }
}

function updateThresholdDisplay() {
    for (let i = 0; i < 4; i++) {
        document.getElementById(`currentThreshold${i}`).textContent = bentThresholds[i];
    }
}

function updateCalibrationStatus(status, message) {
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

// === HÀM CALCULATE FLEX STATE VỚI CALIBRATION ===
function calculateFlexState(rawValue, sensorIndex) {
    const STRAIGHT_THRESHOLD = STRAIGHT_THRESHOLDS[sensorIndex];
    
    if (rawValue <= STRAIGHT_THRESHOLD) return 0;
    if (rawValue <= bentThresholds[sensorIndex]) return 1;
    return 2;
}
