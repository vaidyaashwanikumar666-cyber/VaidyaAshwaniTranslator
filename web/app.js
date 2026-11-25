/* =====================================================================
   Vaidya Ashwani Live Call Translator  –  app.js
   - App-to-app Video / Voice call (WebRTC via PeerJS), Call ID = mobile number
   - Live speech recognition -> translation -> voice (TTS) in listener's language
   - Speaker Translator mode for WhatsApp / SIM calls on speaker
   - Har call ki audio recording + conversation PDF
   - Android app me: window.AndroidBridge (native speech, voice, file save)
   ===================================================================== */
'use strict';

const APP_NAME = 'Vaidya Ashwani Live Call Translator';
const ID_PREFIX = 'vaidya-ashwani-lct-';
// GitHub repo (yahi se web link aur APK download link bante hain)
const GH_OWNER = 'vaidyaashwanikumar666-cyber';
const GH_REPO = 'VaidyaAshwaniTranslator';
const WEB_URL = `https://${GH_OWNER}.github.io/${GH_REPO}/`;
const APK_URL = `https://github.com/${GH_OWNER}/${GH_REPO}/releases/latest/download/VaidyaAshwaniTranslator.apk`;
const $ = (id) => document.getElementById(id);
const NB = window.AndroidBridge || null;          // native Android bridge (app ke andar)

/* ------------------------- Storage helpers ------------------------- */
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) { /* ignore */ } },
};

const audioDB = {
  db: null,
  open() {
    if (this.db) return Promise.resolve(this.db);
    return new Promise((res, rej) => {
      const r = indexedDB.open('vaidya_lct', 1);
      r.onupgradeneeded = () => r.result.createObjectStore('audio');
      r.onsuccess = () => { this.db = r.result; res(this.db); };
      r.onerror = () => rej(r.error);
    });
  },
  async put(id, blob) {
    const db = await this.open();
    return new Promise((res, rej) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').put(blob, id); tx.oncomplete = res; tx.onerror = () => rej(tx.error); });
  },
  async get(id) {
    const db = await this.open();
    return new Promise((res, rej) => { const q = db.transaction('audio').objectStore('audio').get(id); q.onsuccess = () => res(q.result); q.onerror = () => rej(q.error); });
  },
  async del(id) {
    const db = await this.open();
    return new Promise((res) => { const tx = db.transaction('audio', 'readwrite'); tx.objectStore('audio').delete(id); tx.oncomplete = res; tx.onerror = res; });
  },
};

/* ------------------------- State ------------------------- */
const S = {
  profile: store.get('vat_profile', null),
  settings: Object.assign({ tts: true, record: true, onlineTTS: true, origVol: 15, rate: 100, turn: '', server: '' }, store.get('vat_settings', {})),
  peer: null, call: null, conn: null, pendingCall: null, pendingConn: null,
  localStream: null, remoteStream: null, video: true, facing: 'user',
  remote: null, session: null, recorder: null, recChunks: [], recMix: null,
  timerInt: null, lastSession: null, lastAudio: null, tab: 'scrHome',
};

/* ------------------------- UI helpers ------------------------- */
let toastT;
function toast(msg, ms = 3200) {
  const t = $('toast'); t.textContent = msg; t.classList.remove('hidden');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.add('hidden'), ms);
}
const TABS = ['scrHome', 'scrHistory', 'scrSettings'];
function show(scr) {
  ['scrSetup', 'scrHome', 'scrHistory', 'scrSettings', 'scrCall', 'scrSpeaker'].forEach(s => $(s).classList.toggle('hidden', s !== scr));
  const isTab = TABS.includes(scr);
  $('bottomNav').classList.toggle('hidden', !isTab);
  if (isTab) { S.tab = scr; document.querySelectorAll('#bottomNav button').forEach(b => b.classList.toggle('on', b.dataset.tab === scr)); }
  if (scr === 'scrHistory') renderHistory();
  window.scrollTo(0, 0);
}
function current() { return ['scrSetup', 'scrHome', 'scrHistory', 'scrSettings', 'scrCall', 'scrSpeaker'].find(s => !$(s).classList.contains('hidden')); }
function langName(id) { const l = LANG_BY_ID[id]; return l ? l.n : (id || '—'); }
function shortLang(id) { return langName(id).split(' – ')[0]; }
function digits(num) { return String(num || '').replace(/[^\d]/g, ''); }
function normNumber(num) {
  let d = digits(num);
  if (d.length === 10) d = '91' + d;
  if (d.length === 11 && d[0] === '0') d = '91' + d.slice(1);
  return d;
}
function peerIdFor(num) { return ID_PREFIX + normNumber(num); }
function fmtTime(ts) { return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' }); }
function fmtDate(ts) { return new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])); }
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function speechLocale(id) { return LANG_BY_ID[id]?.speech || id; }

/* ------------------------- Language picker (bottom sheet) ------------------------- */
let sheetTarget = null;
function setLangValue(targetId, value) {
  $(targetId).value = value;
  document.querySelectorAll(`.langBtn[data-target="${targetId}"] b`).forEach(b => { b.textContent = targetId === 'spkOtherLang' ? shortLang(value) : langName(value); });
  $(targetId).dispatchEvent(new Event('change'));
}
function openLangSheet(targetId) {
  sheetTarget = targetId;
  $('langSearch').value = '';
  renderLangList('');
  $('langSheet').classList.remove('hidden');
  setTimeout(() => { const s = $('langList').querySelector('.sel'); if (s) s.scrollIntoView({ block: 'center' }); }, 50);
}
function closeLangSheet() { $('langSheet').classList.add('hidden'); sheetTarget = null; }
function renderLangList(q) {
  q = q.trim().toLowerCase();
  const cur = sheetTarget ? $(sheetTarget).value : '';
  let html = '';
  LANG_GROUPS.forEach(g => {
    const items = g.list.filter(([t, n, s]) => !q || n.toLowerCase().includes(q) || s.toLowerCase().startsWith(q) || t.toLowerCase() === q);
    if (!items.length) return;
    html += `<div class="grp">${esc(g.label)}</div>`;
    html += items.map(([, n, s]) => `<button data-v="${s}" class="${s === cur ? 'sel' : ''}">${esc(n)}</button>`).join('');
  });
  $('langList').innerHTML = html || '<p class="muted center">Koi bhasha nahi mili</p>';
}

