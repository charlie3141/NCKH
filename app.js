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

  startPolling();
});

// polling control
function startPolling() {
  if (isPolling) return;
  isPolling = true;
  const ms = parseInt(pollInput?.value || 1000, 10);
  pollTimer = setInterval(doPollOnce, ms);
  console.log('polling started', ms);
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
