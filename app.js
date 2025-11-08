/*********************************************************
 * Gangtay client JS
 * - SSE (Firebase RTDB stream) w/ fallback to polling
 * - Extract numeric index from free-text payloads
 * - Map orientation keywords to audio indexes
 *********************************************************/

/* ----------------- CONFIG ----------------- */
const AUDIO_BASE = '/audio/'; // folder where 0001.mp3 etc are served
const firebaseMessageUrl = document.querySelector('#firebaseUrl')?.value
  || 'https://gangtay-f1efe-default-rtdb.asia-southeast1.firebasedatabase.app/message.json';
const pollInput = document.querySelector('#pollMs');
const cooldownInput = document.querySelector('#cooldownMs');
const allowDuplicatesCheckbox = document.querySelector('#allowDuplicates');
const enableBtn = document.querySelector('#enableBtn'); // "Enable audio & Start polling" button

// orientation -> index mapping (change as you like)
const ORIENTATION_MAP = {
  'Up':   1,  // will play 0001.mp3
  'Down': 2,
  'Left': 3,
  'Right':4,
  'Forward':5,
  'Backward':6
};

/* ------------- runtime state -------------- */
let audio = null;
let audioCtx = null;
let currentSource = null;
let isPolling = false;
let pollTimer = null;
let lastPlayedIndex = null;
let lastPlayedAt = 0;
let isAudioUnlocked = false;

// SSE state
let sse = null;
let sseErrorCount = 0;
const SSE_MAX_ERRORS = 6;
const SSE_RETRY_MS = 1500;
const SSE_AUTO_RETRY_MS = 60_000;
let sseAutoRetryTimer = null;

/* --------------- helper utils -------------- */
function log(...args){ console.log(...args); }
function pad4(n){ return String(n).padStart(4,'0'); }
function audioUrlForFilename(filename){ return AUDIO_BASE + filename; }
function filenameForIndex(i){ return pad4(i) + '.mp3'; }

async function unlockAudioIfNeeded() {
  if (isAudioUnlocked) return;
  if (!audio) {
    audio = new Audio();
    audio.playsInline = true;
    audio.crossOrigin = "anonymous";
    audio.preload = 'auto';
  }
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();

  try {
    // attempt a muted play to unlock audio on mobile
    audio.muted = true;
    audio.src = AUDIO_BASE + '0000.mp3';
    await audio.play().catch(()=>{});
    audio.pause();
    audio.currentTime = 0;
    audio.muted = false;
    if (audioCtx.state === 'suspended') await audioCtx.resume();
    isAudioUnlocked = true;
    log('audio unlocked');
  } catch (e) {
    log('audio unlock attempt failed', e);
    try { if (audioCtx.state === 'suspended') await audioCtx.resume(); } catch(_) {}
  }
}

/* ----------------- enable button ------------- */
if (enableBtn) {
  enableBtn.addEventListener('click', async () => {
    await unlockAudioIfNeeded();
    startSseOrPolling();
  });
}

/* ------------ SSE + polling control ---------- */

function buildEventStreamUrl(url){
  try{
    const u = new URL(url);
    u.searchParams.set('print','event-stream');
    return u.toString();
  }catch(e){
    if (url.indexOf('?') === -1) return url + '?print=event-stream';
    return url + '&print=event-stream';
  }
}

function handleStreamData(rawData){
  if (!rawData) return;
  // Firebase stream packets usually are like {"path":"/","data":{...}}
  try {
    const pkt = (typeof rawData === 'string') ? JSON.parse(rawData) : rawData;
    const payload = (pkt && pkt.data !== undefined) ? pkt.data : pkt;
    if (!payload) return;

    // try to normalize different shapes: {index}, {file}, or {text: "..."} etc
    // If payload already is primitive string, use it
    if (typeof payload === 'string') {
      processFreeFormText(payload);
      return;
    }

    // If payload contains index or file, use them directly
    if (payload.index !== undefined || payload.file !== undefined) {
      const idx = payload.index;
      const filename = payload.file || (typeof idx !== 'undefined' ? filenameForIndex(idx) : null);
      handleMessage(idx, filename, payload);
      return;
    }

    // Some telemetry might be inside a "text" field
    if (typeof payload.text === 'string') {
      processFreeFormText(payload.text, payload);
      return;
    }

    // If payload contains nested text-like fields (e.g., msg), search those too
    for (const k of ['msg','message','payload']) {
      if (typeof payload[k] === 'string') { processFreeFormText(payload[k], payload); return; }
    }

    // otherwise ignore quietly
  } catch (e) {
    console.warn('SSE parse error', e, rawData);
  }
}