/* ------------------------- Translation ------------------------- */
const trCache = new Map();
async function translate(text, fromId, toId) {
  text = (text || '').trim();
  if (!text) return '';
  const from = LANG_BY_ID[fromId]?.t || 'auto';
  const to = LANG_BY_ID[toId]?.t || 'en';
  if (from === to) return text;
  const key = from + '|' + to + '|' + text;
  if (trCache.has(key)) return trCache.get(key);
  let out = '';
  const q = `sl=${encodeURIComponent(from)}&tl=${encodeURIComponent(to)}&q=${encodeURIComponent(text)}`;
  const google = async () => {
    const r = await fetch(`https://translate.googleapis.com/translate_a/single?client=gtx&dt=t&${q}`);
    if (!r.ok) throw new Error('gt ' + r.status);
    const j = await r.json();
    return (j[0] || []).map(x => x[0]).join('');
  };
  const google2 = async () => {
    const r = await fetch(`https://clients5.google.com/translate_a/t?client=dict-chrome-ex&${q}`);
    if (!r.ok) throw new Error('gt2 ' + r.status);
    const j = await r.json();
    const v = Array.isArray(j) ? j[0] : (j.sentences || []).map(s => s.trans).join('');
    return Array.isArray(v) ? v[0] : String(v || '');
  };
  try { out = await google(); }
  catch (e) {
    try { await new Promise(r => setTimeout(r, 700)); out = await google(); }
    catch (e1) { try { out = await google2(); } catch (e2) { out = ''; } }
  }
  if (!out) {   // aakhri fallback: MyMemory
    try {
      const f2 = from === 'auto' ? 'hi' : from.split('-')[0];
      const r = await fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${f2}|${to.split('-')[0]}`);
      const j = await r.json();
      out = j?.responseData?.translatedText || '';
    } catch (e2) { console.warn('translate failed', e2); }
  }
  if (!out) { toast('⚠️ Translation nahi ho paya (internet check karein)'); return text; }
  trCache.set(key, out);
  return out;
}

/* ------------------------- Native callbacks (Android) ------------------------- */
window.NativeSpeech = {
  onPartial(t) { Recog._interim(t); },
  onFinal(t) { Recog._final(t); },
  onEnd() { Recog._ended(); },
  onError(code, msg) { Recog._error(code, msg); },
  onSpeakDone(id) { TTS._nativeDone(id); },
};

/* ------------------------- Text to Speech ------------------------- */
const TTS = {
  queue: [], busy: false, enabled: true, audioEl: new Audio(), voices: [], _doneCb: null, _doneId: null,
  loadVoices() { this.voices = window.speechSynthesis ? speechSynthesis.getVoices() : []; },
  pickVoice(langId) {
    const sp = speechLocale(langId).toLowerCase();
    const base = sp.split('-')[0];
    const vs = this.voices;
    return vs.find(v => v.lang.toLowerCase().replace('_', '-') === sp)
      || vs.find(v => v.lang.toLowerCase().replace('_', '-').startsWith(base + '-'))
      || vs.find(v => v.lang.toLowerCase() === base) || null;
  },
  speak(text, langId) {
    if (!S.settings.tts || !this.enabled || !text) return;
    this.queue.push({ text, langId }); this.next();
  },
  next() {
    if (this.busy || !this.queue.length) return;
    const { text, langId } = this.queue.shift();
    this.busy = true; Recog.pauseForTTS(true);
    let finished = false;
    const done = () => { if (finished) return; finished = true; this.busy = false; this._doneCb = null; Recog.pauseForTTS(false); setTimeout(() => this.next(), 60); };
    const safety = setTimeout(done, 3000 + text.length * 250);
    const fin = () => { clearTimeout(safety); done(); };

    if (NB) {   // Android native TextToSpeech
      const id = uid();
      this._doneId = id; this._doneCb = fin;
      let ok = false;
      try { ok = NB.speak(text, speechLocale(langId), S.settings.rate / 100, id); } catch (e) { ok = false; }
      if (ok) return;
      this._doneCb = null;
    } else {
      const voice = this.pickVoice(langId);
      if (voice && window.speechSynthesis) {
        const u = new SpeechSynthesisUtterance(text);
        u.voice = voice; u.lang = voice.lang; u.rate = S.settings.rate / 100;
        u.onend = fin; u.onerror = fin;
        speechSynthesis.speak(u);
        return;
      }
    }
    if (S.settings.onlineTTS) this.online(text, langId).then(fin, fin);
    else fin();
  },
  _nativeDone(id) { if (this._doneCb && id === this._doneId) this._doneCb(); },
  async online(text, langId) {
    const tl = LANG_BY_ID[langId]?.t || 'hi';
    const parts = text.match(/[\s\S]{1,180}(\s|$|[.,!?।])/g) || [text];
    for (const p of parts) {
      await new Promise((res) => {
        const a = this.audioEl;
        a.src = `https://translate.google.com/translate_tts?ie=UTF-8&client=tw-ob&tl=${encodeURIComponent(tl)}&q=${encodeURIComponent(p.trim())}`;
        a.playbackRate = S.settings.rate / 100;
        a.onended = res; a.onerror = res;
        a.play().catch(res);
      });
    }
  },
  stop() {
    this.queue = []; this._doneCb = null;
    try { speechSynthesis.cancel(); } catch (e) { }
    try { NB && NB.stopSpeaking(); } catch (e) { }
    this.audioEl.pause(); this.busy = false;
  },
};
if (window.speechSynthesis) { TTS.loadVoices(); speechSynthesis.onvoiceschanged = () => TTS.loadVoices(); }

