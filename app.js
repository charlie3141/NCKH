// CONFIG: adapt these to your UI
const AUDIO_BASE = '/audio/'; // where 0001.mp3 etc are served
const firebaseMessageUrl = document.querySelector('#firebaseUrl').value || 'https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/message.json';
const pollInput = document.querySelector('#pollMs'); // element or use a fixed value
const cooldownInput = document.querySelector('#cooldownMs');
const allowDuplicatesCheckbox = document.querySelector('#allowDuplicates');
const enableBtn = document.querySelector('#enableBtn'); // "Enable audio & Start polling" button

// runtime state
let audio = null;                // HTMLAudioElement (preferred)
let audioCtx = null;             // AudioContext for fallback
let currentSource = null;        // AudioBufferSourceNode playing via audioCtx
let isPolling = false;
let pollTimer = null;
let lastPlayedIndex = null;
let lastPlayedAt = 0;
let isAudioUnlocked = false;

// SSE state
let sse = null;
let sseErrorCount = 0;
const SSE_MAX_ERRORS = 3;     // how many consecutive errors before giving up
const SSE_RETRY_MS = 1000;    // retry delay for transient errors
const SSE_AUTO_RETRY_MS = 30_000; // after falling back to polling, try SSE again this often
let sseAutoRetryTimer = null;
let usingSse = true; // prefer SSE first; fallback to polling when SSE deemed unhealthy

// initialize button
enableBtn.addEventListener('click', async (e) => {
  // create audio elements and unlock audio in user gesture
  if (!audio) {
    audio = new Audio();
    audio.playsInline = true;
    audio.crossOrigin = "anonymous";
    audio.preload = 'auto';
    audio.addEventListener('ended', () => { console.log('audio ended'); });
    audio.addEventListener('play', () => { console.log('audio play event'); });
  }

  if (!audioCtx) {
    // create but do not resume until user gesture
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }

  try {
    // attempt a quick muted play to unlock on mobile browsers
    audio.muted = true;
    audio.src = AUDIO_BASE + '0000.mp3'; // a very short silent file if you have one; otherwise the file can be normal
    await audio.play();
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;

    // resume AudioContext (important for Safari / iOS)
    if (audioCtx.state === 'suspended') await audioCtx.resume();

    isAudioUnlocked = true;
    console.log('audio unlocked by user gesture');
  } catch (err) {
    console.warn('audio unlock attempt failed (still proceed):', err);
    // even if unlock failed, try to resume AudioContext
    try { if (audioCtx.state === 'suspended') await audioCtx.resume(); } catch(_) {}
  }

  // start SSE (preferred) which will fallback to polling if necessary
  startSse(firebaseMessageUrl);
});

// polling control
function startPolling() {
  if (isPolling) return;
  isPolling = true;
  const ms = parseInt(pollInput?.value || 1000, 10);
  pollTimer = setInterval(doPollOnce, ms);
  console.log('polling started', ms);
  // do an immediate poll once
  doPollOnce().catch(e => console.warn('initial poll failed', e));
}

function stopPolling() {
  if (!isPolling) return;
  clearInterval(pollTimer);
  pollTimer = null;
  isPolling = false;
  console.log('polling stopped');
}

// simple polling function (fetch JSON)
async function doPollOnce() {
  try {
    const res = await fetch(firebaseMessageUrl, {cache: "no-store"});
    if (!res.ok) throw new Error('fetch failed ' + res.status);
    const body = await res.json();
    // adapt depending on your message structure
    const idx = body.index;
    const filename = (body.file) ? body.file : String(idx).padStart(4,'0') + '.mp3';
    handleMessage(idx, filename, body);
  } catch (err) {
    console.warn('poll error', err);
  }
}

// SSE helpers
function handleStreamData(rawData){
  // rawData is typically a JSON string like {"path":"/","data":{...}}
  if (!rawData) return;
  try {
    const pkt = (typeof rawData === 'string') ? JSON.parse(rawData) : rawData;
    const j = (pkt && pkt.data !== undefined) ? pkt.data : pkt; // firebase sends pkt.data
    if (!j) return;

    // try to extract index/file similar to polling
    const idx = j.index;
    const filename = j.file ? j.file : (typeof idx !== 'undefined' ? String(idx).padStart(4,'0') + '.mp3' : null);

    // very common: firebase streams can include keep-alive or tiny updates; pass through handleMessage which has cooldown/duplicate guards
    if (typeof idx !== 'undefined' || filename) {
      handleMessage(idx, filename, j);
    } else if (typeof j.text === 'string') {
      // attempt to extract a leading number inside text like "398 ay:" — find first number token
      const m = j.text.match(/(\d+)/);
      if (m) {
        const n = parseInt(m[1], 10);
        const f = String(n).padStart(4,'0') + '.mp3';
        handleMessage(n, f, j);
      } else {
        // no actionable number — ignore
      }
    }
  } catch (e) {
    console.warn('SSE parse error', e, rawData);
  }
}