function processFreeFormText(text, rawPayload){
  if (!text || !text.trim()) return;
  // 1) try first number anywhere in the text
  const m = String(text).match(/(\d{1,4})/); // match up to 4 digit numbers
  if (m) {
    const n = parseInt(m[1],10);
    if (!isNaN(n)) {
      const f = filenameForIndex(n);
      handleMessage(n, f, rawPayload || text);
      return;
    }
  }

  // 2) try to find orientation keywords (case-insensitive)
  const up = /(?:\bUp\b|\bup\b)/;
  const down = /(?:\bDown\b|\bdown\b)/;
  const left = /(?:\bLeft\b|\bleft\b|\bLắc sang trái\b|\blac sang trai\b)/;
  const right = /(?:\bRight\b|\bright\b|\bLắc sang phải\b|\blac sang phai\b)/;
  const forward = /(?:\bForward\b|\bforward\b)/;
  const backward = /(?:\bBackward\b|\bbackward\b)/;

  if (up.test(text)) {
    const idx = ORIENTATION_MAP['Up'];
    handleMessage(idx, filenameForIndex(idx), rawPayload || text);
    return;
  }
  if (down.test(text)) {
    const idx = ORIENTATION_MAP['Down'];
    handleMessage(idx, filenameForIndex(idx), rawPayload || text);
    return;
  }
  if (left.test(text)) {
    const idx = ORIENTATION_MAP['Left'];
    handleMessage(idx, filenameForIndex(idx), rawPayload || text);
    return;
  }
  if (right.test(text)) {
    const idx = ORIENTATION_MAP['Right'];
    handleMessage(idx, filenameForIndex(idx), rawPayload || text);
    return;
  }
  if (forward.test(text)) {
    const idx = ORIENTATION_MAP['Forward'];
    handleMessage(idx, filenameForIndex(idx), rawPayload || text);
    return;
  }
  if (backward.test(text)) {
    const idx = ORIENTATION_MAP['Backward'];
    handleMessage(idx, filenameForIndex(idx), rawPayload || text);
    return;
  }

  // no actionable content found — ignore quietly
}

/* SSE lifecycle */

function startSseOrPolling(){
  // try SSE first
  startSse(firebaseMessageUrl);

  // fallback: if SSE doesn't open in 5s, start polling (keeps trying SSE later)
  setTimeout(() => {
    if (!sse || sse.readyState !== 1) {
      log('SSE did not connect quickly — starting polling fallback');
      if (!isPolling) startPolling();
    }
  }, 5000);
}

function startSse(rawUrl){
  if (sse) { log('SSE already running'); return; }
  if (sseAutoRetryTimer) { clearTimeout(sseAutoRetryTimer); sseAutoRetryTimer = null; }

  const streamUrl = buildEventStreamUrl(rawUrl || firebaseMessageUrl);
  log('starting SSE ->', streamUrl);

  try {
    sseErrorCount = 0;
    sse = new EventSource(streamUrl);

    sse.onopen = () => {
      sseErrorCount = 0;
      log('SSE opened, readyState=', sse.readyState);
      // connected: stop polling if it was running
      if (isPolling) stopPolling();
    };

    sse.addEventListener('put', ev => { if (ev && ev.data) { sseErrorCount=0; handleStreamData(ev.data); }});
    sse.addEventListener('patch', ev => { if (ev && ev.data) { sseErrorCount=0; handleStreamData(ev.data); }});
    sse.onmessage = (ev) => { if (ev && ev.data) { sseErrorCount=0; handleStreamData(ev.data); }};

    sse.onerror = (ev) => {
      sseErrorCount++;
      const state = sse ? sse.readyState : null;
      console.warn('SSE error #' + sseErrorCount + ' readyState=' + state, ev);
      if (state === EventSource.CLOSED || sseErrorCount >= SSE_MAX_ERRORS) {
        console.warn('SSE closed or too many errors — fallback to polling');
        stopSse();
        if (!isPolling) startPolling();
        // schedule an auto-retry while polling
        sseAutoRetryTimer = setTimeout(()=> {
          log('SSE auto-retry: attempting to reconnect');
          startSse(rawUrl);
        }, SSE_AUTO_RETRY_MS);
      } else {
        // transient: gentle reconnect
        console.warn('SSE transient issue — will try reconnect in', SSE_RETRY_MS, 'ms');
        try{ stopSse(); } catch(_) {}
        setTimeout(()=> startSse(rawUrl), SSE_RETRY_MS);
      }
    };

  } catch (e) {
    console.warn('Failed to create EventSource:', e);
    stopSse();
    if (!isPolling) startPolling();
    sseAutoRetryTimer = setTimeout(()=> startSse(rawUrl), SSE_AUTO_RETRY_MS);
  }
}