/* ------------------------- Speech Recognition ------------------------- */
const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
const Recog = {
  r: null, active: false, lang: 'hi-IN', onFinal: null, onInterim: null, paused: false, single: false, onStop: null,
  available() { return !!NB || !!SR; },
  start(langId, onFinal, onInterim, { single = false, onStop = null } = {}) {
    if (!this.available()) { toast('Is browser me voice recognition nahi hai. Chrome (Android) use karein ya type karein.'); return false; }
    this.stop();
    this.lang = langId; this.onFinal = onFinal; this.onInterim = onInterim; this.single = single; this.onStop = onStop;
    this.active = true; this.paused = false;
    if (NB) { this._go(); return true; }
    this._create(); this._go();
    return true;
  },
  _interim(t) { if (this.active && this.onInterim) this.onInterim(t || ''); },
  _final(t) { t = (t || '').trim(); if (this.active && t && this.onFinal) this.onFinal(t); },
  _ended() {
    if (this.onInterim) this.onInterim('');
    if (this.single) { if (this.active) { this.active = false; if (this.onStop) this.onStop(); } return; }
    if (this.active && !this.paused) setTimeout(() => { if (this.active && !this.paused) this._go(); }, 250);
  },
  _error(code, msg) {
    if (code === 'language-not-supported') {
      toast(`${shortLang(this.lang)} ki voice-pehchaan is phone me nahi hai – Hindi se try kar raha hoon, ya likh kar bhejein.`, 5000);
      this.lang = 'hi-IN';
    } else if (code === 'not-allowed') {
      toast('🎙️ Mic ki permission dein (Settings → Apps → Permissions).'); this.active = false;
    } else if (code === 'audio-capture') {
      toast('Mic busy hai – earphone lagayein ya likh kar bhejein.');
    } else if (msg) { console.warn('speech', code, msg); }
  },
  _create() {
    const r = new SR();
    r.continuous = !this.single; r.interimResults = true; r.maxAlternatives = 1;
    r.onresult = (ev) => {
      if (this.r !== r) return;
      let interim = '';
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const res = ev.results[i];
        if (res.isFinal) this._final(res[0].transcript);
        else interim += res[0].transcript;
      }
      this._interim(interim);
    };
    r.onerror = (e) => {
      if (this.r !== r) return;
      const map = { 'service-not-allowed': 'not-allowed' };
      this._error(map[e.error] || e.error, e.message);
    };
    r.onend = () => { if (this.r !== r) return; this._ended(); };
    this.r = r;
  },
  _go() {
    const loc = speechLocale(this.lang);
    if (NB) { try { NB.startListening(loc, !this.single); } catch (e) { console.warn(e); } return; }
    try { this.r.lang = loc; this.r.start(); } catch (e) { /* already started */ }
  },
  pauseForTTS(p) {
    if (!this.active) return;
    this.paused = p;
    if (p) {
      if (NB) { try { NB.stopListening(); } catch (e) { } }
      else if (this.r) { try { this.r.abort(); } catch (e) { } }
    } else setTimeout(() => { if (this.active && !this.paused) this._go(); }, 300);
  },
  stop() {
    this.active = false; this.paused = false;
    if (NB) { try { NB.stopListening(); } catch (e) { } }
    if (this.r) { try { this.r.abort(); } catch (e) { } }
    this.r = null;
  },
};

/* ------------------------- Peer / Network ------------------------- */
function iceServers() {
  const list = [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:global.stun.twilio.com:3478' },
  ];
  const t = (S.settings.turn || '').split('|');
  if (t[0] && t[0].startsWith('turn')) list.push({ urls: t[0].trim(), username: (t[1] || '').trim(), credential: (t[2] || '').trim() });
  return list;
}

let reconnectT;
function startPeer() {
  if (!window.Peer) { toast('Network library load nahi hui'); return; }
  if (S.peer && !S.peer.destroyed) S.peer.destroy();
  const opts = { config: { iceServers: iceServers() }, debug: 0 };
  const srv = (S.settings.server || '').trim();
  if (srv) {
    const m = srv.replace(/^https?:\/\//, '').match(/^([^:/]+)(?::(\d+))?(\/.*)?$/);
    if (m) Object.assign(opts, { host: m[1], port: +(m[2] || 443), path: m[3] || '/', secure: !/^(localhost|127\.)/.test(m[1]) });
  }
  const peer = new Peer(peerIdFor(S.profile.number), opts);
  S.peer = peer;
  setNet(false, 'Connecting…');
  peer.on('open', () => setNet(true));
  peer.on('disconnected', () => { setNet(false); clearTimeout(reconnectT); reconnectT = setTimeout(() => { if (!peer.destroyed) peer.reconnect(); }, 2000); });
  peer.on('close', () => setNet(false));
  peer.on('error', (err) => {
    console.warn('peer error', err.type, err);
    if (err.type === 'unavailable-id') { setNet(false, 'ID busy'); toast('Ye number kisi aur phone/tab me pehle se online hai. Wahan band karke app dobara kholein.', 6000); }
    else if (err.type === 'peer-unavailable') { toast('📵 Saamne wala abhi online nahi hai. Unse app kholne ko kahein.', 5000); if (S.session && !S.remoteStream) endCall(false); }
    else if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(err.type)) { setNet(false); clearTimeout(reconnectT); reconnectT = setTimeout(startPeer, 4000); }
  });
  peer.on('connection', (conn) => {
    if (S.conn && S.conn.open) { conn.on('open', () => { conn.send({ type: 'busy' }); setTimeout(() => conn.close(), 500); }); return; }
    S.pendingConn = conn;
    if (S.session) setupConn(conn);
  });
  peer.on('call', (call) => {
    if (S.call) { call.close(); return; }
    S.pendingCall = call;
    const m = call.metadata || {};
    const num = digits(call.peer.replace(ID_PREFIX, ''));
    $('inName').textContent = m.name || ('+' + num);
    $('inAvatar').textContent = (m.name || '?').trim().charAt(0).toUpperCase();
    $('inInfo').textContent = `${m.video ? '🎥 Video' : '📞 Voice'} call · ${shortLang(m.lang)} · +${num}`;
    $('modalIncoming').classList.remove('hidden');
    ringtone(true);
    try { NB && NB.notifyIncoming(m.name || ('+' + num)); } catch (e) { }
  });
}
function setNet(on, txt) { const p = $('netStatus'); p.querySelector('b').textContent = txt || (on ? 'Online' : 'Offline'); p.className = 'pill ' + (on ? 'on' : 'off'); }

let ringCtx, ringInt;
function ringtone(on) {
  clearInterval(ringInt);
  if (!on) { if (ringCtx) { ringCtx.close().catch(() => { }); ringCtx = null; } return; }
  try {
    ringCtx = new (window.AudioContext || window.webkitAudioContext)();
    const beep = () => {
      if (!ringCtx) return;
      const o = ringCtx.createOscillator(), g = ringCtx.createGain();
      o.frequency.value = 880; g.gain.value = 0.15; o.connect(g); g.connect(ringCtx.destination);
      o.start(); o.stop(ringCtx.currentTime + 0.4);
    };
    beep(); ringInt = setInterval(beep, 1200);
    if (navigator.vibrate) navigator.vibrate([400, 200, 400, 200, 400]);
  } catch (e) { }
}

async function getMedia(video) {
  const c = {
    audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
    video: video ? { facingMode: S.facing, width: { ideal: 640 }, height: { ideal: 480 } } : false,
  };
  try { return await navigator.mediaDevices.getUserMedia(c); }
  catch (e) {
    if (video) { toast('Camera nahi mila – sirf voice call'); return navigator.mediaDevices.getUserMedia({ audio: c.audio }); }
    throw e;
  }
}

