// Main application controller
class MainApp {
    constructor() {
        this.firebaseService = new FirebaseService();
        this.sensorProcessor = new SensorProcessor();
        this.calibration = new Calibration();
        this.speechTTS = new SpeechTTS();
        this.translation = new Translation();
        this.uiManager = new UIManager();
        
        this.init();
    }

    async init() {
        console.log('Initializing application...');
        
        // Initialize components
        this.uiManager.initUI();
        this.calibration.loadSavedThresholds();
        
        // Start performance monitoring
        this.startPerformanceMonitoring();
        
        // Initial data fetch
        await this.firebaseService.fetchData();
        
        // Start auto-refresh
        this.firebaseService.startAutoRefresh();
        
        // Log initialization
        this.log('SYSTEM', 'Optimized app started with calibration');
        
        // Load phrase suggestions
        this.uiManager.loadPhraseSuggestions();
    }

    log(source, message) {
        this.uiManager.addLogEntry(source, message);
    }

    startPerformanceMonitoring() {
        let frameCount = 0;
        let lastFrameTime = performance.now();
        let currentFPS = 60;

        const updateFPS = () => {
            frameCount++;
            const currentTime = performance.now();
            if (currentTime - lastFrameTime >= 1000) {
                currentFPS = frameCount;
                frameCount = 0;
                lastFrameTime = currentTime;
                
                this.uiManager.updateFPS(currentFPS);
            }
            requestAnimationFrame(updateFPS);
        };
        
        requestAnimationFrame(updateFPS);
    }

    // Global event handlers
    handleSensorData(data) {
        this.sensorProcessor.processSensorData(data);
        this.uiManager.updateSensorDisplay(data, this.sensorProcessor.flexStates);
        
        // Process word construction
        const mpuState = vietnameseConverter.getMPUState(data.o || "", data.d || "");
        this.sensorProcessor.processWordConstruction(
            mpuState,
            this.sensorProcessor.flexStates[0],
            this.sensorProcessor.flexStates[1],
            this.sensorProcessor.flexStates[2],
            this.sensorProcessor.flexStates[3]
        );
        
        // Update UI with current word
        this.uiManager.updateCurrentWord(
            this.sensorProcessor.displayBuffer,
            vietnameseConverter.convertVietnameseWord(this.sensorProcessor.displayBuffer)
        );
    }
}

// Initialize the app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    window.app = new MainApp();
});
