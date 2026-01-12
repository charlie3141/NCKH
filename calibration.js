class Calibration {
    constructor() {
        this.bentThresholds = [300, 450, 350, 300];
        this.STRAIGHT_THRESHOLDS = [75, 75, 75, 75];
        
        this.isCalibrating = false;
        this.calibrationTimeout = null;
        this.calibrationInterval = null;
        this.calibrationCountdown = 10;
        this.calibrationStartTime = 0;
        this.calibrationMaxValues = [0, 0, 0, 0];
        this.calibrationCurrentSensor = 0;
        this.calibrationStep = "waiting";
    }

    startCalibration() {
        if (this.isCalibrating) return;
        
        this.isCalibrating = true;
        this.calibrationCountdown = 10;
        this.calibrationStartTime = Date.now();
        this.calibrationMaxValues = [0, 0, 0, 0];
        this.calibrationCurrentSensor = 0;
        this.calibrationStep = "calibrating";
        
        // Update UI
        if (window.app && window.app.uiManager) {
            window.app.uiManager.showCalibrationProgress();
        }
        
        // Log
        if (window.app) {
            window.app.log('CALIBRATION', 'Bắt đầu calibration cảm biến uốn');
        }
        
        // Start countdown
        this.calibrationInterval = setInterval(() => this.updateCalibration(), 1000);
    }

    updateCalibration() {
        if (!this.isCalibrating) return;
        
        this.calibrationCountdown--;
        
        // Update UI
        if (window.app && window.app.uiManager) {
            window.app.uiManager.updateCalibrationCountdown(this.calibrationCountdown);
            window.app.uiManager.updateCalibrationProgress(10 - this.calibrationCountdown, 10);
        }
        
        // Update sensor values if we have data
        if (window.app && window.app.sensorProcessor) {
            const flexStates = window.app.sensorProcessor.flexStates;
            if (window.app && window.app.uiManager) {
                window.app.uiManager.updateCalibrationSensors(flexStates, this.calibrationMaxValues);
            }
        }
        
        // Check for completion
        if (this.calibrationCountdown <= 0) {
            this.finishCalibration();
        }
    }

    finishCalibration() {
        this.isCalibrating = false;
        clearInterval(this.calibrationInterval);
        this.calibrationStep = "done";
        
        // Update bentThresholds with new values
        let hasValidCalibration = false;
        for (let i = 0; i < 4; i++) {
            if (this.calibrationMaxValues[i] > this.STRAIGHT_THRESHOLDS[i] + 50) {
                this.bentThresholds[i] = this.calibrationMaxValues[i];
                hasValidCalibration = true;
            } else if (window.app) {
                window.app.log('CALIBRATION', `Cảm biến ${i} không có dữ liệu calibration hợp lệ (Max: ${this.calibrationMaxValues[i]})`);
            }
        }
        
        if (hasValidCalibration) {
            // Save to localStorage
            localStorage.setItem('bentThresholds', JSON.stringify(this.bentThresholds));
            
            // Update UI
            if (window.app && window.app.uiManager) {
                window.app.uiManager.updateCalibrationStatus("calibrated", "Calibration hoàn thành! Threshold đã được cập nhật.");
                window.app.uiManager.updateThresholdDisplay(this.bentThresholds);
                window.app.uiManager.hideCalibrationProgress();
            }
            
            if (window.app) {
                window.app.log('CALIBRATION', `Calibration hoàn thành: ${this.bentThresholds}`);
            }
        } else {
            if (window.app && window.app.uiManager) {
                window.app.uiManager.updateCalibrationStatus("error", "Calibration thất bại! Không có dữ liệu hợp lệ. Vui lòng thử lại.");
                window.app.uiManager.hideCalibrationProgress();
            }
            
            if (window.app) {
                window.app.log('CALIBRATION', 'Calibration thất bại: Không có dữ liệu hợp lệ');
            }
        }
    }

    stopCalibration() {
        if (this.isCalibrating) {
            this.isCalibrating = false;
            clearInterval(this.calibrationInterval);
            
            if (window.app && window.app.uiManager) {
                window.app.uiManager.updateCalibrationStatus("ready", "Calibration đã dừng");
                window.app.uiManager.hideCalibrationProgress();
            }
            
            if (window.app) {
                window.app.log('CALIBRATION', 'Calibration đã dừng bởi người dùng');
            }
        }
    }

    resetCalibration() {
        this.bentThresholds = [300, 450, 350, 300];
        localStorage.removeItem('bentThresholds');
        
        if (window.app && window.app.uiManager) {
            window.app.uiManager.updateCalibrationStatus("ready", "Đã reset về giá trị mặc định");
            window.app.uiManager.updateThresholdDisplay(this.bentThresholds);
        }
        
        if (window.app) {
            window.app.log('CALIBRATION', 'Reset calibration về giá trị mặc định');
        }
    }

    loadSavedThresholds() {
        const savedThresholds = localStorage.getItem('bentThresholds');
        if (savedThresholds) {
            try {
                this.bentThresholds = JSON.parse(savedThresholds);
                if (window.app && window.app.uiManager) {
                    window.app.uiManager.updateCalibrationStatus("calibrated", "Đã tải calibration từ bộ nhớ");
                    window.app.uiManager.updateThresholdDisplay(this.bentThresholds);
                }
                if (window.app) {
                    window.app.log('CALIBRATION', `Đã tải calibration: ${this.bentThresholds}`);
                }
            } catch (e) {
                if (window.app) {
                    window.app.log('CALIBRATION', `Lỗi khi tải calibration: ${e.message}`);
                }
            }
        } else {
            if (window.app && window.app.uiManager) {
                window.app.uiManager.updateCalibrationStatus("ready", "Không tìm thấy calibration đã lưu");
            }
            if (window.app) {
                window.app.log('CALIBRATION', 'Không tìm thấy calibration đã lưu');
            }
        }
    }
}