/* ------------------------- Call flow ------------------------- */
async function startCall(video) {
  const num = $('callNumber').value.trim();
  if (normNumber(num).length < 8) { toast('Sahi number daalein (country code ke saath)'); $('callNumber').focus(); return; }
  if (!S.peer || S.peer.disconnected || S.peer.destroyed) { toast('Abhi server se jud raha hai… 2 second baad dobara dabayein'); startPeer(); return; }
  if (normNumber(num) === normNumber(S.profile.number)) { toast('Apne hi number par call nahi kar sakte 🙂'); return; }
  saveContact(num);
  try { S.localStream = await getMedia(video); }
  catch (e) { toast('🎙️ Mic/Camera ki permission chahiye'); return; }
  S.video = video && S.localStream.getVideoTracks().length > 0;
  const rid = peerIdFor(num);
  S.remote = { number: normNumber(num), name: '+' + normNumber(num), lang: null };
  beginSession('call');
  enterCallUI();
  $('remoteName').textContent = 'Ringing…';
  $('remoteLang').textContent = '+' + normNumber(num);
  const meta = { name: S.profile.name, number: normNumber(S.profile.number), lang: S.profile.lang, video: S.video };
  setupConn(S.peer.connect(rid, { metadata: meta, reliable: true, serialization: 'json' }));
  const call = S.peer.call(rid, S.localStream, { metadata: meta });
  if (!call) { toast('Call shuru nahi ho payi'); endCall(false); return; }
  setupCall(call);
  S.ringTimeout = setTimeout(() => { if (!S.remoteStream && S.session) { toast('Koi jawab nahi mila'); endCall(false); } }, 45000);
}

async function acceptCall() {
  ringtone(false);
  $('modalIncoming').classList.add('hidden');
  const call = S.pendingCall; S.pendingCall = null;
  if (!call) return;
  const m = call.metadata || {};
  try { S.localStream = await getMedia(!!m.video); }
  catch (e) { toast('🎙️ Mic/Camera ki permission chahiye'); call.close(); return; }
  S.video = !!m.video && S.localStream.getVideoTracks().length > 0;
  S.remote = { number: m.number || digits(call.peer.replace(ID_PREFIX, '')), name: m.name || '', lang: m.lang || null };
  beginSession('call');
  enterCallUI();
  updateRemoteUI();
  call.answer(S.localStream);
  setupCall(call);
  if (S.pendingConn) setupConn(S.pendingConn);
}
function rejectCall() {
  ringtone(false);
  $('modalIncoming').classList.add('hidden');
  const c = S.pendingConn;
  if (c) { const bye = () => { try { c.send({ type: 'reject' }); } catch (e) { } setTimeout(() => c.close(), 400); }; if (c.open) bye(); else c.on('open', bye); }
  if (S.pendingCall) S.pendingCall.close();
  S.pendingCall = null; S.pendingConn = null;
}

function setupCall(call) {
  S.call = call;
  call.on('stream', (stream) => {
    if (S.remoteStream) return;
    clearTimeout(S.ringTimeout);
    S.remoteStream = stream;
    const hasVideo = stream.getVideoTracks().length > 0 && S.video;
    const rv = $('remoteVideo');
    rv.srcObject = stream; rv.volume = S.settings.origVol / 100;
    rv.classList.toggle('hidden', !hasVideo);
    $('audioOnlyBadge').classList.toggle('hidden', hasVideo);
    if (!hasVideo) { $('remoteAudio').srcObject = stream; $('remoteAudio').volume = S.settings.origVol / 100; }
    rv.play().catch(() => { });
    updateRemoteUI();
    startTimer();
    startRecording([S.localStream, stream]);
    startMyRecognition();
  });
  call.on('close', () => { if (S.session) endCall(false); });
  call.on('error', () => { if (S.session) endCall(false); });
}

function setupConn(conn) {
  if (S.conn === conn) return;
  S.conn = conn; S.pendingConn = null;
  const hello = () => conn.send({ type: 'hello', name: S.profile.name, number: normNumber(S.profile.number), lang: S.profile.lang });
  if (conn.open) hello(); else conn.on('open', hello);
  conn.on('data', onData);
  conn.on('close', () => { if (S.session && S.session.type === 'call') endCall(false); });
}

async function onData(msg) {
  if (!msg || typeof msg !== 'object') return;
  switch (msg.type) {
    case 'hello':
      S.remote = Object.assign(S.remote || {}, { name: msg.name, number: msg.number, lang: msg.lang });
      if (S.session) S.session.them = { ...S.remote };
      if (S.remoteStream) updateRemoteUI();
      break;
    case 'interim':
      $('liveCaption').textContent = msg.text ? `${S.remote?.name || 'Saamne wala'}: ${msg.text}…` : '';
      break;
    case 'speech': {
      $('liveCaption').textContent = '';
      const translated = await translate(msg.text, msg.lang, S.profile.lang);
      addEntry({ id: msg.id, who: 'them', name: S.remote?.name, lang: msg.lang, text: msg.text, tlang: S.profile.lang, translated, ts: msg.ts || Date.now() });
      TTS.speak(translated, S.profile.lang);
      if (S.conn && S.conn.open) S.conn.send({ type: 'tr', id: msg.id, text: translated, lang: S.profile.lang });
      break;
    }
    case 'tr': {
      const e = S.session?.entries.find(x => x.id === msg.id);
      if (e) { e.translated = msg.text; e.tlang = msg.lang; renderEntry(e); }
      break;
    }
    case 'bye': endCall(false); break;
    case 'reject': toast('📵 Call kaat di gayi'); endCall(false); break;
    case 'busy': toast('Saamne wala doosri call par hai'); endCall(false); break;
  }
}

function startMyRecognition() {
  if (!$('btnMic').classList.contains('on')) return;
  Recog.start(S.profile.lang,
    (text) => sendMySpeech(text),
    (interim) => { if (S.conn && S.conn.open) S.conn.send({ type: 'interim', text: interim }); $('liveCaption').textContent = interim ? `Aap: ${interim}…` : ''; });
}
function sendMySpeech(text) {
  const id = uid(), ts = Date.now();
  addEntry({ id, who: 'me', name: S.profile.name, lang: S.profile.lang, text, tlang: S.remote?.lang, translated: '', ts });
  if (S.conn && S.conn.open) S.conn.send({ type: 'speech', id, text, lang: S.profile.lang, ts });
}

function updateRemoteUI() {
  const r = S.remote || {};
  $('remoteName').textContent = r.name || ('+' + (r.number || ''));
  $('remoteLang').textContent = r.lang ? shortLang(r.lang) : '—';
  $('remoteAvatar').textContent = (r.name || '?').replace('+', '').trim().charAt(0).toUpperCase() || '?';
}

