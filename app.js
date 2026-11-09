'use strict';
// SongScan: scan a card, count down, open the song in the phone's Spotify app.
// The page never knows a title: deck files hold only IDs.
//
// Why a link and not the Spotify Web API: in Nov 2026 Web API /play to native Spotify apps is
// accepted (204) but not executed (github.com/encodi/sonora-mcp/issues/34; reproduced here on
// Android). Opening spotify:track:<id> starts the song by itself, with no sign-in.

// ---- Config ---------------------------------------------------------------
const COUNTDOWN_SECONDS = 3;
// QR fallback for browsers without BarcodeDetector. Pinned + SRI; only loaded when needed.
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const JSQR_SRI = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';

const MSG = {
  notCard: 'Not a SongScan card.',
  notInDeck: 'Card not in this deck.',
  noSpotify: 'This card has no Spotify song.',
  offline: 'No connection: can\'t load the deck.',
  camera: 'Camera blocked. Allow the camera for this site, then reload.',
};

// ---- Small helpers --------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const songLink = (id) => 'spotify:track:' + id;

function show(id) {
  for (const s of document.querySelectorAll('body > section')) s.hidden = s.id !== id;
  if (id !== 'scan') stopScanner();
}

// ---- Deck lookup ----------------------------------------------------------
function parseCode(text) {
  const m = /^qs1:deck=([a-z0-9]+);card=(\d{4})$/.exec(String(text).trim());
  return m ? { deck: m[1], card: m[2] } : null;
}

const decks = new Map(); // cached for the session; failures are not cached
async function lookup({ deck, card }) {
  if (!decks.has(deck)) {
    let r;
    try { r = await fetch(`decks/${deck}.json`, { cache: 'no-cache' }); } catch { throw new Error(MSG.offline); }
    if (r.status === 404) throw new Error(`Unknown deck "${deck}".`);
    if (!r.ok) throw new Error(`Couldn't load the deck (${r.status}).`);
    decks.set(deck, await r.json());
  }
  return decks.get(deck).cards?.[card] ?? null;
}

// ---- QR scanning ----------------------------------------------------------
let stream = null;
let scanTimer = 0;
let detectorPromise = null;
let lastText = '';
let lastAt = 0;
let handling = false;

function loadScript(src, integrity) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src; s.integrity = integrity; s.crossOrigin = 'anonymous';
    s.onload = resolve; s.onerror = () => reject(new Error('Couldn\'t load the QR scanner. Check the connection.'));
    document.head.append(s);
  });
}

// Returns async (videoOrImageOrCanvas) => string | null.
function getDetector() {
  detectorPromise ??= (async () => {
    if ('BarcodeDetector' in window) {
      try {
        if ((await BarcodeDetector.getSupportedFormats()).includes('qr_code')) {
          const bd = new BarcodeDetector({ formats: ['qr_code'] });
          return async (src) => (await bd.detect(src))[0]?.rawValue ?? null;
        }
      } catch { /* fall through to jsQR */ }
    }
    await loadScript(JSQR_URL, JSQR_SRI);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    return async (src) => {
      const w = src.videoWidth || src.naturalWidth || src.width;
      const h = src.videoHeight || src.naturalHeight || src.height;
      if (!w || !h) return null;
      const k = Math.min(1, 720 / Math.max(w, h));
      canvas.width = Math.round(w * k); canvas.height = Math.round(h * k);
      ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
      const img = ctx.getImageData(0, 0, canvas.width, canvas.height);
      return window.jsQR(img.data, img.width, img.height, { inversionAttempts: 'dontInvert' })?.data ?? null;
    };
  })().catch((e) => { detectorPromise = null; throw e; });
  return detectorPromise;
}

async function startScanner() {
  show('scan');
  if (stream) return;
  const video = $('#video');
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    stream = null;
    toast(MSG.camera, 0);
    return;
  }
  if ($('#scan').hidden) { stopScanner(); return; } // left the screen while waiting for permission
  video.srcObject = stream;
  try { await video.play(); } catch { /* autoplay of muted video is allowed; ignore */ }
  let detect;
  try { detect = await getDetector(); } catch (e) { toast(e.message, 0); return; }
  const tick = async () => {
    if (!stream) return;
    if (!handling && video.readyState >= 2) {
      let text = null;
      try { text = await detect(video); } catch { /* bad frame */ }
      if (text) await onCode(text);
    }
    if (stream) scanTimer = setTimeout(tick, 150);
  };
  tick();
}

function stopScanner() {
  clearTimeout(scanTimer);
  if (stream) for (const t of stream.getTracks()) t.stop();
  stream = null;
  const video = $('#video');
  if (video) video.srcObject = null;
}

let toastTimer = 0;
function toast(msg, ms = 2500) {
  $('#toast').textContent = msg;
  clearTimeout(toastTimer);
  if (ms) toastTimer = setTimeout(() => { $('#toast').textContent = ''; }, ms);
}

// ---- Round ----------------------------------------------------------------
let current = null; // { deck, card, spotify }
let audio = null;

async function onCode(text) {
  if (text === lastText && Date.now() - lastAt < 3000) return; // same card still in view
  lastText = text; lastAt = Date.now();
  handling = true;
  try {
    const code = parseCode(text);
    if (!code) return toast(MSG.notCard);
    let card;
    try { card = await lookup(code); } catch (e) { return toast(e.message); }
    if (!card) return toast(MSG.notInDeck);
    if (!card.spotify) return toast(MSG.noSpotify);
    current = { ...code, spotify: card.spotify };
    $('#ready-card').textContent = `Card ${code.deck} · ${code.card}`;
    show('ready');
  } finally {
    handling = false;
  }
}

function beep(freq) {
  if (!audio) return;
  const t = audio.currentTime;
  const osc = audio.createOscillator();
  const gain = audio.createGain();
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.4, t + 0.01);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.18);
  osc.connect(gain).connect(audio.destination);
  osc.start(t); osc.stop(t + 0.2);
}

async function countdown() {
  show('countdown');
  for (let n = COUNTDOWN_SECONDS; n >= 1; n--) {
    $('#count').textContent = String(n);
    beep(n === 1 ? 880 : 660);
    await sleep(1000);
  }
}

let playing = false;
async function play() {
  if (playing || !current) return;
  playing = true;
  // Web Audio must start inside the tap.
  try { audio ??= new AudioContext(); audio.resume(); } catch { audio = null; }
  try {
    await countdown();
    // Release the page's audio so Spotify gets the speaker.
    if (audio) { try { await audio.close(); } catch { /* already closed */ } audio = null; }
    const link = songLink(current.spotify);
    $('#replay').href = link; // fallback if the browser won't open an app this long after the tap
    show('playing');
    location.href = link;
  } finally {
    playing = false;
  }
}

function nextCard() {
  current = null;
  startScanner();
}

// ---- Start ----------------------------------------------------------------
function init() {
  $('#play-btn').onclick = play;
  $('#cancel-btn').onclick = () => { current = null; startScanner(); };
  $('#next-btn').onclick = nextCard;
  startScanner();
}

init();