function startSse(url){
  // clear any auto-retry timer
  if (sseAutoRetryTimer) { clearTimeout(sseAutoRetryTimer); sseAutoRetryTimer = null; }

  // if an SSE is already running, do nothing
  if (sse) return;

  // create new EventSource
  try {
    sseErrorCount = 0;
    sse = new EventSource(url);

    sse.onopen = () => {
      sseErrorCount = 0;
      console.log('SSE opened to', url);
      // when SSE is healthy, stop polling to avoid duplicate handling
      if (isPolling) {
        stopPolling();
        console.log('stopped polling because SSE connected');
      }
    };

    // firebase-specific events
    sse.addEventListener('put', ev => {
      if (!ev || !ev.data) return;
      sseErrorCount = 0;
      handleStreamData(ev.data);
    });

    sse.addEventListener('patch', ev => {
      if (!ev || !ev.data) return;
      sseErrorCount = 0;
      handleStreamData(ev.data);
    });

    // fallback: plain message events
    sse.onmessage = (ev) => {
      if (!ev || !ev.data) return;
      sseErrorCount = 0;
      handleStreamData(ev.data);
    };

    sse.onerror = (ev) => {
      sseErrorCount++;
      console.warn('SSE error #' + sseErrorCount, ev);

      try {
        const state = sse && sse.readyState;
        // EventSource.CLOSED === 2
        if (state === EventSource.CLOSED || sseErrorCount >= SSE_MAX_ERRORS) {
          console.warn('SSE failing repeatedly — fallback to polling');
          stopSse();
          // start polling as fallback
          startPolling();
          // schedule an auto-retry to try SSE again after some time
          sseAutoRetryTimer = setTimeout(() => {
            console.log('SSE auto-retry: attempting to reconnect SSE');
            startSse(url);
          }, SSE_AUTO_RETRY_MS);
        } else {
          // transient error: close and retry after a short delay
          console.warn('SSE transient error — will retry in', SSE_RETRY_MS, 'ms');
          stopSse();
          setTimeout(() => {
            startSse(url);
          }, SSE_RETRY_MS);
        }
      } catch (err) {
        console.error('SSE error handler threw', err);
        stopSse();
        startPolling();
      }
    };

  } catch (e) {
    console.warn('SSE failed to create', e);
    // fallback
    stopSse();
    startPolling();
  }
}

function stopSse(){
  if (sse) {
    try { sse.close(); } catch(_) {}
    sse = null;
  }
  sseErrorCount = 0;
  if (sseAutoRetryTimer) { clearTimeout(sseAutoRetryTimer); sseAutoRetryTimer = null; }
}

// ensure we teardown if user navigates away
window.addEventListener('beforeunload', () => {
  stopSse();
  stopPolling();
});

// existing playback logic (kept intact)

// simple guard: if idx is undefined but filename present, we still pass null idx through
async function handleMessage(idx, filename, raw) {
  const now = Date.now();
  const cooldownMs = parseInt(cooldownInput?.value || 2000, 10);
  const allowDuplicates = allowDuplicatesCheckbox ? allowDuplicatesCheckbox.checked : true;

  // duplicate guard
  if (!allowDuplicates && idx === lastPlayedIndex) {
    console.log('duplicate blocked:', idx);
    return;
  }

  // cooldown guard
  if ((now - lastPlayedAt) < cooldownMs) {
    console.log('blocked by cooldown', now - lastPlayedAt);
    return;
  }

  lastPlayedIndex = idx;
  lastPlayedAt = now;

  // stop existing playback (either HTMLAudio or AudioContext source)
  await stopPlayback();

  // attempt normal audio element playback first
  if (!filename && typeof idx !== 'undefined') {
    filename = String(idx).padStart(4,'0') + '.mp3';
  }
  if (!filename) {
    console.warn('no filename or index; ignoring payload', raw);
    return;
  }
  await playViaAudioElement(filename);
}

async function stopPlayback() {
  try {
    if (audio && !audio.paused) {
      audio.pause();
      audio.currentTime = 0;
      console.log('stopped HTMLAudioElement');
    }
  } catch(e){}

  try {
    if (currentSource) {
      try { currentSource.stop(0); } catch(e){ }
      currentSource.disconnect();
      currentSource = null;
      console.log('stopped AudioContext source');
    }
  } catch(e){}
}

// try direct play with <audio>, otherwise fallback to fetch+decode
async function playViaAudioElement(filename) {
  const url = AUDIO_BASE + filename;
  if (!audio) {
    console.warn('no audio element; creating one');
    audio = new Audio();
    audio.playsInline = true;
  }

  audio.src = url;

  // Try direct play
  try {
    // ensure AudioContext resumed if present
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();

    await audio.play();
    console.log('Played via buffer:', filename);
    return;
  } catch (err) {
    console.warn('Element play blocked or failed, trying fetch+decode fallback', err);
    // fallback:
    try {
      await playViaAudioContextFetch(url, filename);
    } catch (e) {
      console.error('fallback failed', e);
      // UI: tell user to tap preview or enable audio
    }
  }
}

// fallback: fetch arrayBuffer -> decode -> play via AudioContext
async function playViaAudioContextFetch(url, filename) {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') {
    try { await audioCtx.resume(); } catch(e) { console.warn('resume fail', e); }
  }

  const resp = await fetch(url, {cache: "no-store"});
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  const ab = await resp.arrayBuffer();

  // decode the audio data
  const audioBuffer = await audioCtx.decodeAudioData(ab);

  // stop any previous source
  if (currentSource) {
    try { currentSource.stop(0); } catch(e){}
    currentSource.disconnect();
    currentSource = null;
  }

  // create and play new source
  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(audioCtx.destination);
  src.start(0);
  currentSource = src;
  src.onended = () => { currentSource = null; console.log('AudioContext playback ended'); };

  console.log('Playing (fallback) ' + filename);
}
