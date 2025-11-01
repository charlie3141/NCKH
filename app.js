// app.js for https://gangtay.netlify.app
// Polls Firebase Realtime DB at /message.json (regional host) and speaks new messages.
// Replace POLL_INTERVAL_MS if you want faster/slower polling.

const FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/message.json";
const POLL_INTERVAL_MS = 1000; // 1s poll

let lastTs = 0;
let vietVoice = null;

function loadVoices(timeoutMs = 2000) {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    function onVoicesChanged() {
      const v = speechSynthesis.getVoices();
      speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged);
      resolve(v);
    }
    speechSynthesis.addEventListener("voiceschanged", onVoicesChanged);
    setTimeout(() => {
      const v = speechSynthesis.getVoices();
      try { speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged); } catch(e){}
      resolve(v);
    }, timeoutMs);
  });
}

async function pickVietnameseVoice() {
  if (vietVoice) return vietVoice;
  const voices = await loadVoices();
  vietVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("vi"));
  if (!vietVoice) vietVoice = voices.find(v => v.name && /viet/i.test(v.name));
  return vietVoice;
}

async function speakText(text, { rate = 1.0, pitch = 1.0 } = {}) {
  if (!text) return;
  const voice = await pickVietnameseVoice();
  return new Promise((resolve, reject) => {
    try {
      try { speechSynthesis.cancel(); } catch (e) {}
      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate; u.pitch = pitch;
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = (e) => reject(e);
      speechSynthesis.speak(u);
    } catch (err) {
      reject(err);
    }
  });
}

function setStatus(msg) {
  const el = document.getElementById("info");
  if (el) el.textContent = msg;
  console.log("[app] " + msg);
}

async function pollMessage() {
  try {
    const res = await fetch(FIREBASE_URL, { cache: "no-store" });
    if (!res.ok) {
      setStatus(`Firebase fetch failed: ${res.status}`);
      console.warn("Fetch failed, status:", res.status, "url:", FIREBASE_URL);
      return;
    }
    const j = await res.json();
    if (!j || typeof j !== "object") return;
    const text = (typeof j.text === "string") ? j.text : (typeof j.message === "string" ? j.message : null);
    const ts = (typeof j.ts !== "undefined") ? j.ts : null;
    if (!text) return;
    if (ts === null) {
      if (text !== (window.__lastSpokenText || null)) {
        window.__lastSpokenText = text;
        setStatus("Speaking (no-ts): " + text);
        try { await speakText(text); setStatus("Spoken."); } catch(e) { setStatus("TTS error"); console.error(e); }
      }
      return;
    }
    if (ts !== lastTs) {
      lastTs = ts;
      setStatus("New message: " + text);
      try { await speakText(text); setStatus("Spoken: " + text); } catch(e) { setStatus("TTS error"); console.error(e); }
    }
  } catch (err) {
    setStatus("Poll error: " + err.message);
    console.warn(err);
  }
}

function initManualControls() {
  const btn = document.getElementById("btn");
  if (btn) {
    btn.addEventListener("click", async () => {
      const txtInput = document.getElementById("text");
      const text = txtInput ? txtInput.value.trim() : null;
      if (text) {
        try { setStatus("Manual speak: " + text); await speakText(text); setStatus("Done speaking"); } 
        catch (e) { setStatus("Manual TTS error"); console.error(e); }
      }
      setStatus("Manual poll...");
      await pollMessage();
    });
  }
}

function startPolling() {
  pollMessage();
  setInterval(pollMessage, POLL_INTERVAL_MS);
}

window.addEventListener("load", async () => {
  setStatus("Initializing voices...");
  await loadVoices();
  await pickVietnameseVoice();
  setStatus("Ready. Polling Firebase every " + (POLL_INTERVAL_MS/1000) + "s");
  initManualControls();
  startPolling();
});
