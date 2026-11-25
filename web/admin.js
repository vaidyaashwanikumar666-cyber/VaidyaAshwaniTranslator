/* =====================================================================
   Vaidya Ashwani Live Call Translator – Admin + Patients
   - Sirf Admin login ke baad "Patients" section dikhta hai
   - Password code me kabhi plain text me nahi: sirf SHA-256 hash
   - Patient data phone me AES-GCM se encrypted (key = admin password se bani)
   - Patient ke mobile number se hui call recordings apne aap jud jaati hain
   ===================================================================== */
'use strict';

const Admin = (() => {
  // Default admin (password: hash only). Password app ke andar se badla ja sakta hai.
  const DEFAULT_ADMIN = {
    name: 'Vaidya Ashwani Kumar',
    salt: 'vaidya-lct-admin-v1',
    hash: 'e0add96ba303fddd8488141a5bf55c8452ad4815573b9c829054dec15bd8b855',
  };
  const DATA_KEY = 'vat_patients_enc';
  // Password bhoolne par: sirf is recovery number par OTP (number code me nahi, sirf uska hash)
  const RECOVERY = { salt: 'vaidya-lct-recovery-v1', hash: 'af813aba02d77c287e7a8008bdb5373350c4e6e0f9e9a0dec9272c4ff418f654' };
  const DEK_PW = 'vat_dek_pw', DEK_REC = 'vat_dek_rec', REC_SECRET = 'vat_rec';
  const IDLE_MS = 30 * 60 * 1000;   // 30 minute kuch na karne par logout

  const A = { key: null, name: '', patients: [], current: null, linkPatientId: null, fails: 0, lockUntil: 0, idleT: null, editId: null };

  /* ---------------- crypto helpers ---------------- */
  const enc = new TextEncoder(), dec = new TextDecoder();
  const b64 = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf)));
  const unb64 = (s) => Uint8Array.from(atob(s), c => c.charCodeAt(0));
  async function sha256hex(str) {
    const d = await crypto.subtle.digest('SHA-256', enc.encode(str));
    return [...new Uint8Array(d)].map(b => b.toString(16).padStart(2, '0')).join('');
  }
  async function deriveKey(pw) {
    const base = await crypto.subtle.importKey('raw', enc.encode(pw), 'PBKDF2', false, ['deriveKey']);
    return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: enc.encode('vaidya-lct-patients-v1'), iterations: 150000, hash: 'SHA-256' },
      base, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  }
  async function encryptJSON(key, obj) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(JSON.stringify(obj)));
    return { v: 1, iv: b64(iv), ct: b64(ct) };
  }
  async function decryptJSON(key, rec) {
    const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, key, unb64(rec.ct));
    return JSON.parse(dec.decode(pt));
  }
  async function newDEK() { return crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']); }
  async function wrapDEK(kek, dek) {
    const raw = await crypto.subtle.exportKey('raw', dek);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    return { v: 1, iv: b64(iv), ct: b64(await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, kek, raw)) };
  }
  async function unwrapDEK(kek, rec) {
    const raw = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: unb64(rec.iv) }, kek, unb64(rec.ct));
    return crypto.subtle.importKey('raw', raw, 'AES-GCM', true, ['encrypt', 'decrypt']);
  }
  async function recoveryKEK() {
    let sec = store.get(REC_SECRET, null);
    if (!sec) { sec = b64(crypto.getRandomValues(new Uint8Array(32))); store.set(REC_SECRET, sec); }
    return crypto.subtle.importKey('raw', unb64(sec), 'AES-GCM', false, ['encrypt', 'decrypt']);
  }
  const normName = (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase();
  const adminCfg = () => store.get('vat_admin', null) || DEFAULT_ADMIN;

  /* ---------------- login / logout ---------------- */
  function isIn() { return !!A.key; }

  async function login(name, pw) {
    if (Date.now() < A.lockUntil) throw new Error(`Bahut galat koshish. ${Math.ceil((A.lockUntil - Date.now()) / 1000)} second baad try karein.`);
    const cfg = adminCfg();
    const ok = normName(name) === normName(cfg.name) && (await sha256hex(cfg.salt + ':' + pw)) === cfg.hash;
    if (!ok) {
      A.fails++;
      if (A.fails >= 5) { A.lockUntil = Date.now() + 30000; A.fails = 0; }
      throw new Error('Admin name ya password galat hai');
    }
    A.fails = 0;
    const kek = await deriveKey(pw);
    const raw = store.get(DATA_KEY, null);
    let dek, list = [];
    const wp = store.get(DEK_PW, null);
    if (wp) {
      try { dek = await unwrapDEK(kek, wp); } catch (e) { throw new Error('Patient data ki chaabi nahi khuli'); }
      if (raw) { try { list = await decryptJSON(dek, raw); } catch (e) { throw new Error('Patient data khul nahi paya'); } }
    } else {
      // purana tareeka (data seedha password se encrypted) → naye "data key" tareeke par
      if (raw) { try { list = await decryptJSON(kek, raw); } catch (e) { throw new Error('Patient data khul nahi paya (password badla gaya tha?)'); } }
      dek = await newDEK();
      store.set(DEK_PW, await wrapDEK(kek, dek));
      store.set(DATA_KEY, await encryptJSON(dek, list));
    }
    if (!store.get(DEK_REC, null)) store.set(DEK_REC, await wrapDEK(await recoveryKEK(), dek));
    A.key = dek; A.name = cfg.name; A.patients = Array.isArray(list) ? list : [];
    onLoginChange();
    bumpIdle();
    toast('🔓 Admin login: ' + cfg.name);
  }

  function logout(msg) {
    A.key = null; A.patients = []; A.current = null; A.linkPatientId = null;
    clearTimeout(A.idleT);
    onLoginChange();
    if (['scrPatients', 'scrPatient'].includes(current())) show('scrSettings');
    toast(msg || '🔒 Admin logout ho gaya');
  }

  function bumpIdle() {
    if (!isIn()) return;
    clearTimeout(A.idleT);
    A.idleT = setTimeout(() => { if (!S.session) logout('🔒 30 minute kuch na karne par Admin logout ho gaya'); else bumpIdle(); }, IDLE_MS);
  }

  async function changePassword(oldPw, newPw) {
    const cfg = adminCfg();
    if ((await sha256hex(cfg.salt + ':' + oldPw)) !== cfg.hash) throw new Error('Purana password galat hai');
    if (newPw.length < 8 || !/[A-Za-z]/.test(newPw) || !/\d/.test(newPw)) throw new Error('Naya password kam se kam 8 akshar ka ho, jisme letter aur number dono hon');
    await setNewPassword(newPw, A.key);
  }
  function checkStrength(pw) {
    if (pw.length < 8 || !/[A-Za-z]/.test(pw) || !/\d/.test(pw)) throw new Error('Naya password kam se kam 8 akshar ka ho, jisme letter aur number dono hon');
  }
  /** Naya password set: sirf data-key ka taala badalta hai, data wahi rehta hai */
  async function setNewPassword(newPw, dek) {
    checkStrength(newPw);
    const cfg = adminCfg();
    const salt = 'vaidya-lct-admin-' + Math.random().toString(36).slice(2, 10);
    if (dek) store.set(DEK_PW, await wrapDEK(await deriveKey(newPw), dek));
    else if (store.get(DATA_KEY, null)) throw new Error('Patient data ki chaabi nahi mili');
    store.set('vat_admin', { name: cfg.name, salt, hash: await sha256hex(salt + ':' + newPw) });
  }

  /* ---------------- Password bhool gaye: OTP (Firebase Phone Auth) ---------------- */
  const OTP = { phone: '', confirm: null, ok: false, verifier: null, fbP: null };
  function loadScript(src) {
    return new Promise((res, rej) => { const sc = document.createElement('script'); sc.src = src; sc.onload = res; sc.onerror = () => rej(new Error('load ' + src)); document.head.appendChild(sc); });
  }
  function loadFirebase() {
    if (!window.FIREBASE_CONFIG) return Promise.reject(new Error('NO_CONFIG'));
    if (!OTP.fbP) OTP.fbP = (async () => {
      if (!window.firebase) { await loadScript('lib/firebase/firebase-app-compat.js'); await loadScript('lib/firebase/firebase-auth-compat.js'); }
      if (!firebase.apps.length) firebase.initializeApp(window.FIREBASE_CONFIG);
      const auth = firebase.auth(); auth.languageCode = 'hi';
      return auth;
    })().catch(e => { OTP.fbP = null; throw e; });
    return OTP.fbP;
  }
  function otpError(e) {
    const c = e && (e.code || e.message) || '';
    if (c === 'NO_CONFIG') return 'OTP service abhi set nahi hai (Firebase config nahi daala gaya). App banane wale se Firebase set karwayein.';
    if (c.includes('invalid-verification-code')) return 'OTP galat hai. Dobara dekh kar daalein.';
    if (c.includes('code-expired')) return 'OTP ka samay khatam ho gaya. Naya OTP mangwayein.';
    if (c.includes('too-many-requests') || c.includes('quota')) return 'Bahut zyada koshish ho gayi. Thodi der baad try karein.';
    if (c.includes('unauthorized-domain') || c.includes('captcha-check-failed')) return 'Is app ka domain Firebase me authorized nahi hai (Authentication → Settings → Authorized domains).';
    if (c.includes('operation-not-allowed')) return 'Firebase me Phone sign-in chalu nahi hai (Authentication → Sign-in method → Phone).';
    if (c.includes('billing')) return 'Firebase project me billing (Blaze plan) chalu karni hogi.';
    if (c.includes('network')) return 'Internet check karein.';
    return 'OTP nahi bhej/verify kar paye: ' + c;
  }
  function fgStep(n) {
    ['fgStep1', 'fgStep2', 'fgStep3'].forEach((id, i) => $(id).classList.toggle('hidden', i + 1 !== n));
    $('fgErr').textContent = '';
  }
  function openForgot() {
    OTP.phone = ''; OTP.confirm = null; OTP.ok = false;
    $('fgPhone').value = ''; $('fgOtp').value = ''; $('fgNew').value = ''; $('fgNew2').value = '';
    fgStep(1);
    $('modalLogin').classList.add('hidden');
    $('modalForgot').classList.remove('hidden');
  }
  async function sendOtp() {
    $('fgErr').textContent = '';
    const phone = '+' + normNumber($('fgPhone').value);
    if ((await sha256hex(RECOVERY.salt + ':' + phone)) !== RECOVERY.hash) { $('fgErr').textContent = '⚠️ Ye Admin ka recovery number nahi hai. OTP sirf registered number par hi jaata hai.'; return; }
    $('btnFgSend').disabled = true; $('btnFgSend').textContent = 'OTP bhej rahe hain…';
    try {
      const auth = await loadFirebase();
      if (!OTP.verifier) OTP.verifier = new firebase.auth.RecaptchaVerifier('recaptchaBox', { size: 'invisible' });
      OTP.confirm = await auth.signInWithPhoneNumber(phone, OTP.verifier);
      OTP.phone = phone;
      $('fgSentTo').textContent = phone.slice(0, 5) + '●●●●●' + phone.slice(-3);
      fgStep(2); setTimeout(() => $('fgOtp').focus(), 50);
      toast('📩 OTP bhej diya gaya');
    } catch (e) {
      console.warn(e); $('fgErr').textContent = '⚠️ ' + otpError(e);
      try { OTP.verifier && OTP.verifier.clear(); } catch (x) { } OTP.verifier = null; $('recaptchaBox').innerHTML = '';
    } finally { $('btnFgSend').disabled = false; $('btnFgSend').textContent = '📩 OTP bhejein'; }
  }
  async function verifyOtp() {
    const code = $('fgOtp').value.replace(/\D/g, '');
    if (code.length < 6) { $('fgErr').textContent = '⚠️ 6 ankon ka OTP daalein'; return; }
    $('btnFgVerify').disabled = true;
    try {
      const cred = await OTP.confirm.confirm(code);
      if (!cred.user || cred.user.phoneNumber !== OTP.phone) throw new Error('Number match nahi hua');
      OTP.ok = true;
      try { await firebase.auth().signOut(); } catch (e) { }
      fgStep(3); setTimeout(() => $('fgNew').focus(), 50);
    } catch (e) { $('fgErr').textContent = '⚠️ ' + otpError(e); }
    finally { $('btnFgVerify').disabled = false; }
  }
  async function resetPassword() {
    if (!OTP.ok) { fgStep(1); return; }
    const pw = $('fgNew').value;
    if (pw !== $('fgNew2').value) { $('fgErr').textContent = '⚠️ Naya password dono jagah same nahi hai'; return; }
    try {
      checkStrength(pw);
      let dek = null;
      const rec = store.get(DEK_REC, null);
      if (rec) dek = await unwrapDEK(await recoveryKEK(), rec);
      await setNewPassword(pw, dek);
      OTP.ok = false;
      $('modalForgot').classList.add('hidden');
      await login(adminCfg().name, pw);
      show('scrPatients');
      toast('✅ Naya password set ho gaya, aap login hain');
    } catch (e) { $('fgErr').textContent = '⚠️ ' + (e.message || e); }
  }

  function onLoginChange() {
    const on = isIn();
    $('navPatients').classList.toggle('hidden', !on);
    $('bottomNav').classList.toggle('four', on);
    $('btnAdmin').querySelector('span').textContent = on ? `🔓 Admin: ${A.name} (Logout)` : '🔐 Admin Login';
    $('btnAdminPw').classList.toggle('hidden', !on);
    if (on) renderList();
  }

  /* ---------------- patients data ---------------- */
  async function save() {
    if (!A.key) return;
    store.set(DATA_KEY, await encryptJSON(A.key, A.patients));
  }
  const byId = (id) => A.patients.find(p => p.id === id);

  function sessionsFor(p) {
    const num = normNumber(p.mobile);
    return store.get('vat_history', []).filter(s =>
      s.patientId === p.id || (!s.patientId && num.length >= 10 && s.them?.number && normNumber(s.them.number) === num));
  }

  function setSessionPatient(sessionId, patientId) {
    const h = store.get('vat_history', []);
    const s = h.find(x => x.id === sessionId);
    if (s) { s.patientId = patientId || undefined; store.set('vat_history', h); }
  }

  /** app.js se: har call/speaker session khatam hone par */
  function onSessionFinished(s) {
    if (s.patientId) return;
    if (A.linkPatientId && s.type === 'call' && !s.them?.number) s.patientId = A.linkPatientId;   // link se judi call
    else if (A.spkPatientId && s.type === 'speaker') s.patientId = A.spkPatientId;
    A.spkPatientId = null;
  }

  /* ---------------- UI: list ---------------- */
  function renderList() {
    if (!isIn()) return;
    const q = normName($('patSearch').value);
    const list = A.patients
      .filter(p => !q || normName(p.name).includes(q) || digits(p.mobile).includes(q.replace(/\D/g, '') || '§') || normName(p.assignedBy).includes(q) || normName(p.address).includes(q))
      .sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
    $('patCount').textContent = `${A.patients.length} patients`;
    if (!list.length) {
      $('patList').innerHTML = `<div class="empty"><div class="big">🩺</div><p>${A.patients.length ? 'Koi patient nahi mila' : 'Abhi koi patient nahi hai.<br>"➕ Naya Patient" dabakar jodein.'}</p></div>`;
      return;
    }
    $('patList').innerHTML = list.map(p => {
      const n = sessionsFor(p).length;
      return `<button class="patCard" data-id="${p.id}">
        <div class="patAv">${esc((p.name || '?').trim().charAt(0).toUpperCase())}</div>
        <div class="patInfo"><b>${esc(p.name)}</b>
          <small>📱 +${esc(normNumber(p.mobile))}${p.assignedBy ? ' · 👤 ' + esc(p.assignedBy) : ''}</small>
          ${p.address ? `<small>📍 ${esc(p.address)}</small>` : ''}</div>
        <div class="patRec">${n ? `🎧 ${n}` : ''}</div></button>`;
    }).join('');
  }

  /* ---------------- UI: form ---------------- */
  function openForm(p) {
    A.editId = p ? p.id : null;
    $('pfTitle').textContent = p ? '✏️ Patient badlein' : '➕ Naya Patient';
    $('pfName').value = p?.name || '';
    $('pfMobile').value = p ? '+' + normNumber(p.mobile) : '';
    $('pfAddress').value = p?.address || '';
    $('pfAssigned').value = p?.assignedBy || A.name;
    $('pfNotes').value = p?.notes || '';
    $('assignedList').innerHTML = [...new Set([A.name, ...A.patients.map(x => x.assignedBy).filter(Boolean)])].map(n => `<option value="${esc(n)}">`).join('');
    $('modalPatient').classList.remove('hidden');
    setTimeout(() => $('pfName').focus(), 50);
  }
  async function submitForm() {
    const name = $('pfName').value.trim(), mobile = normNumber($('pfMobile').value);
    if (!name) return toast('Patient ka naam daalein');
    if (mobile.length < 10) return toast('Patient ka pura mobile number daalein');
    const dup = A.patients.find(p => normNumber(p.mobile) === mobile && p.id !== A.editId);
    if (dup && !confirm(`Is number se pehle se patient hai: ${dup.name}. Fir bhi save karein?`)) return;
    const now = Date.now();
    let p = A.editId ? byId(A.editId) : null;
    if (!p) { p = { id: uid(), createdAt: now, createdBy: A.name }; A.patients.push(p); }
    Object.assign(p, { name, mobile, address: $('pfAddress').value.trim(), assignedBy: $('pfAssigned').value.trim(), notes: $('pfNotes').value.trim(), updatedAt: now });
    await save();
    $('modalPatient').classList.add('hidden');
    renderList();
    openDetail(p.id);
    toast('✅ Patient save ho gaya');
  }

  /* ---------------- UI: detail ---------------- */
  function openDetail(id) {
    const p = byId(id); if (!p) return;
    A.current = id;
    $('pdAvatar').textContent = (p.name || '?').trim().charAt(0).toUpperCase();
    $('pdName').textContent = p.name;
    $('pdMobile').textContent = '+' + normNumber(p.mobile);
    $('pdInfo').innerHTML = `
      <div><span>📱 Mobile</span><b>+${esc(normNumber(p.mobile))}</b></div>
      <div><span>📍 Pata</span><b>${esc(p.address || '—')}</b></div>
      <div><span>👤 Assign kiya</span><b>${esc(p.assignedBy || '—')}</b></div>
      <div><span>🗓️ Joda gaya</span><b>${fmtDate(p.createdAt)}${p.createdBy ? ' · ' + esc(p.createdBy) : ''}</b></div>
      ${p.notes ? `<div><span>📝 Notes</span><b>${esc(p.notes)}</b></div>` : ''}`;
    renderRecordings();
    show('scrPatient');
  }

  async function renderRecordings() {
    const p = byId(A.current); if (!p) return;
    const list = sessionsFor(p);
    $('pdRecCount').textContent = list.length ? `(${list.length})` : '';
    if (!list.length) { $('pdRecs').innerHTML = '<p class="muted small center">Abhi koi call recording nahi.<br>Upar se call karein, ya purani call jodein.</p>'; return; }
    $('pdRecs').innerHTML = list.map(s => {
      const secs = Math.max(0, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 1000));
      const manual = s.patientId === p.id;
      return `<div class="recItem" data-sid="${s.id}">
        <div class="recTop"><span>${s.type === 'speaker' ? '🔊' : (s.video ? '🎥' : '📞')}</span>
          <div><b>${fmtDate(s.startedAt)}</b><small>${Math.floor(secs / 60)}m ${secs % 60}s · ${esc(shortLang(s.me?.lang))} ⇄ ${esc(shortLang(s.them?.lang))} · ${s.entries.length} baatein</small></div></div>
        ${s.hasAudio ? `<audio controls preload="none" data-sid="${s.id}"></audio>` : '<small class="muted">Is call ki audio recording nahi hai</small>'}
        <div class="acts">
          <button data-act="pdf">📄 PDF</button>
          ${s.hasAudio ? '<button data-act="dl">⬇️ Recording</button>' : ''}
          ${manual ? '<button data-act="unlink">✖ Hatayein</button>' : ''}
        </div></div>`;
    }).join('');
    // audio lazily: jab play dabayein tab load ho
    $('pdRecs').querySelectorAll('audio').forEach(a => {
      a.addEventListener('play', async function once() {
        if (a.dataset.loaded) return;
        const blob = await audioDB.get(a.dataset.sid);
        if (!blob) { toast('Recording nahi mili'); return; }
        a.dataset.loaded = '1'; a.src = URL.createObjectURL(blob); a.play().catch(() => { });
      });
    });
  }

  async function onRecClick(ev) {
    const b = ev.target.closest('button[data-act]'); if (!b) return;
    const sid = b.closest('.recItem').dataset.sid;
    const s = store.get('vat_history', []).find(x => x.id === sid); if (!s) return;
    const p = byId(A.current);
    if (b.dataset.act === 'pdf') downloadPdf(Object.assign({}, s, { them: Object.assign({}, s.them, { name: p?.name || s.them?.name, number: s.them?.number || p?.mobile }) }));
    else if (b.dataset.act === 'dl') { const blob = await audioDB.get(sid); if (blob) saveBlob(blob, `Patient_${(p?.name || 'x').replace(/[^\wऀ-ॿ]+/g, '_')}_${fileBase(s).split('_').slice(-2).join('_')}.${audioExt(blob)}`); else toast('Recording nahi mili'); }
    else if (b.dataset.act === 'unlink') { setSessionPatient(sid, null); renderRecordings(); renderList(); }
  }

  function openAttach() {
    const p = byId(A.current); if (!p) return;
    const taken = new Set(A.patients.flatMap(x => sessionsFor(x).map(s => s.id)));
    const list = store.get('vat_history', []).filter(s => !taken.has(s.id));
    $('attachList').innerHTML = list.length ? list.map(s => `<button data-sid="${s.id}">
        <span>${s.type === 'speaker' ? '🔊' : '📞'} <b>${esc(s.them?.name || (s.them?.number ? '+' + s.them.number : 'Call'))}</b></span>
        <small>${fmtDate(s.startedAt)} · ${s.entries.length} baatein${s.hasAudio ? ' · 🎧' : ''}</small></button>`).join('')
      : '<p class="muted center">Koi aisi call nahi jo kisi patient se judi na ho.</p>';
    $('modalAttach').classList.remove('hidden');
  }

  async function deletePatient() {
    const p = byId(A.current); if (!p) return;
    if (!confirm(`"${p.name}" ko delete karein? (Call recordings History me rahengi)`)) return;
    A.patients = A.patients.filter(x => x.id !== p.id);
    store.get('vat_history', []).filter(s => s.patientId === p.id).forEach(s => setSessionPatient(s.id, null));
    await save();
    A.current = null; renderList(); show('scrPatients');
    toast('🗑️ Patient delete ho gaya');
  }

  function callPatient(video) {
    const p = byId(A.current); if (!p) return;
    $('callNumber').value = '+' + normNumber(p.mobile);
    startCall(video);
  }
  function linkPatient() {
    const p = byId(A.current); if (!p) return;
    $('callNumber').value = '+' + normNumber(p.mobile);
    A.linkPatientId = p.id;   // agli bina-number (link) wali call is patient se judegi
    sendGuestLink();
  }
  function speakerPatient() {
    const p = byId(A.current); if (!p) return;
    $('callNumber').value = '+' + normNumber(p.mobile);
    A.spkPatientId = p.id;
    openSpeakerMode();
  }

  async function reportPdf() {
    const p = byId(A.current); if (!p) return;
    const list = sessionsFor(p);
    const rows = list.map((s, i) => {
      const secs = Math.max(0, Math.round(((s.endedAt || s.startedAt) - s.startedAt) / 1000));
      const talk = s.entries.map(e => `<div><b>${e.who === 'me' ? esc(s.me?.name || 'Doctor') : esc(p.name)}:</b> ${esc(e.text)}${e.translated && e.translated !== e.text ? ` <i>(${esc(e.translated)})</i>` : ''}</div>`).join('');
      return `<tr><td>${i + 1}</td><td>${fmtDate(s.startedAt)}<br><small>${Math.floor(secs / 60)}m ${secs % 60}s · ${s.hasAudio ? '🎧 recording' : '—'}</small></td><td>${talk || '—'}</td></tr>`;
    }).join('');
    const html = `<div class="pdfDoc"><h1>${APP_NAME}</h1><div class="sub">Patient Report · ${fmtDate(Date.now())}</div>
      <table style="margin-bottom:14px"><tr><th style="width:30%">Vivaran</th><th>Jaankari</th></tr>
        <tr><td>Patient ka naam</td><td><b>${esc(p.name)}</b></td></tr>
        <tr><td>Mobile</td><td>+${esc(normNumber(p.mobile))}</td></tr>
        <tr><td>Pata</td><td>${esc(p.address || '—')}</td></tr>
        <tr><td>Assign kiya</td><td>${esc(p.assignedBy || '—')}</td></tr>
        <tr><td>Joda gaya</td><td>${fmtDate(p.createdAt)}</td></tr>
        ${p.notes ? `<tr><td>Notes</td><td>${esc(p.notes)}</td></tr>` : ''}
        <tr><td>Kul calls</td><td>${list.length}</td></tr></table>
      <table><tr><th>#</th><th style="width:28%">Call</th><th>Baatcheet</th></tr>${rows || '<tr><td colspan="3">Koi call nahi</td></tr>'}</table>
      <div class="foot">Generated by ${APP_NAME} · Admin: ${esc(A.name)}</div></div>`;
    await renderPdf(html, `Patient_${p.name.replace(/[^\wऀ-ॿ]+/g, '_')}_Report.pdf`);
  }

  /* ---------------- bind ---------------- */
  function bind() {
    $('btnAdmin').onclick = () => {
      if (isIn()) { if (confirm('Admin se logout karein?')) logout(); return; }
      $('lgName').value = ''; $('lgPass').value = ''; $('lgErr').textContent = '';
      $('modalLogin').classList.remove('hidden');
      setTimeout(() => $('lgName').focus(), 50);
    };
    $('btnLgCancel').onclick = () => $('modalLogin').classList.add('hidden');
    $('btnLgShow').onclick = () => { const i = $('lgPass'); i.type = i.type === 'password' ? 'text' : 'password'; };
    $('formLogin').onsubmit = async (e) => {
      e.preventDefault();
      $('btnLgGo').disabled = true; $('lgErr').textContent = '';
      try {
        await login($('lgName').value, $('lgPass').value);
        $('modalLogin').classList.add('hidden'); $('lgPass').value = '';
        show('scrPatients');
      } catch (err) { $('lgErr').textContent = '⚠️ ' + err.message; }
      finally { $('btnLgGo').disabled = false; }
    };
    $('lnkForgot').onclick = (e) => { e.preventDefault(); openForgot(); };
    $('btnFgSend').onclick = sendOtp;
    $('btnFgVerify').onclick = verifyOtp;
    $('btnFgResend').onclick = () => fgStep(1);
    $('btnFgSave').onclick = resetPassword;
    $('btnFgCancel').onclick = () => { OTP.ok = false; $('modalForgot').classList.add('hidden'); };
    $('btnAdminPw').onclick = () => { $('pwOld').value = ''; $('pwNew').value = ''; $('pwNew2').value = ''; $('pwErr').textContent = ''; $('modalPw').classList.remove('hidden'); };
    $('btnPwCancel').onclick = () => $('modalPw').classList.add('hidden');
    $('formPw').onsubmit = async (e) => {
      e.preventDefault(); $('pwErr').textContent = '';
      if ($('pwNew').value !== $('pwNew2').value) { $('pwErr').textContent = '⚠️ Naya password dono jagah same nahi hai'; return; }
      try { await changePassword($('pwOld').value, $('pwNew').value); $('modalPw').classList.add('hidden'); toast('✅ Admin password badal gaya'); }
      catch (err) { $('pwErr').textContent = '⚠️ ' + err.message; }
    };
    $('btnPatNew').onclick = () => openForm(null);
    $('patSearch').addEventListener('input', renderList);
    $('patList').addEventListener('click', (e) => { const c = e.target.closest('.patCard'); if (c) openDetail(c.dataset.id); });
    $('formPatient').onsubmit = (e) => { e.preventDefault(); submitForm(); };
    $('btnPfCancel').onclick = () => $('modalPatient').classList.add('hidden');
    $('btnPdBack').onclick = () => { renderList(); show('scrPatients'); };
    $('btnPdEdit').onclick = () => openForm(byId(A.current));
    $('btnPdDel').onclick = deletePatient;
    $('btnPdVideo').onclick = () => callPatient(true);
    $('btnPdVoice').onclick = () => callPatient(false);
    $('btnPdLink').onclick = linkPatient;
    $('btnPdSpk').onclick = speakerPatient;
    $('btnPdReport').onclick = reportPdf;
    $('btnPdAttach').onclick = openAttach;
    $('btnAttachClose').onclick = () => $('modalAttach').classList.add('hidden');
    $('attachList').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-sid]'); if (!b) return;
      setSessionPatient(b.dataset.sid, A.current);
      $('modalAttach').classList.add('hidden'); renderRecordings(); renderList();
      toast('✅ Call patient se jud gayi');
    });
    $('pdRecs').addEventListener('click', onRecClick);
    ['click', 'keydown', 'touchstart'].forEach(ev => document.addEventListener(ev, bumpIdle, { passive: true }));
  }

  return {
    init() { bind(); onLoginChange(); },
    isIn, onSessionFinished, renderList,
    back() {
      for (const m of ['modalLogin', 'modalForgot', 'modalPatient', 'modalAttach', 'modalPw']) if (!$(m).classList.contains('hidden')) { $(m).classList.add('hidden'); return true; }
      const c = current();
      if (c === 'scrPatient') { renderList(); show('scrPatients'); return true; }
      if (c === 'scrPatients') { show('scrHome'); return true; }
      return false;
    },
  };
})();
window.Admin = Admin;
