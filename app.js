// app.js for https://gangtay.netlify.app
// Polls Firebase Realtime DB at /message.json and speaks new messages with speechSynthesis.
// Replace FIREBASE_URL if your DB path changes. (This file already targets your project ID.)

const FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.firebaseio.com/message.json";
const POLL_INTERVAL_MS = 1000; // 1s poll

let lastTs = 0;
let vietVoice = null;

// Wait for available voices (resolves with speechSynthesis.getVoices())
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

    // fallback: resolve after timeout with whatever is available
    setTimeout(() => {
      const v = speechSynthesis.getVoices();
      try { speechSynthesis.removeEventListener("voiceschanged", onVoicesChanged); } catch(e){}
      resolve(v);
    }, timeoutMs);
  });
}

// pick a Vietnamese voice if available otherwise null
async function pickVietnameseVoice() {
  if (vietVoice) return vietVoice;
  const voices = await loadVoices();
  // prefer voices with language starting 'vi'
  vietVoice = voices.find(v => v.lang && v.lang.toLowerCase().startsWith("vi"));
  if (!vietVoice) {
    // next try names that include 'Vietnam' or 'Viet'
    vietVoice = voices.find(v => v.name && /viet/i.test(v.name));
  }
  // if still not found, leave as null (browser default will be used)
  return vietVoice;
}

// speak text using selected voice, returns Promise that resolves on end or rejects on error
async function speakText(text, { rate = 1.0, pitch = 1.0 } = {}) {
  if (!text) return;
  const voice = await pickVietnameseVoice();
  return new Promise((resolve, reject) => {
    try {
      // Stop previous speech to avoid stacking
      try { speechSynthesis.cancel(); } catch (e) {}

      const u = new SpeechSynthesisUtterance(text);
      u.rate = rate;
      u.pitch = pitch;
      if (voice) u.voice = voice;
      u.onend = () => resolve();
      u.onerror = (e) => reject(e);
      speechSynthesis.speak(u);
    } catch (err) {
      reject(err);
    }
  });
}

// Update visible status (if index.html has element with id="info")
function setStatus(msg) {
  const el = document.getElementById("info");
  if (el) el.textContent = msg;
  console.log("[app] " + msg);
}

// Poll Firebase message.json and speak when new ts appears
async function pollMessage() {
  try {
    const res = await fetch(FIREBASE_URL, { cache: "no-store" });
    if (!res.ok) {
      setStatus(`Firebase fetch failed: ${res.status}`);
      return;
    }
    const j = await res.json(); // expected shape: { text: "...", ts: 12345 }
    if (!j || typeof j !== "object") {
      // empty or null
      return;
    }
    // Some sanity: support either j.text or j.message
    const text = (typeof j.text === "string") ? j.text : (typeof j.message === "string" ? j.message : null);
    const ts = (typeof j.ts !== "undefined") ? j.ts : (j.ts === 0 ? 0 : null);

    if (!text) return; // nothing to speak

    // If ts present and changed -> speak. If ts missing, speak once (and set lastTs to now)
    if (ts === null) {
      // no timestamp provided — speak only if different text than last spoken
      if (text !== (window.__lastSpokenText || null)) {
        window.__lastSpokenText = text;
        setStatus("Speaking (no-ts): " + text);
        try { await speakText(text); setStatus("Spoken."); } catch(e) { setStatus("TTS error"); console.error(e); }
      }
      return;
    }

    // ts present
    if (ts !== lastTs) {
      lastTs = ts;
      setStatus("New message: " + text);
      try {
        await speakText(text);
        setStatus("Spoken: " + text);
      } catch (e) {
        setStatus("TTS error");
        console.error(e);
      }
    }
  } catch (err) {
    setStatus("Poll error: " + err.message);
    console.warn(err);
  }
}

// Expose a manual refresh button behavior if present
function initManualControls() {
  const btn = document.getElementById("btn");
  if (btn) {
    btn.addEventListener("click", async () => {
      const txtInput = document.getElementById("text");
      const espInput = document.getElementById("esp"); // kept for compatibility with previous UI
      // If user provided local text, speak it and optionally send to ESP (not in scope)
      const text = txtInput ? txtInput.value.trim() : null;
      if (text) {
        try {
          setStatus("Manual speak: " + text);
          await speakText(text);
          setStatus("Done speaking");
        } catch (e) {
          setStatus("Manual TTS error");
        }
      }
      // Manual trigger to immediately poll firebase
      setStatus("Manual poll...");
      await pollMessage();
    });
  }
}

// Start polling loop
function startPolling() {
  // initial quick poll
  pollMessage();
  // regular interval
  setInterval(pollMessage, POLL_INTERVAL_MS);
}

// run on load
window.addEventListener("load", async () => {
  setStatus("Initializing voices...");
  // warm voices cache
  await loadVoices();
  await pickVietnameseVoice(); // optional
  setStatus("Ready. Polling Firebase every " + (POLL_INTERVAL_MS/1000) + "s");
  initManualControls();
  startPolling();
});