function enterCallUI() {
  show('scrCall');
  try { NB && NB.setCallMode(true); } catch (e) { }
  $('callTranscript').innerHTML = ''; $('liveCaption').textContent = '';
  $('localVideo').srcObject = S.localStream;
  $('localVideo').classList.toggle('hidden', !S.video);
  $('btnCam').classList.toggle('hidden', !S.video);
  $('btnFlip').classList.toggle('hidden', !S.video);
  $('btnMic').classList.add('on'); $('btnCam').classList.add('on');
  $('btnVoiceOut').classList.toggle('on', TTS.enabled);
  $('remoteVideo').classList.add('hidden');
  $('audioOnlyBadge').classList.remove('hidden');
  $('remoteAvatar').textContent = (S.remote?.name || '?').replace('+', '').charAt(0).toUpperCase();
  $('callTimer').textContent = '00:00';
}

function startTimer() {
  const t0 = Date.now(); clearInterval(S.timerInt);
  S.timerInt = setInterval(() => {
    const s = Math.floor((Date.now() - t0) / 1000);
    $('callTimer').textContent = String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
  }, 1000);
}

async function endCall(notify = true) {
  if (!S.session || S.ending) return;
  S.ending = true;
  clearTimeout(S.ringTimeout);
  if (notify && S.conn && S.conn.open) { try { S.conn.send({ type: 'bye' }); } catch (e) { } }
  Recog.stop(); TTS.stop();
  clearInterval(S.timerInt);
  try { NB && NB.setCallMode(false); } catch (e) { }
  const audio = await stopRecording();
  const c = S.call, cn = S.conn;
  S.call = null; S.conn = null;
  setTimeout(() => { try { c && c.close(); } catch (e) { } try { cn && cn.close(); } catch (e) { } }, notify ? 300 : 0);
  if (S.localStream) S.localStream.getTracks().forEach(t => t.stop());
  S.localStream = null; S.remoteStream = null;
  $('remoteVideo').srcObject = null; $('localVideo').srcObject = null; $('remoteAudio').srcObject = null;
  show('scrHome');
  await finishSession(audio);
  S.ending = false;
}

/* ------------------------- Session / transcript ------------------------- */
function beginSession(type) {
  S.session = {
    id: uid(), type, startedAt: Date.now(), endedAt: null,
    me: { name: S.profile.name, number: normNumber(S.profile.number), lang: S.profile.lang },
    them: { ...(S.remote || {}) }, entries: [], hasAudio: false,
  };
}
function addEntry(e) { if (!S.session) return; S.session.entries.push(e); renderEntry(e); }
function renderEntry(e) {
  const box = S.session?.type === 'speaker' ? $('spkTranscript') : $('callTranscript');
  let el = box.querySelector(`[data-id="${e.id}"]`);
  if (!el) { el = document.createElement('div'); el.dataset.id = e.id; box.appendChild(el); }
  el.className = 'msg ' + e.who;
  const main = e.who === 'them' ? (e.translated || e.text) : e.text;
  const sub = e.who === 'them'
    ? (e.translated && e.translated !== e.text ? `${shortLang(e.lang)}: ${e.text}` : '')
    : (e.translated ? `${shortLang(e.tlang)}: ${e.translated}` : '…translate ho raha hai');
  const who = e.who === 'me' ? 'Aap' : (e.name || 'Saamne wala');
  el.innerHTML = `<div class="meta">${esc(who)} · ${fmtTime(e.ts)}</div><div>${esc(main)}</div>${sub ? `<div class="orig">${esc(sub)}</div>` : ''}`;
  box.scrollTop = box.scrollHeight;
}
async function finishSession(audio) {
  const s = S.session; S.session = null;
  if (!s) return;
  s.endedAt = Date.now();
  if (!s.them?.name && S.remote) s.them = { ...S.remote };
  if (audio) { s.hasAudio = true; try { await audioDB.put(s.id, audio); } catch (e) { console.warn(e); } }
  if (s.entries.length || audio) {
    const h = store.get('vat_history', []); h.unshift(s); store.set('vat_history', h.slice(0, 100));
  }
  S.lastSession = s; S.lastAudio = audio;
  renderHistory();
  if (!s.entries.length && !audio) return;
  const secs = Math.round((s.endedAt - s.startedAt) / 1000);
  $('sumInfo').textContent = `${s.them?.name || 'Call'} · ${s.entries.length} baatein · ${Math.floor(secs / 60)}m ${secs % 60}s`;
  $('btnSumAudio').classList.toggle('hidden', !audio);
  $('btnSumPdf').disabled = !s.entries.length;
  $('modalSummary').classList.remove('hidden');
}

/* ------------------------- Recording ------------------------- */
function startRecording(streams) {
  if (!S.settings.record || !window.MediaRecorder) return;
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const dest = ctx.createMediaStreamDestination();
    streams.forEach(st => { if (st && st.getAudioTracks().length) ctx.createMediaStreamSource(st).connect(dest); });
    const mime = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg'].find(m => MediaRecorder.isTypeSupported(m)) || '';
    const rec = new MediaRecorder(dest.stream, mime ? { mimeType: mime } : undefined);
    S.recChunks = [];
    rec.ondataavailable = (e) => { if (e.data && e.data.size) S.recChunks.push(e.data); };
    rec.start(1000);
    S.recorder = rec; S.recMix = ctx;
    $('recDot').classList.remove('hidden');
  } catch (e) { console.warn('record fail', e); }
}
function stopRecording() {
  $('recDot').classList.add('hidden');
  const rec = S.recorder; S.recorder = null;
  if (!rec) return Promise.resolve(null);
  return new Promise((res) => {
    rec.onstop = () => {
      const blob = S.recChunks.length ? new Blob(S.recChunks, { type: rec.mimeType || 'audio/webm' }) : null;
      S.recChunks = [];
      if (S.recMix) { S.recMix.close().catch(() => { }); S.recMix = null; }
      res(blob);
    };
    try { rec.stop(); } catch (e) { res(null); }
  });
}
function blobToBase64(blob) {
  return new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(',')[1]); r.onerror = rej; r.readAsDataURL(blob); });
}
async function saveBlob(blob, name) {
  if (NB) {   // Android: Downloads folder me save
    try {
      const b64 = await blobToBase64(blob);
      const msg = NB.saveFile(b64, name, blob.type || 'application/octet-stream');
      toast(msg || '✅ Download folder me save ho gaya', 4000);
    } catch (e) { toast('Save nahi ho paya'); }
    return;
  }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name;
  document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 2000);
}
function audioExt(blob) { return (blob.type || '').includes('mp4') ? 'm4a' : (blob.type || '').includes('ogg') ? 'ogg' : 'webm'; }
function fileBase(s) {
  const d = new Date(s.startedAt);
  const p = (n) => String(n).padStart(2, '0');
  const stamp = `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}_${p(d.getHours())}${p(d.getMinutes())}`;
  return `VaidyaAshwani_Call_${(s.them?.name || s.them?.number || 'conversation').replace(/[^\wऀ-ॿ]+/g, '_')}_${stamp}`;
}

