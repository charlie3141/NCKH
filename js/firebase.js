// In toggleAutoRefresh() function, change to this:
function toggleAutoRefresh() {
    autoRefresh = !autoRefresh;
    const btn = document.getElementById('autoRefreshBtn');
    
    if (autoRefresh) {
        btn.textContent = `Tự động: BẬT (${pollingInterval}ms)`;
        btn.className = 'green';
        
        // Use requestAnimationFrame for better timing
        let lastFetchTime = 0;
        
        function scheduleFetch() {
            if (!autoRefresh) return;
            
            const now = performance.now();
            if (now - lastFetchTime >= pollingInterval) {
                lastFetchTime = now;
                fetchFirebaseDataOptimized().then(() => {
                    requestAnimationFrame(scheduleFetch);
                });
            } else {
                setTimeout(() => {
                    requestAnimationFrame(scheduleFetch);
                }, Math.max(0, pollingInterval - (now - lastFetchTime)));
            }
        }
        
        scheduleFetch();
        
    } else {
        btn.textContent = 'Tự động: TẮT';
        btn.className = 'red';
    }
}
