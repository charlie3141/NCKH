// CONFIG
const AUDIO_BASE = '/audio/';
const firebaseMessageUrl =
  document.querySelector('#firebaseUrl')?.value ||
  'https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/message.json';
const pollInput = document.querySelector('#pollMs');
const cooldownInput = document.querySelector('#cooldownMs');
const allowDuplicatesCheckbox = document.querySelector('#allowDuplicates');
const enableBtn = document.querySelector('#enableBtn');

// runtime state
let audio = null;
let audioCtx = null;
let currentSource = null;
let isPolling = false;
let pollTimer = null;
let lastPlayedIndex = null;
let lastPlayedAt = 0;
let isAudioUnlocked = false;
let eventSource = null;

// init button
enableBtn.addEventListener('click', async () => {
  await unlockAudio();
  startConnection();
});

async function unlockAudio() {
  if (!audio) {
    audio = new Audio();
    audio.playsInline = true;
    audio.crossOrigin = 'anonymous';
    audio.preload = 'auto';
  }

  if (!audioCtx)
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  try {
    audio.muted = true;
    audio.src = AUDIO_BASE + '0000.mp3';
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;

    if (audioCtx.state === 'suspended') await audioCtx.resume();

    isAudioUnlocked = true;
    console.log('[3:55:40 AM] Audio unlocked by user gesture');
  } catch (err) {
    console.warn('audio unlock attempt failed', err);
    try {
      if (audioCtx.state === 'suspended') await audioCtx.resume();
    } catch (_) {}
  }
}

// --- AUTO-CONNECTION LOGIC ---
function startConnection() {
  console.log('[3:55:34 AM] Attempting SSE (will fallback automatically)');
  trySSE();

  // fallback timer: if no open within 5s, start polling
  setTimeout(() => {
    if (!eventSource || eventSource.readyState !== 1) {
      console.warn('[3:55:43 AM] SSE failed, falling back to polling');
      startPolling();
    }
  }, 5000);
}

function trySSE() {
  try {
    eventSource = new EventSource(firebaseMessageUrl);
    eventSource.onopen = () => {
      console.log('[3:55:34 AM] SSE opened to ' + firebaseMessageUrl);
    };
    eventSource.onerror = (e) => {
      console.warn('SSE error:', e);
      stopSSE();
      startPolling();
    };
    eventSource.onmessage = (e) => {
      try {
        const data = JSON.parse(e.data);
        console.log('[3:55:34 AM] SSE payload:', data);
        if (data) handleMessage(data.index, data.file, data);
      } catch (err) {
        console.warn('bad SSE payload', e.data);
      }
    };
  } catch (err) {
    console.warn('SSE setup failed, fallback to polling', err);
    startPolling();
  }
}

function stopSSE() {
  if (eventSource) {
    eventSource.close();
    eventSource = null;
    console.log('[3:55:40 AM] SSE stopped');
  }
}

// --- POLLING ---
function startPolling() {
  if (isPolling) return;
  isPolling = true;
  const ms = parseInt(pollInput?.value || 1000, 10);
  pollTimer = setInterval(doPollOnce, ms);
  console.log('[3:55:43 AM] Polling started at', ms, 'ms');
}

function stopPolling() {
  if (!isPolling) return;
  clearInterval(pollTimer);
  pollTimer = null;
  isPolling = false;
  console.log('[3:55:40 AM] Polling stopped');
}

async function doPollOnce() {
  try {
    const res = await fetch(firebaseMessageUrl, { cache: 'no-store' });
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const body = await res.json();
    if (!body) return;
    const idx = body.index;
    const filename = body.file || String(idx).padStart(4, '0') + '.mp3';
    handleMessage(idx, filename, body);
  } catch (err) {
    console.warn('poll error', err);
  }
}

// --- MESSAGE HANDLER ---
async function handleMessage(idx, filename, raw) {
  if (!idx && !filename) {
    console.log('[3:55:43 AM] Payload ignored');
    return;
  }

  const now = Date.now();
  const cooldownMs = parseInt(cooldownInput?.value || 2000, 10);
  const allowDuplicates =
    allowDuplicatesCheckbox?.checked !== undefined
      ? allowDuplicatesCheckbox.checked
      : true;

  if (!allowDuplicates && idx === lastPlayedIndex) {
    console.log('duplicate blocked:', idx);
    return;
  }

  if (now - lastPlayedAt < cooldownMs) {
    console.log('blocked by cooldown', now - lastPlayedAt);
    return;
  }

  lastPlayedIndex = idx;
  lastPlayedAt = now;

  await stopPlayback();
  await playViaAudioElement(filename);
}

// --- PLAYBACK HELPERS ---
async function stopPlayback() {
  try {
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      console.log('stopped HTMLAudioElement');
    }
  } catch (_) {}

  try {
    if (currentSource) {
      currentSource.stop(0);
      currentSource.disconnect();
      currentSource = null;
      console.log('stopped AudioContext source');
    }
  } catch (_) {}
}

async function playViaAudioElement(filename) {
  const url = AUDIO_BASE + filename;
  if (!audio) {
    console.warn('no audio element; creating one');
    audio = new Audio();
    audio.playsInline = true;
  }
  audio.src = url;

  try {
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    await audio.play();
    console.log('Played via HTMLAudio:', filename);
  } catch (err) {
    console.warn('Element play blocked or failed, trying fallback', err);
    try {
      await playViaAudioContextFetch(url, filename);
    } catch (e) {
      console.error('fallback failed', e);
    }
  }
}

async function playViaAudioContextFetch(url, filename) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') await audioCtx.resume();

  const resp = await fetch(url, { cache: 'no-store' });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  const ab = await resp.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(ab);

  if (currentSource) {
    try { currentSource.stop(0); } catch(_) {}
    currentSource.disconnect();
    currentSource = null;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(audioCtx.destination);
  src.start(0);
  currentSource = src;
  src.onended = () => { currentSource = null; console.log('AudioContext playback ended'); };

  console.log('Playing (fallback) ' + filename);
}
