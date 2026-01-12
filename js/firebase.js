// js/firebase-debug.js - TEMPORARY DEBUG FILE
const FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/sensorData.json";

async function fetchFirebaseDataDebug() {
    console.log("🔄 Fetching Firebase data...");
    
    try {
        // Test 1: Fetch without any options
        const response = await fetch(FIREBASE_URL);
        console.log("Response status:", response.status);
        
        if (!response.ok) {
            console.error("HTTP Error:", response.status, response.statusText);
            return null;
        }
        
        const data = await response.json();
        console.log("📊 Raw Firebase Data:", data);
        
        // Log each field
        console.log("🔍 Field Analysis:");
        console.log("f0 (Flex 0):", data.f0);
        console.log("f1 (Flex 1):", data.f1);
        console.log("f2 (Flex 2):", data.f2);
        console.log("f3 (Flex 3):", data.f3);
        console.log("o (Orientation):", data.o);
        console.log("d (Shake State):", data.d);
        console.log("sf (Is Shaking):", data.sf);
        
        // Check if data is all zeros/default
        const isDefaultData = data.f0 === 0 && data.f1 === 0 && data.f2 === 0 && data.f3 === 0;
        if (isDefaultData) {
            console.warn("⚠️ WARNING: All sensor values are 0!");
            console.warn("This means:");
            console.warn("1. ESP32 is not connected");
            console.warn("2. ESP32 code has issues");
            console.warn("3. Sensors are not working");
        }
        
        // Update UI even with zeros for debugging
        document.getElementById('mpuOrientation').textContent = data.o || 'N/A';
        document.getElementById('mpuShakeState').textContent = data.d || 'No';
        document.getElementById('isShaking').textContent = data.sf || 'NO';
        
        document.getElementById('rawValues').textContent = `${data.f0}, ${data.f1}, ${data.f2}, ${data.f3}`;
        
        // Update flex boxes
        for (let i = 0; i < 4; i++) {
            const box = document.getElementById(`flex${i}-box`);
            if (box) {
                box.textContent = data[`f${i}`] || 0;
                box.className = `flex-box active-0`; // Always green for zeros
            }
        }
        
        return data;
        
    } catch (error) {
        console.error("❌ Fetch Error:", error);
        console.error("Error details:", error.message);
        
        // Try alternative URL
        console.log("🔄 Trying alternative URL...");
        try {
            const altResponse = await fetch(FIREBASE_URL.replace('.json', ''));
            const altData = await altResponse.json();
            console.log("Alternative data:", altData);
        } catch (altError) {
            console.error("Alternative also failed:", altError);
        }
        
        return null;
    }
}

// Test immediately
setTimeout(() => {
    console.log("🚀 Starting Firebase debug test...");
    fetchFirebaseDataDebug();
    
    // Test again in 5 seconds
    setTimeout(fetchFirebaseDataDebug, 5000);
}, 1000);
