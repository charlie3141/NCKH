class FirebaseService {
    constructor() {
        this.FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/sensorData.json";
        this.pollingInterval = 300;
        this.autoRefresh = true;
        this.isFetching = false;
        this.lastFirebaseData = null;
        this.currentFetchController = null;
        
        this.dataCallbacks = [];
    }

    async fetchData() {
        if (this.isFetching) return null;
        
        // Cancel previous request if exists
        if (this.currentFetchController) {
            this.currentFetchController.abort();
        }
        
        this.isFetching = true;
        const startTime = performance.now();
        this.currentFetchController = new AbortController();
        const signal = this.currentFetchController.signal;
        
        try {
            const timestamp = Date.now();
            const url = `${this.FIREBASE_URL}?t=${timestamp}`;
            
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
            
            // Update latency display
            if (window.app && window.app.uiManager) {
                window.app.uiManager.updateLatency(Math.round(fetchTime));
            }
            
            // Process if data changed
            if (JSON.stringify(data) !== JSON.stringify(this.lastFirebaseData)) {
                this.lastFirebaseData = data;
                
                // Notify all callbacks
                this.notifyDataCallbacks(data);
                
                // Log update
                if (window.app) {
                    window.app.log('Firebase', `Data updated (${Math.round(fetchTime)}ms)`);
                }
                
                // Adjust polling based on speed
                if (fetchTime < 100) {
                    this.pollingInterval = window.app && window.app.firebaseService.turboMode ? 150 : 250;
                } else if (fetchTime > 500) {
                    this.pollingInterval = 1000;
                }
                
                this.updatePollingDisplay();
            }
            
            return data;
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                console.warn('Fetch error:', error);
                if (window.app) {
                    window.app.log('Firebase', `Error: ${error.message}`);
                }
                
                // Increase interval on error
                this.pollingInterval = Math.min(this.pollingInterval * 2, 5000);
                this.updatePollingDisplay();
            }
            return null;
        } finally {
            this.isFetching = false;
        }
    }

    notifyDataCallbacks(data) {
        this.dataCallbacks.forEach(callback => {
            try {
                callback(data);
            } catch (error) {
                console.error('Error in data callback:', error);
            }
        });
    }

    addDataCallback(callback) {
        this.dataCallbacks.push(callback);
    }

    removeDataCallback(callback) {
        const index = this.dataCallbacks.indexOf(callback);
        if (index > -1) {
            this.dataCallbacks.splice(index, 1);
        }
    }

    startAutoRefresh() {
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
        }
        
        const scheduleNextRefresh = () => {
            if (!this.autoRefresh) return;
            
            setTimeout(async () => {
                if (this.autoRefresh) {
                    await this.fetchData();
                    if (this.autoRefresh) {
                        scheduleNextRefresh();
                    }
                }
            }, this.pollingInterval);
        };
        
        scheduleNextRefresh();
    }

    stopAutoRefresh() {
        this.autoRefresh = false;
        if (this.autoRefreshInterval) {
            clearInterval(this.autoRefreshInterval);
            this.autoRefreshInterval = null;
        }
    }

    toggleAutoRefresh() {
        this.autoRefresh = !this.autoRefresh;
        if (this.autoRefresh) {
            this.startAutoRefresh();
        } else {
            this.stopAutoRefresh();
        }
        return this.autoRefresh;
    }

    setTurboMode(enabled) {
        this.turboMode = enabled;
        this.pollingInterval = enabled ? 150 : 300;
        this.updatePollingDisplay();
        
        // Restart auto-refresh with new interval
        if (this.autoRefresh) {
            this.stopAutoRefresh();
            this.startAutoRefresh();
        }
    }

    updatePollingDisplay() {
        if (window.app && window.app.uiManager) {
            window.app.uiManager.updatePollingRate(this.pollingInterval);
        }
    }
}
