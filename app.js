'use strict';
// SongScan Android page: scan a card, count down, tell the phone's Spotify app to play it.
// The page never knows a title: deck files hold only IDs.

// ---- Config ---------------------------------------------------------------
// Spotify app Client ID (developer.spotify.com/dashboard). Public by design with PKCE.
const SPOTIFY_CLIENT_ID = '13b34033ce7b4962841393ddfc2f3064';
const COUNTDOWN_SECONDS = 3;
// QR fallback for browsers without BarcodeDetector. Pinned + SRI; only loaded when needed.
const JSQR_URL = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.js';
const JSQR_SRI = 'sha384-b5Ya4Bq3qCyz39m2ISh+4DxjAIljdeFwK/BsXLuj9gugaNwAcj/ia15fxNZL9Nlx';

const REDIRECT_URI = location.origin + location.pathname.replace(/index\.html$/, '');
const SCOPES = 'user-read-playback-state user-modify-playback-state';
const MSG = {
  notCard: 'Not a SongScan card.',
  notInDeck: 'Card not in this deck.',
  noSpotify: 'This card has no Spotify song.',
  noDevice: 'Open Spotify, then come back.',
  offline: 'No connection — the song can\'t play.',
  signinAgain: 'Spotify sign-in expired. Sign in again.',
  camera: 'Camera blocked. Allow the camera for this site, then reload.',
  premium: 'Spotify Premium is needed to play songs.',
  setup: 'Setup needed: put your Spotify Client ID in app.js.',
};

// ---- Small helpers --------------------------------------------------------
const $ = (sel) => document.querySelector(sel);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const store = {
  get(k) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode: sign-in won't persist */ } },
  del(k) { try { localStorage.removeItem(k); } catch { /* ignore */ } },
};

// kind: 'signin' -> sign-in screen, 'nodevice' -> Open Spotify fallback, otherwise plain message.
class UserError extends Error {
  constructor(message, kind = 'message') { super(message); this.kind = kind; }
}
const offline = () => new UserError(MSG.offline, 'offline');

function show(id) {
  for (const s of document.querySelectorAll('body > section')) s.hidden = s.id !== id;
  if (id !== 'scan') stopScanner();
}

// ---- Spotify sign-in: Authorization Code with PKCE -----------------------
function b64url(buf) {
  return btoa(String.fromCharCode(...new Uint8Array(buf)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

async function startSignIn() {
  const verifier = b64url(crypto.getRandomValues(new Uint8Array(48)));
  const challenge = b64url(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)));
  const state = b64url(crypto.getRandomValues(new Uint8Array(16)));
  store.set('ss_verifier', verifier);
  store.set('ss_state', state);
  const q = new URLSearchParams({
    client_id: SPOTIFY_CLIENT_ID, response_type: 'code', redirect_uri: REDIRECT_URI,
    code_challenge_method: 'S256', code_challenge: challenge, scope: SCOPES, state,
  });
  location.assign('https://accounts.spotify.com/authorize?' + q);
}

async function finishSignIn(params) {
  history.replaceState(null, '', REDIRECT_URI);
  const ok = params.get('code') && params.get('state') === store.get('ss_state');
  const verifier = store.get('ss_verifier');
  store.del('ss_state');
  store.del('ss_verifier');
  if (!ok || !verifier) throw new UserError('Spotify sign-in didn\'t finish. Try again.', 'signin');
  await tokenRequest({
    grant_type: 'authorization_code', code: params.get('code'),
    redirect_uri: REDIRECT_URI, code_verifier: verifier,
  });
}

async function tokenRequest(fields) {
  let r;
  try {
    r = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: SPOTIFY_CLIENT_ID, ...fields }),
    });
  } catch { throw offline(); }
  if (r.status === 400 || r.status === 401) { signOut(); throw new UserError(MSG.signinAgain, 'signin'); }
  if (!r.ok) throw new UserError(`Spotify isn't answering (${r.status}). Try again.`);
  const t = await r.json();
  store.set('ss_access', t.access_token);
  if (t.refresh_token) store.set('ss_refresh', t.refresh_token);
  store.set('ss_expires', String(Date.now() + t.expires_in * 1000));
}

async function accessToken() {
  const token = store.get('ss_access');
  if (token && Date.now() < Number(store.get('ss_expires') || 0) - 60_000) return token;
  const refresh = store.get('ss_refresh');
  if (!refresh) throw new UserError('Sign in with Spotify first.', 'signin');
  await tokenRequest({ grant_type: 'refresh_token', refresh_token: refresh });
  return store.get('ss_access');
}

function signOut() {
  for (const k of ['ss_access', 'ss_refresh', 'ss_expires', 'ss_device']) store.del(k);
}

