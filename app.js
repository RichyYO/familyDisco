'use strict';
// SongScan: scan a card, count down, open the song in the phone's Spotify or YouTube Music app.
// The page never knows a title: deck files hold only IDs.
//
// Why a link and not the Spotify Web API: in Nov 2026 Web API /play to native Spotify apps is
// accepted (204) but not executed (github.com/encodi/sonora-mcp/issues/34; reproduced here on
// Android). Opening spotify:track:<id> starts the song by itself, with no sign-in.

// ---- Config ---------------------------------------------------------------
// Countdown is capped at 3 s: the song link opens the app only while the browser still counts
// the Play tap as recent. 3 s is confirmed on Android Firefox (2026-11-09); longer is untested.
const SECONDS_MIN = 1;
const SECONDS_MAX = 3;
const DEFAULTS = { seconds: 3, beeps: true, service: 'spotify' };

// Where a card's song opens. YouTube Music links autoplay (iPhone, 2026-11-08; Android untested).
const SERVICES = {
  spotify: { name: 'Spotify', link: (id) => 'spotify:track:' + id },
  youtube: { name: 'YouTube Music', link: (id) => 'https://music.youtube.com/watch?v=' + id },
};
const SETTINGS_KEY = 'songscan.settings';
// QR fallback for browsers without BarcodeDetector. Pinned + SRI; only loaded when needed.
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const JSQR_SRI = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';

const MSG = {
  notCard: 'Not a SongScan card.',
  notInDeck: 'Card not in this deck.',
  noSong: (service) => `This card has no ${SERVICES[service].name} song.`,
  offline: 'No connection: can\'t load the deck.',
  camera: 'Camera blocked. Allow the camera for this site, then reload.',
};

// ---- Small helpers --------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function show(id) {
  for (const s of document.querySelectorAll('body > section')) s.hidden = s.id !== id;
  if (id !== 'scan') stopScanner();
}

// ---- Settings (per phone, localStorage) -----------------------------------
// Storage can be missing or throw (private mode, blocked site data): fall back to defaults.
function loadSettings() {
  let saved = {};
  try { saved = JSON.parse(localStorage.getItem(SETTINGS_KEY)) ?? {}; } catch { /* use defaults */ }
  const s = { ...DEFAULTS };
  const n = Number(saved.seconds);
  if (Number.isInteger(n) && n >= SECONDS_MIN && n <= SECONDS_MAX) s.seconds = n;
  if (typeof saved.beeps === 'boolean') s.beeps = saved.beeps;
  if (SERVICES.hasOwnProperty(saved.service)) s.service = saved.service;
  return s;
}

function saveSettings() {
  try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings)); } catch { /* this session only */ }
}

let settings = loadSettings();

function openSettings() {
  show('settings');
  for (const r of document.querySelectorAll('#settings input[name="seconds"]')) r.checked = Number(r.value) === settings.seconds;
  for (const r of document.querySelectorAll('#settings input[name="beeps"]')) r.checked = (r.value === 'on') === settings.beeps;
  for (const r of document.querySelectorAll('#settings input[name="service"]')) r.checked = r.value === settings.service;
}

function showService() {
  $('#service-note').textContent = `Plays each card's song in the ${SERVICES[settings.service].name} app on this phone.`;
}

function onSettingChange(e) {
  const { name, value } = e.target;
  if (name === 'seconds') settings.seconds = Number(value);
  else if (name === 'beeps') settings.beeps = value === 'on';
  else if (name === 'service' && SERVICES.hasOwnProperty(value)) settings.service = value;
  else return;
  saveSettings();
  showService();
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

// Each start and stop bumps scanGen. A start whose generation is no longer current (the screen
// was left, or a newer start began, while it waited for the camera or the QR library) stops its
// own camera and exits, so only one camera stream and one scan loop ever exist.
let scanGen = 0;

async function startScanner() {
  show('scan');
  if (stream) return;
  const gen = ++scanGen;
  const video = $('#video');
  let s;
  try {
    s = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
  } catch {
    if (gen === scanGen) toast(MSG.camera, 0);
    return;
  }
  if (gen !== scanGen) { for (const t of s.getTracks()) t.stop(); return; }
  stream = s;
  video.srcObject = stream;
  try { await video.play(); } catch { /* autoplay of muted video is allowed; ignore */ }
  let detect;
  try { detect = await getDetector(); } catch (e) { if (gen === scanGen) toast(e.message, 0); return; }
  const tick = async () => {
    if (gen !== scanGen) return;
    if (!handling && video.readyState >= 2) {
      let text = null;
      try { text = await detect(video); } catch { /* bad frame */ }
      if (text && gen === scanGen) await onCode(text);
    }
    if (gen === scanGen) scanTimer = setTimeout(tick, 150);
  };
  tick();
}

function stopScanner() {
  scanGen++;
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
let current = null; // { deck, card, link }
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
    const id = card[settings.service];
    if (!id) return toast(MSG.noSong(settings.service));
    current = { ...code, link: SERVICES[settings.service].link(id) };
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
  for (let n = settings.seconds; n >= 1; n--) {
    $('#count').textContent = String(n);
    beep(n === 1 ? 880 : 660);
    await sleep(1000);
  }
}

let playing = false;
async function play() {
  if (playing || !current) return;
  playing = true;
  // Web Audio must start inside the tap. No beeps: no AudioContext at all.
  if (settings.beeps) { try { audio ??= new AudioContext(); audio.resume(); } catch { audio = null; } }
  try {
    await countdown();
    // Release the page's audio so the music app gets the speaker.
    if (audio) { try { await audio.close(); } catch { /* already closed */ } audio = null; }
    const link = current.link;
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
  $('#settings-btn').onclick = openSettings;
  $('#settings').onchange = onSettingChange;
  $('#settings-done').onclick = startScanner;
  showService();
  startScanner();
}

init();