/* ------------------------- PDF ------------------------- */
function buildPdfDoc(s) {
  const dur = Math.max(0, Math.round(((s.endedAt || Date.now()) - s.startedAt) / 1000));
  const rows = s.entries.map((e, i) => {
    const who = e.who === 'me' ? (s.me?.name || 'Main') : (e.name || s.them?.name || 'Saamne wala');
    return `<tr class="${e.who === 'me' ? 'who-me' : ''}"><td>${i + 1}</td><td>${fmtTime(e.ts)}</td><td><b>${esc(who)}</b><br><small>${esc(shortLang(e.lang))}</small></td>
      <td>${esc(e.text)}</td><td>${esc(e.translated || '')}<br><small>${e.tlang ? esc(shortLang(e.tlang)) : ''}</small></td></tr>`;
  }).join('');
  const typeTxt = s.type === 'speaker' ? 'Speaker Translator (WhatsApp / Phone call)' : 'Live Translated Call';
  return `<div class="pdfDoc">
    <h1>${APP_NAME}</h1>
    <div class="sub">Call Conversation Record · ${esc(typeTxt)}</div>
    <table style="margin-bottom:14px">
      <tr><th style="width:30%">Vivaran</th><th>Jaankari</th></tr>
      <tr><td>Tareekh / Samay</td><td>${fmtDate(s.startedAt)}</td></tr>
      <tr><td>Avadhi (Duration)</td><td>${Math.floor(dur / 60)} min ${dur % 60} sec</td></tr>
      <tr><td>Aap</td><td>${esc(s.me?.name)} ${s.me?.number ? '(+' + esc(s.me.number) + ')' : ''} – ${esc(langName(s.me?.lang))}</td></tr>
      <tr><td>Saamne wala</td><td>${esc(s.them?.name || '')} ${s.them?.number ? '(+' + esc(s.them.number) + ')' : ''} – ${esc(langName(s.them?.lang))}</td></tr>
      <tr><td>Audio recording</td><td>${s.hasAudio ? 'Haan – app ki History me saved' : 'Nahi'}</td></tr>
    </table>
    <table>
      <tr><th>#</th><th>Samay</th><th>Kaun bola</th><th>Asli baat (Original)</th><th>Translation</th></tr>
      ${rows || '<tr><td colspan="5">Koi baat record nahi hui</td></tr>'}
    </table>
    <div class="foot">Generated by ${APP_NAME} · ${fmtDate(Date.now())}</div>
  </div>`;
}
async function downloadPdf(s) {
  const holder = $('pdfHolder');
  holder.innerHTML = buildPdfDoc(s);
  const el = holder.firstElementChild;
  toast('📄 PDF ban raha hai…');
  try {
    if (!window.html2pdf) throw new Error('no html2pdf');
    const worker = html2pdf().set({
      margin: [8, 6, 8, 6], filename: fileBase(s) + '.pdf',
      image: { type: 'jpeg', quality: 0.95 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' },
    }).from(el);
    if (NB) { const blob = await worker.outputPdf('blob'); await saveBlob(new Blob([blob], { type: 'application/pdf' }), fileBase(s) + '.pdf'); }
    else { await worker.save(); toast('✅ PDF download ho gaya'); }
  } catch (e) {
    console.warn(e);
    const w = window.open('', '_blank');
    if (w) {
      w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${fileBase(s)}</title><link rel="stylesheet" href="${location.href.replace(/[^/]*$/, '')}style.css"></head><body style="background:#fff">${buildPdfDoc(s)}<script>setTimeout(()=>print(),600)<\/script></body></html>`);
      w.document.close();
    }
  } finally { holder.innerHTML = ''; }
}

/* ------------------------- History ------------------------- */
function renderHistory() {
  const h = store.get('vat_history', []);
  const box = $('historyList');
  if (!h.length) { box.innerHTML = '<div class="empty"><div class="big">📭</div><p>Abhi koi call record nahi hai.<br>Call karne ke baad yahan PDF aur recording milegi.</p></div>'; return; }
  box.innerHTML = h.map(s => `<div class="hItem" data-id="${s.id}">
      <div class="hTop"><div class="hIco">${s.type === 'speaker' ? '🔊' : '📞'}</div>
        <div><div class="t">${esc(s.them?.name || (s.them?.number ? '+' + s.them.number : 'Conversation'))}</div>
        <div class="muted tiny">${fmtDate(s.startedAt)} · ${esc(shortLang(s.me?.lang))} ⇄ ${esc(shortLang(s.them?.lang))} · ${s.entries.length} baatein</div></div></div>
      <div class="acts">
        <button data-act="pdf">📄 PDF</button>
        ${s.hasAudio ? '<button data-act="audio">🎧 Recording</button>' : ''}
        ${s.them?.number && s.type === 'call' ? '<button data-act="recall">📞 Call</button>' : ''}
        <button data-act="del">🗑️</button>
      </div></div>`).join('');
}
async function onHistoryClick(ev) {
  const b = ev.target.closest('button[data-act]'); if (!b) return;
  const id = b.closest('.hItem').dataset.id;
  const h = store.get('vat_history', []);
  const s = h.find(x => x.id === id); if (!s) return;
  if (b.dataset.act === 'pdf') downloadPdf(s);
  else if (b.dataset.act === 'audio') { const blob = await audioDB.get(id); if (blob) saveBlob(blob, fileBase(s) + '.' + audioExt(blob)); else toast('Recording nahi mili'); }
  else if (b.dataset.act === 'recall') { $('callNumber').value = '+' + s.them.number; show('scrHome'); toast('Ab Video ya Voice Call dabayein'); }
  else if (b.dataset.act === 'del') { if (confirm('Ye record delete karein?')) { store.set('vat_history', h.filter(x => x.id !== id)); audioDB.del(id); renderHistory(); } }
}

function saveContact(num) {
  const c = store.get('vat_contacts', []); const n = '+' + normNumber(num);
  const i = c.indexOf(n); if (i >= 0) c.splice(i, 1);
  c.unshift(n); store.set('vat_contacts', c.slice(0, 30));
  renderContacts();
}
function renderContacts() { $('contactsList').innerHTML = store.get('vat_contacts', []).map(n => `<option value="${esc(n)}">`).join(''); }

/* ------------------------- Speaker Translator mode ------------------------- */
const Spk = { side: null, stream: null };
async function openSpeakerMode() {
  S.remote = { name: 'Phone / WhatsApp call', number: normNumber($('callNumber').value) || '', lang: $('spkOtherLang').value };
  beginSession('speaker');
  $('spkTranscript').innerHTML = ''; $('spkCaption').textContent = '';
  updateSpkLabels();
  show('scrSpeaker');
  // Android app me mic native speech service use karti hai, isliye wahan recording nahi
  if (S.settings.record && !NB) {
    try { Spk.stream = await navigator.mediaDevices.getUserMedia({ audio: true }); startRecording([Spk.stream]); }
    catch (e) { toast('🎙️ Mic permission chahiye'); }
  }
}
function updateSpkLabels() {
  if (S.profile) $('spkMeLang').textContent = shortLang(S.profile.lang);
  if (S.session && S.session.type === 'speaker') S.session.them.lang = $('spkOtherLang').value;
}
function spkListen(side) {
  if (Spk.side === side && Recog.active) { Recog.stop(); spkMark(null); return; }
  const other = $('spkOtherLang').value;
  const fromL = side === 'me' ? S.profile.lang : other;
  const toL = side === 'me' ? other : S.profile.lang;
  spkMark(side);
  Recog.start(fromL, async (text) => {
    const e = { id: uid(), who: side, name: side === 'me' ? S.profile.name : 'Saamne wala', lang: fromL, text, tlang: toL, translated: '', ts: Date.now() };
    addEntry(e);
    e.translated = await translate(text, fromL, toL); renderEntry(e);
    TTS.speak(e.translated, toL);
  }, (interim) => { $('spkCaption').textContent = interim ? interim + '…' : ''; }, {
    single: true,
    onStop: () => {
      spkMark(null);
      if ($('spkAuto').checked && current() === 'scrSpeaker') {
        const nextSide = side === 'me' ? 'them' : 'me';
        const wait = () => { if (TTS.busy || TTS.queue.length) return setTimeout(wait, 300); setTimeout(() => { if (S.session?.type === 'speaker' && !Recog.active) spkListen(nextSide); }, 400); };
        setTimeout(wait, 600);
      }
    },
  });
}
function spkMark(side) {
  Spk.side = side;
  $('btnSpkMe').classList.toggle('listening', side === 'me');
  $('btnSpkThem').classList.toggle('listening', side === 'them');
}
async function closeSpeakerMode() {
  Recog.stop(); TTS.stop(); spkMark(null);
  const audio = await stopRecording();
  if (Spk.stream) { Spk.stream.getTracks().forEach(t => t.stop()); Spk.stream = null; }
  show('scrHome');
  await finishSession(audio);
}

/* ------------------------- Profile / settings ------------------------- */
function applyProfile() {
  $('meNumber').textContent = '+' + normNumber(S.profile.number);
  $('meLang').textContent = shortLang(S.profile.lang);
  $('meName').textContent = S.profile.name;
}
function saveSetup() {
  const name = $('setName').value.trim(), number = $('setNumber').value.trim(), lang = $('setLang').value;
  if (!name) { toast('Apna naam daalein'); return; }
  if (normNumber(number).length < 10) { toast('Pura mobile number daalein'); return; }
  const changedNum = !S.profile || normNumber(S.profile.number) !== normNumber(number);
  S.profile = { name, number: normNumber(number), lang };
  store.set('vat_profile', S.profile);
  applyProfile(); show('scrHome');
  if (changedNum || !S.peer || S.peer.destroyed) startPeer();
  try { if (NB) NB.requestPermissions(); else navigator.mediaDevices?.getUserMedia({ audio: true }).then(s => s.getTracks().forEach(t => t.stop())).catch(() => { }); } catch (e) { }
}
function bindSettings() {
  const st = S.settings;
  $('optTTS').checked = st.tts; $('optRecord').checked = st.record; $('optOnlineTTS').checked = st.onlineTTS;
  $('optOrigVol').value = st.origVol; $('optRate').value = st.rate; $('optTurn').value = st.turn; $('optServer').value = st.server;
  const save = () => {
    st.tts = $('optTTS').checked; st.record = $('optRecord').checked; st.onlineTTS = $('optOnlineTTS').checked;
    st.origVol = +$('optOrigVol').value; st.rate = +$('optRate').value;
    const netChanged = st.turn !== $('optTurn').value.trim() || st.server !== $('optServer').value.trim();
    st.turn = $('optTurn').value.trim(); st.server = $('optServer').value.trim();
    store.set('vat_settings', st);
    if (netChanged && S.profile && !S.session) startPeer();
  };
  ['optTTS', 'optRecord', 'optOnlineTTS', 'optOrigVol', 'optRate', 'optTurn', 'optServer'].forEach(id => $(id).addEventListener('change', save));
}
function shareText(text) {
  if (NB) { try { NB.shareText(text); return; } catch (e) { } }
  if (navigator.share) navigator.share({ title: APP_NAME, text }).catch(() => { });
  else { navigator.clipboard?.writeText(text); toast('Link copy ho gaya'); }
}
function openExternal(url) {
  if (NB) { try { NB.openExternal(url); return; } catch (e) { } }
  if (url.startsWith('tel:')) location.href = url; else window.open(url, '_blank');
}
function inviteText() {
  return `Namaste! Main ${S.profile?.name || ''} hoon. Hum dono apni-apni bhasha me baat kar sakein, iske liye "${APP_NAME}" app install karein:\n📲 Android app: ${APK_URL}\n🌐 Ya browser me kholein: ${WEB_URL}\nMujhe is number par call karein: +${normNumber(S.profile?.number)}`;
}

/* Android back button: 'handled' ya 'exit' lautata hai */
window.appBack = function () {
  if (!$('langSheet').classList.contains('hidden')) { closeLangSheet(); return 'handled'; }
  if (!$('modalSummary').classList.contains('hidden')) { $('modalSummary').classList.add('hidden'); return 'handled'; }
  if (!$('modalIncoming').classList.contains('hidden')) { rejectCall(); return 'handled'; }
  const c = current();
  if (c === 'scrCall') { if (confirm('Call band karein?')) endCall(true); return 'handled'; }
  if (c === 'scrSpeaker') { closeSpeakerMode(); return 'handled'; }
  if (c === 'scrHistory' || c === 'scrSettings') { show('scrHome'); return 'handled'; }
  if (c === 'scrSetup' && S.profile) { show('scrSettings'); return 'handled'; }
  return 'exit';
};

/* ------------------------- Events ------------------------- */
function bind() {
  document.querySelectorAll('#bottomNav button').forEach(b => b.onclick = () => show(b.dataset.tab));
  document.addEventListener('click', (e) => { const b = e.target.closest('.langBtn'); if (b) openLangSheet(b.dataset.target); });
  $('langList').addEventListener('click', (e) => { const b = e.target.closest('button[data-v]'); if (b && sheetTarget) { setLangValue(sheetTarget, b.dataset.v); closeLangSheet(); } });
  $('langSearch').addEventListener('input', () => renderLangList($('langSearch').value));
  document.querySelector('#langSheet .sheetBg').onclick = closeLangSheet;
  $('btnMyLang').onclick = () => openLangSheet('myLangQuick');
  $('myLangQuick').addEventListener('change', () => {
    S.profile.lang = $('myLangQuick').value; store.set('vat_profile', S.profile); applyProfile();
    toast('🗣️ Aapki bhasha: ' + langName(S.profile.lang));
  });

  $('btnSaveSetup').onclick = saveSetup;
  $('btnEditProfile').onclick = () => {
    $('setName').value = S.profile?.name || ''; $('setNumber').value = '+' + (S.profile?.number || '');
    setLangValue('setLang', S.profile?.lang || 'hi-IN'); show('scrSetup');
  };
  $('btnVideoCall').onclick = () => startCall(true);
  $('btnAudioCall').onclick = () => startCall(false);
  $('btnContacts').onclick = () => { const c = store.get('vat_contacts', []); if (!c.length) return toast('Abhi koi recent number nahi'); $('callNumber').value = c[0]; toast('Last number: ' + c[0]); };
  $('lnkInvite').onclick = (e) => { e.preventDefault(); shareText(inviteText()); };
  $('btnShareApp').onclick = () => shareText(inviteText());
  $('btnAccept').onclick = acceptCall;
  $('btnReject').onclick = rejectCall;
  $('btnEnd').onclick = () => endCall(true);
  $('btnMic').onclick = () => {
    const on = !$('btnMic').classList.contains('on');
    $('btnMic').classList.toggle('on', on);
    S.localStream?.getAudioTracks().forEach(t => t.enabled = on);
    if (on) startMyRecognition(); else Recog.stop();
  };
  $('btnCam').onclick = () => {
    const on = !$('btnCam').classList.contains('on');
    $('btnCam').classList.toggle('on', on);
    S.localStream?.getVideoTracks().forEach(t => t.enabled = on);
  };
  $('btnFlip').onclick = async () => {
    if (!S.localStream || !S.call) return;
    S.facing = S.facing === 'user' ? 'environment' : 'user';
    try {
      S.localStream.getVideoTracks().forEach(t => { t.stop(); S.localStream.removeTrack(t); });
      const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: S.facing } });
      const nt = ns.getVideoTracks()[0];
      const sender = S.call.peerConnection?.getSenders().find(s => s.track === null || (s.track && s.track.kind === 'video'));
      if (sender) await sender.replaceTrack(nt);
      S.localStream.addTrack(nt);
      $('localVideo').srcObject = S.localStream;
      $('localVideo').style.transform = S.facing === 'user' ? 'scaleX(-1)' : 'none';
    } catch (e) { toast('Camera palat nahi paya'); }
  };
  $('btnVoiceOut').onclick = () => {
    TTS.enabled = !TTS.enabled; $('btnVoiceOut').classList.toggle('on', TTS.enabled);
    if (!TTS.enabled) TTS.stop();
    toast(TTS.enabled ? '🔊 Translation voice ON' : '🔇 Sirf subtitles (voice OFF)');
  };
  $('typeForm').onsubmit = (e) => {
    e.preventDefault();
    const t = $('typeInput').value.trim(); if (!t) return;
    $('typeInput').value = '';
    if (S.session?.type === 'call') sendMySpeech(t);
  };
  $('btnWhatsApp').onclick = () => {
    const n = normNumber($('callNumber').value);
    if (n.length < 8) { toast('Upar saamne wale ka number daalein'); $('callNumber').focus(); return; }
    openExternal('https://wa.me/' + n);
    toast('WhatsApp call lagayein → speaker ON → wapas aakar Speaker Translator dabayein', 6000);
  };
  $('btnPhone').onclick = () => {
    const n = normNumber($('callNumber').value);
    if (n.length < 8) { toast('Upar saamne wale ka number daalein'); $('callNumber').focus(); return; }
    openExternal('tel:+' + n);
  };
  $('btnSpeakerMode').onclick = openSpeakerMode;
  $('btnSpkClose').onclick = closeSpeakerMode;
  $('btnSpkSave').onclick = closeSpeakerMode;
  $('btnSpkMe').onclick = () => spkListen('me');
  $('btnSpkThem').onclick = () => spkListen('them');
  $('spkOtherLang').addEventListener('change', () => { store.set('vat_spk_other', $('spkOtherLang').value); updateSpkLabels(); });
  $('btnSumClose').onclick = () => $('modalSummary').classList.add('hidden');
  $('btnSumPdf').onclick = () => S.lastSession && downloadPdf(S.lastSession);
  $('btnSumAudio').onclick = () => S.lastAudio && saveBlob(S.lastAudio, fileBase(S.lastSession) + '.' + audioExt(S.lastAudio));
  $('historyList').addEventListener('click', onHistoryClick);
  $('btnTestVoice').onclick = async () => {
    const l = S.profile?.lang || 'hi-IN';
    const t = await translate('Namaste, main Vaidya Ashwani Live Call Translator hoon.', 'hi-IN', l);
    TTS.enabled = true; TTS.speak(t, l);
  };
  $('optOrigVol').addEventListener('input', () => {
    const v = +$('optOrigVol').value / 100; $('remoteVideo').volume = v; $('remoteAudio').volume = v;
  });
  window.addEventListener('beforeunload', (e) => { if (S.session) { e.preventDefault(); e.returnValue = ''; } });
}

/* ------------------------- Init ------------------------- */
function init() {
  // hidden input for quick language change from home
  const q = document.createElement('input'); q.type = 'hidden'; q.id = 'myLangQuick'; document.body.appendChild(q);
  bind(); bindSettings(); renderHistory(); renderContacts();
  setLangValue('setLang', S.profile?.lang || 'hi-IN');
  setLangValue('spkOtherLang', store.get('vat_spk_other', 'en-US'));
  q.value = S.profile?.lang || 'hi-IN';
  try { if (NB) $('appVer').textContent = NB.appVersion(); } catch (e) { }
  if (!NB && /Android/i.test(navigator.userAgent)) { $('apkBanner').href = APK_URL; $('apkBanner').classList.remove('hidden'); }
  if (!S.profile) show('scrSetup');
  else { applyProfile(); show('scrHome'); startPeer(); }
  setTimeout(() => $('splash').classList.add('gone'), 1400);
  if (!Recog.available()) setTimeout(() => toast('ℹ️ Best result ke liye Android par app ya Google Chrome use karein', 5000), 2000);
  if (!NB && 'serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => { });
}
document.addEventListener('DOMContentLoaded', init);