// ---- Spotify Web API ------------------------------------------------------
async function api(method, path, body, retried = false) {
  if (!navigator.onLine) throw offline();
  const token = await accessToken();
  let r;
  try {
    r = await fetch('https://api.spotify.com/v1' + path, {
      method,
      headers: { Authorization: 'Bearer ' + token, ...(body ? { 'Content-Type': 'application/json' } : {}) },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch { throw offline(); }
  if (r.status === 401 && !retried) { store.del('ss_access'); return api(method, path, body, true); }
  return r;
}

async function apiError(r) {
  let reason = '';
  try { reason = (await r.json()).error?.reason || ''; } catch { /* empty body */ }
  if (r.status === 401) { signOut(); return new UserError(MSG.signinAgain, 'signin'); }
  if (r.status === 404 || reason === 'NO_ACTIVE_DEVICE') return new UserError(MSG.noDevice, 'nodevice');
  if (r.status === 403 && reason === 'PREMIUM_REQUIRED') return new UserError(MSG.premium);
  if (r.status === 429) return new UserError('Spotify says slow down. Wait a few seconds, then try again.');
  return new UserError(`Spotify error ${r.status}${reason ? ' (' + reason + ')' : ''}. Try again.`);
}

// This phone's Spotify app, chosen before the countdown so a missing device fails early.
async function findPhone() {
  const r = await api('GET', '/me/player/devices');
  if (!r.ok) throw await apiError(r);
  const { devices = [] } = await r.json();
  const phones = devices.filter((d) => d.type === 'Smartphone' && !d.is_restricted);
  const remembered = store.get('ss_device');
  const pick = phones.find((d) => d.id === remembered) || phones.find((d) => d.is_active) || phones[0];
  if (!pick) throw new UserError(MSG.noDevice, 'nodevice');
  store.set('ss_device', pick.id);
  return pick.id;
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
    try { r = await fetch(`decks/${deck}.json`, { cache: 'no-cache' }); } catch { throw offline(); }
    if (r.status === 404) throw new UserError(`Unknown deck "${deck}".`);
    if (!r.ok) throw new UserError(`Couldn't load the deck (${r.status}).`);
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
    s.onload = resolve; s.onerror = () => reject(new UserError('Couldn\'t load the QR scanner. Check the connection.'));
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
  $('#play-btn').disabled = true;
  // Web Audio must start inside the tap.
  try { audio ??= new AudioContext(); audio.resume(); } catch { audio = null; }
  try {
    const deviceId = await findPhone();
    await countdown();
    const r = await api('PUT', `/me/player/play?device_id=${encodeURIComponent(deviceId)}`,
      { uris: ['spotify:track:' + current.spotify] });
    if (!r.ok) throw await apiError(r);
    show('playing');
  } catch (e) {
    handleError(e);
  } finally {
    playing = false;
    $('#play-btn').disabled = false;
  }
}

async function nextCard() {
  $('#next-btn').disabled = true;
  try { await api('PUT', '/me/player/pause'); } catch { /* already paused / offline: scan anyway */ }
  $('#next-btn').disabled = false;
  current = null;
  startScanner();
}

function handleError(e) {
  if (!(e instanceof UserError)) e = new UserError('Something went wrong: ' + (e?.message || e));
  if (e.kind === 'signin') {
    $('#signin-msg').textContent = e.message;
    show('signin');
    return;
  }
  $('#error-msg').textContent = e.message;
  $('#open-spotify').hidden = e.kind !== 'nodevice';
  $('#retry-btn').hidden = !current;
  show('error');
}

// ---- Start ----------------------------------------------------------------
async function init() {
  $('#signin-btn').onclick = () => startSignIn().catch(handleError);
  $('#signout-btn').onclick = () => { signOut(); $('#signin-msg').textContent = 'Signed out.'; show('signin'); };
  $('#play-btn').onclick = play;
  $('#cancel-btn').onclick = () => { current = null; startScanner(); };
  $('#next-btn').onclick = nextCard;
  $('#retry-btn').onclick = () => { show('ready'); play(); };
  $('#back-btn').onclick = () => { current = null; startScanner(); };

  if (!SPOTIFY_CLIENT_ID) {
    $('#signin-msg').textContent = MSG.setup;
    $('#signin-btn').disabled = true;
    show('signin');
    return;
  }
  const params = new URLSearchParams(location.search);
  if (params.has('code') || params.has('error')) {
    try { await finishSignIn(params); } catch (e) { handleError(e); return; }
  }
  if (!store.get('ss_refresh')) { show('signin'); return; }
  startScanner();
}

init();
