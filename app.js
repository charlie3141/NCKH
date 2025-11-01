// app.js — Netlify client: poll Firebase, fetch server TTS (ElevenLabs) and play audio
// FIREBASE_URL must point to your regional DB message.json
const FIREBASE_URL = "https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/message.json";
const POLL_INTERVAL_MS = 1000; // 1s poll

let lastTs = 0;
let lastText = null;
let isPlaying = false;

function setStatus(msg) {
  const el = document.getElementById("info");
  if (el) el.textContent = msg;
  console.log("[app] " + msg);
}

// fallback local browser TTS (in case server TTS fails)
async function speakFallback(text) {
  if (!text) return;
  return new Promise((resolve, reject) => {
    try {
      try { speechSynthesis.cancel(); } catch(e) {}
      const u = new SpeechSynthesisUtterance(text);
      // try to pick a Vietnamese voice if available
      const v = (speechSynthesis.getVoices() || []).find(v => v.lang && v.lang.toLowerCase().startsWith("vi"));
      if (v) u.voice = v;
      u.rate = 1.0;
      u.onend = () => resolve();
      u.onerror = (e) => reject(e);
      speechSynthesis.speak(u);
    } catch (err) {
      reject(err);
    }
  });
}

// fetch TTS from Netlify function and play the returned MP3 blob
async function fetchAndPlayTTS(text) {
  if (!text) return false;
  try {
    setStatus("Requesting TTS...");
    const url = '/.netlify/functions/tts?text=' + encodeURIComponent(text);
    const res = await fetch(url, { method: 'GET' });
    if (!res.ok) {
      const body = await res.text().catch(()=>"[no body]");
      console.error('TTS function failed', res.status, body);
      setStatus('TTS server error');
      return false;
    }
    const blob = await res.blob(); // audio/mpeg
    const audioUrl = URL.createObjectURL(blob);
    const audio = new Audio(audioUrl);
    isPlaying = true;
    setStatus('Playing TTS...');
    await audio.play(); // returns a promise in modern browsers
    // wait for end
    await new Promise((resolve) => {
      audio.onended = () => resolve();
      audio.onerror = () => resolve(); // continue on error
    });
    isPlaying = false;
    URL.revokeObjectURL(audioUrl);
    setStatus('TTS playback finished');
    return true;
  } catch (err) {
    console.error('fetchAndPlayTTS error', err);
    isPlaying = false;
    setStatus('TTS fetch/play error');
    return false;
  }
}

// poll firebase and handle new messages
async function pollMessage() {
  if (isPlaying) return; // don't interrupt playback (optional policy)
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

    // if timestamp exists, use it to detect new; otherwise use text change
    if (ts !== null) {
      if (ts !== lastTs) {
        lastTs = ts;
        lastText = text;
        setStatus("New message: " + text);
        // try server-side TTS (ElevenLabs via Netlify function)
        const ok = await fetchAndPlayTTS(text);
        if (!ok) {
          // fallback to local browser TTS
          await speakFallback(text).catch(e=>console.error(e));
        }
      }
    } else {
      // no timestamp: speak once when text changes
      if (text !== lastText) {
        lastText = text;
        setStatus("New message (no-ts): " + text);
        const ok = await fetchAndPlayTTS(text);
        if (!ok) await speakFallback(text).catch(e=>console.error(e));
      }
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
      const txt = (document.getElementById("text") || {}).value || "";
      if (txt.trim()) {
        setStatus("Manual play: " + txt);
        const ok = await fetchAndPlayTTS(txt.trim());
        if (!ok) await speakFallback(txt.trim());
      }
      // do an immediate poll too
      await pollMessage();
    });
  }
}

function startPolling() {
  pollMessage();
  setInterval(pollMessage, POLL_INTERVAL_MS);
}

window.addEventListener("load", async () => {
  setStatus("Ready. Polling Firebase every " + (POLL_INTERVAL_MS/1000) + "s");
  // warm up voices list (some browsers populate later)
  try { speechSynthesis.getVoices(); } catch(e){}
  initManualControls();
  startPolling();
});