function stopSse(){
  if (sse) {
    try{ sse.close(); } catch(_) {}
    sse = null;
  }
  sseErrorCount = 0;
  if (sseAutoRetryTimer){ clearTimeout(sseAutoRetryTimer); sseAutoRetryTimer = null; }
}

/* ---------- Polling (fallback) ---------- */

function startPolling(){
  if (isPolling) return;
  isPolling = true;
  const ms = Math.max(100, parseInt(pollInput?.value || 800,10));
  pollTimer = setInterval(doPollOnce, ms);
  log('Polling started at', ms, 'ms');
  doPollOnce().catch(e=>{ log('initial poll failed', e); });
}

function stopPolling(){
  if (!isPolling) return;
  clearInterval(pollTimer);
  pollTimer = null;
  isPolling = false;
  log('Polling stopped');
}

async function doPollOnce(){
  try {
    const res = await fetch(firebaseMessageUrl, { cache: "no-store" });
    if (!res.ok) { log('poll fetch failed', res.status); return; }
    const body = await res.json();
    if (!body) return;
    // mirror SSE handling: accept index/file or free-text
    if (typeof body === 'string') {
      processFreeFormText(body, body);
      return;
    }
    if (body.index !== undefined || body.file !== undefined) {
      const idx = body.index;
      const filename = body.file || (typeof idx !== 'undefined' ? filenameForIndex(idx) : null);
      handleMessage(idx, filename, body);
      return;
    }
    if (typeof body.text === 'string') {
      processFreeFormText(body.text, body);
      return;
    }
    // sometimes the DB returns an object with nested fields --
    // try to detect message-like fields
    for (const k of ['message','msg','payload']) {
      if (typeof body[k] === 'string') { processFreeFormText(body[k], body); return; }
    }
    // else ignore quietly
  } catch (e) {
    console.warn('poll error', e);
  }
}

/* ---------- Playback & guards (kept from your logic) ---------- */

async function handleMessage(idx, filename, raw){
  // allow index undefined if filename exists
  if (typeof idx === 'undefined' && !filename) return;

  const now = Date.now();
  const cooldownMs = Math.max(50, parseInt(cooldownInput?.value || 2000,10));
  const allowDuplicates = allowDuplicatesCheckbox ? allowDuplicatesCheckbox.checked : true;

  if (!allowDuplicates && idx === lastPlayedIndex){
    log('duplicate blocked', idx);
    return;
  }
  if (now - lastPlayedAt < cooldownMs){
    log('blocked by cooldown', now - lastPlayedAt);
    return;
  }

  lastPlayedIndex = idx;
  lastPlayedAt = now;

  await stopPlayback();

  if (!filename && typeof idx !== 'undefined') filename = filenameForIndex(idx);
  if (!filename) return;

  await playViaAudioElement(filename);
}

async function stopPlayback(){
  try {
    if (audio && !audio.paused) { audio.pause(); audio.currentTime = 0; log('stopped HTMLAudioElement'); }
  } catch(_) {}
  try {
    if (currentSource) {
      try{ currentSource.stop(0); } catch(_) {}
      try{ currentSource.disconnect(); } catch(_) {}
      currentSource = null;
      log('stopped AudioContext source');
    }
  } catch(_) {}
}

async function playViaAudioElement(filename){
  const url = audioUrlForFilename(filename);
  if (!audio) { audio = new Audio(); audio.playsInline = true; }
  audio.src = url;
  try {
    if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    await audio.play();
    log('Played via HTMLAudio:', filename);
    return;
  } catch (err) {
    log('Element play blocked, fallback to decode+play', err);
    try { await playViaAudioContextFetch(url, filename); } catch(e){ console.error('fallback failed', e); }
  }
}

async function playViaAudioContextFetch(url, filename){
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === 'suspended') {
    try{ await audioCtx.resume(); } catch(e){ log('audioCtx resume failed', e); }
  }

  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error('fetch failed ' + resp.status);
  const ab = await resp.arrayBuffer();
  const audioBuffer = await audioCtx.decodeAudioData(ab);

  if (currentSource) {
    try{ currentSource.stop(0); } catch(_) {}
    try{ currentSource.disconnect(); } catch(_) {}
    currentSource = null;
  }

  const src = audioCtx.createBufferSource();
  src.buffer = audioBuffer;
  src.connect(audioCtx.destination);
  src.start(0);
  currentSource = src;
  src.onended = () => { currentSource = null; log('AudioContext playback ended'); };
  log('Playing (fallback) ' + filename);
}

/* -------------- cleanup on unload -------------- */
window.addEventListener('beforeunload', ()=>{
  try{ stopSse(); } catch(_) {}
  try{ stopPolling(); } catch(_) {}
});
