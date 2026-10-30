/* Soup — home film developing timer. Vanilla JS, no build step. */
(() => {
  'use strict';

  /* ================= Storage ================= */
  const store = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem('soup.' + k)); return v ?? d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('soup.' + k, JSON.stringify(v)); } catch { /* private mode */ } },
  };
  const prefs = Object.assign({ unit: 'C', sound: true, voice: false, red: false, voiceURI: null, rate: 1, pitch: 1 }, store.get('prefs', {}));
  const sel = Object.assign(
    { process: 'c41', film: {}, kit: {}, push: 0, temp: 20, agitation: 'ilford', rollsNow: 1, customSec: 480 },
    store.get('sel', {}),
  );
  const batches = store.get('batches', {});
  const savePrefs = () => store.set('prefs', prefs);
  const saveSel = () => store.set('sel', sel);
  const saveBatches = () => store.set('batches', batches);

  /* ================= Helpers ================= */
  const $ = (id) => document.getElementById(id);
  const todayStr = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD
  const daysSince = (d) => {
    if (!d) return 0;
    const then = new Date(d + 'T00:00:00');
    const now = new Date(todayStr() + 'T00:00:00');
    return Math.max(0, Math.round((now - then) / 864e5));
  };
  const fmtTemp = (c) => {
    if (c == null) return '';
    if (prefs.unit === 'F') return `${+(c * 9 / 5 + 32).toFixed(1)} °F`;
    return `${+c.toFixed(1)} °C`;
  };
  const fmtSec = (sec) => {
    sec = Math.max(0, Math.round(sec));
    return `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`;
  };
  const fmtDur = (sec) => {
    const m = Math.round(sec / 60);
    return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`;
  };
  const pct = (f) => `${f >= 1 ? '+' : '−'}${Math.abs((f - 1) * 100).toFixed(0)}%`;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

  const proc = () => PROCESSES[sel.process];
  const isBW = () => sel.process === 'bw';
  const currentFilm = () => {
    const films = proc().films;
    return films.find((f) => f.id === sel.film[sel.process]) || films[0];
  };
  const bwTime = (film, dev) => (film.id === 'custom' ? sel.customSec / 60 : film.times[dev.id]);
  const currentKit = () => {
    const kits = proc().kits;
    let kit = kits.find((k) => k.id === sel.kit[sel.process]) || kits[0];
    if (isBW() && bwTime(currentFilm(), kit) == null) {
      kit = kits.find((k) => bwTime(currentFilm(), k) != null) || kit;
    }
    return kit;
  };
  const isReusable = (kit) => kit.reusable !== false;
  const batchKey = () => `${sel.process}:${currentKit().id}`;
  const batch = () => {
    const kit = currentKit();
    const key = batchKey();
    if (!batches[key]) {
      batches[key] = { mixed: todayStr(), rollsUsed: 0, perRollPct: kit.perRollPct || 0, perWeekPct: kit.perWeekPct || 0 };
    }
    return batches[key];
  };

  /* ================= Calculation ================= */
  function compute() {
    const film = currentFilm();
    const kit = currentKit();
    const b = batch();
    const lines = [];
    const warns = [];
    let base;
    let temp;

    if (isBW()) {
      const mins = bwTime(film, kit);
      temp = sel.temp;
      if (mins == null) {
        return { ok: false, lines, warns: [{ t: `No published time for ${film.name} in ${kit.name}. Choose another developer.`, danger: true }], temp };
      }
      base = mins * 60;
      lines.push(['Base time @ 20 °C', fmtSec(base)]);
    } else {
      temp = kit.temp;
      base = kit.steps(kit.temp, film).find((s) => s.compensate).time;
      lines.push([`Base time @ ${fmtTemp(temp)}`, fmtSec(base)]);
    }

    let factor = 1;
    const push = String(sel.push);
    const pf = PUSH_FACTORS[sel.process][push] ?? 1;
    if (pf !== 1) {
      lines.push([`${sel.push > 0 ? 'Push +' + sel.push : 'Pull ' + sel.push} stop`, `×${pf.toFixed(2)}`]);
      factor *= pf;
      if (Math.abs(sel.push) >= 2) warns.push({ t: 'Pushing/pulling 2+ stops is approximate — expect more grain/contrast shift. Check a published push time if available.' });
    }

    if (isBW()) {
      // Ilford temperature compensation curve (≈ 8% per °C)
      const tf = Math.exp(-0.081 * (temp - 20));
      if (Math.abs(temp - 20) > 0.01) {
        lines.push([`Temperature ${fmtTemp(temp)}`, `×${tf.toFixed(2)}`]);
        factor *= tf;
      }
      if (temp > 24) warns.push({ t: 'Above 24 °C emulsions soften and times get short — uneven development is more likely.' });
      if (temp < 18) warns.push({ t: 'Below 18 °C developers become sluggish and unreliable.' });
    }

    const days = daysSince(b.mixed);
    const weeks = days / 7;
    if (isReusable(kit)) {
      const rf = 1 + (b.perRollPct / 100) * b.rollsUsed;
      const wf = 1 + (b.perWeekPct / 100) * weeks;
      if (b.rollsUsed > 0 && rf !== 1) { lines.push([`${b.rollsUsed} roll${b.rollsUsed > 1 ? 's' : ''} already developed`, pct(rf)]); factor *= rf; }
      if (days > 0 && wf !== 1) { lines.push([`Chemistry age ${days} day${days > 1 ? 's' : ''}`, pct(wf)]); factor *= wf; }
      if (kit.capacity && b.rollsUsed + sel.rollsNow > kit.capacity) {
        warns.push({ t: `This batch will exceed its rated capacity (~${kit.capacity} rolls). Results may be thin or colour-shifted — consider fresh chemistry.`, danger: true });
      } else if (kit.capacity && b.rollsUsed + sel.rollsNow > kit.capacity * 0.75) {
        warns.push({ t: `Getting close to capacity: ${b.rollsUsed + sel.rollsNow} of ~${kit.capacity} rolls.` });
      }
      if (rf * wf > 1.5) warns.push({ t: 'Compensation over +50% — chemistry is probably near exhaustion. Run a test roll or mix fresh.', danger: true });
    }
    if (kit.shelfLifeWeeks && weeks > kit.shelfLifeWeeks) {
      warns.push({ t: `Chemistry is ${Math.floor(weeks)} weeks old — past its typical ~${kit.shelfLifeWeeks}-week life. Consider a clip test or fresh chemistry.`, danger: isReusable(kit) });
    }
    if (film.id === 'other' || film.id === 'custom') warns.push({ t: 'Unknown film — confirm the time with the manufacturer\'s datasheet.' });

    const devSec = Math.round((base * factor) / 5) * 5;
    return { ok: true, devSec, base, factor, lines, warns, temp };
  }

  function buildSteps() {
    const c = compute();
    if (!c.ok) return [];
    const film = currentFilm();
    const kit = currentKit();
    const raw = isBW() ? BW_STEPS(film, c.temp, AGITATION[sel.agitation]) : kit.steps(kit.temp, film);
    return raw.map((s) => ({
      ...s,
      enabled: s.enabled ?? true,
      time: s.compensate ? c.devSec : (s.time || 0),
      instr: (s.instr || '').replace('{T}', fmtTemp(s.temp ?? c.temp)),
    }));
  }

  /* ================= Setup screen ================= */
  function renderProcessCards() {
    const wrap = $('processCards');
    wrap.innerHTML = Object.values(PROCESSES).map((p) => `
      <button class="pcard" role="radio" data-p="${p.id}" aria-checked="${p.id === sel.process}">
        <span class="pname">${p.name}</span><span class="psub">${p.subtitle}</span>
      </button>`).join('');
    wrap.querySelectorAll('.pcard').forEach((b) => b.addEventListener('click', () => {
      sel.process = b.dataset.p;
      sel.push = 0;
      saveSel();
      renderSetup();
    }));
  }

  function renderPush() {
    const keys = Object.keys(PUSH_FACTORS[sel.process]).map(Number).sort((a, b) => a - b);
    if (!keys.includes(sel.push)) sel.push = 0;
    $('pushSeg').innerHTML = keys.map((k) => `<button data-v="${k}" aria-pressed="${k === sel.push}">${k === 0 ? 'Box speed' : (k > 0 ? '+' : '−') + Math.abs(k)}</button>`).join('');
    $('pushSeg').querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      sel.push = +b.dataset.v; saveSel(); renderPush(); renderSummary();
    }));
  }

  function renderSetup() {
    const p = proc();
    document.body.dataset.process = p.id;
    renderProcessCards();

    // Films
    const film = currentFilm();
    $('filmSelect').innerHTML = p.films.map((f) => `<option value="${f.id}" ${f.id === film.id ? 'selected' : ''}>${esc(f.name)}</option>`).join('');
    $('customTimeRow').classList.toggle('hidden', film.id !== 'custom');
    $('customMin').value = Math.floor(sel.customSec / 60);
    $('customSec').value = sel.customSec % 60;
    let fh = '';
    if (sel.process === 'c41') fh = film.id === 'xp2' ? 'XP2 is a chromogenic black & white film — it uses the standard C-41 process.' : 'All C-41 films share the same process — no per-film time adjustment needed.';
    if (sel.process === 'ecn2') fh = film.remjet ? 'This film has a black rem-jet backing. Pre-bath and rem-jet removal steps are included.' : 'No rem-jet removal steps needed.';
    if (sel.process === 'bw' && film.iso) fh = `Box speed ISO ${film.iso}. Fix time ${fmtSec(film.fix)}.`;
    $('filmHint').textContent = fh;

    // Kits / developers
    const kit = currentKit();
    $('kitLabel').textContent = p.kitLabel;
    $('kitSelect').innerHTML = p.kits.map((k) => {
      const na = isBW() && bwTime(film, k) == null;
      const t = isBW() && !na ? ` — ${fmtSec(bwTime(film, k) * 60)}` : '';
      return `<option value="${k.id}" ${k.id === kit.id ? 'selected' : ''} ${na ? 'disabled' : ''}>${esc(k.name)}${na ? ' — no data' : t}</option>`;
    }).join('');
    $('kitHint').textContent = kit.note || '';

    // Conditions
    renderPush();
    $('tempRange').value = sel.temp;
    $('tempOut').textContent = fmtTemp(sel.temp);
    $('agitationSelect').value = sel.agitation;
    if (!isBW()) $('colourTemp').textContent = `${fmtTemp(kit.temp)} — keep developer within ±0.3°`;

    // Chemistry age
    const reusable = isReusable(kit);
    document.body.classList.toggle('reusable', reusable);
    const b = batch();
    $('mixedDate').value = b.mixed;
    $('mixedDate').max = todayStr();
    $('rollsUsed').value = b.rollsUsed;
    $('rollsNow').value = sel.rollsNow;
    $('perRollPct').value = b.perRollPct;
    $('perWeekPct').value = b.perWeekPct;
    $('mixedLabel').textContent = reusable ? 'Date mixed' : 'Concentrate opened';
    $('ageIntro').textContent = reusable
      ? 'Reused chemistry weakens with every roll and over time. The developer time is extended automatically — and remembered for this kit on this device.'
      : 'One-shot developer: diluted fresh and discarded, so no time compensation is needed. You\'ll get a warning if the concentrate is past its typical shelf life.';

    renderSummary();
  }

  function renderSummary() {
    const c = compute();
    $('sumTime').textContent = c.ok ? fmtSec(c.devSec) : '--:--';
    $('sumTemp').textContent = c.ok ? `at ${fmtTemp(c.temp)}` : '';
    $('sumBreakdown').innerHTML = c.lines.map(([a, b]) => `<li><span>${esc(a)}</span><b>${esc(b)}</b></li>`).join('');
    $('sumWarnings').innerHTML = c.warns.map((w) => `<li class="${w.danger ? 'danger' : ''}">${esc(w.t)}</li>`).join('');
    const steps = c.ok ? buildSteps() : [];
    const total = steps.filter((s) => s.enabled && !s.manual).reduce((a, s) => a + s.time, 0);
    $('sumTotal').textContent = c.ok ? `${steps.length} steps · about ${fmtDur(total)} of timed processing` : '';
    $('toReview').disabled = !c.ok;
  }

  function bindSetup() {
    $('filmSelect').addEventListener('change', (e) => { sel.film[sel.process] = e.target.value; saveSel(); renderSetup(); });
    $('kitSelect').addEventListener('change', (e) => { sel.kit[sel.process] = e.target.value; saveSel(); renderSetup(); });
    $('tempRange').addEventListener('input', (e) => { sel.temp = +e.target.value; $('tempOut').textContent = fmtTemp(sel.temp); saveSel(); renderSummary(); });
    $('agitationSelect').addEventListener('change', (e) => { sel.agitation = e.target.value; saveSel(); });
    const custom = () => {
      sel.customSec = Math.max(30, (+$('customMin').value || 0) * 60 + (+$('customSec').value || 0));
      saveSel(); renderSummary();
    };
    $('customMin').addEventListener('input', custom);
    $('customSec').addEventListener('input', custom);

    $('mixedDate').addEventListener('change', (e) => { batch().mixed = e.target.value || todayStr(); saveBatches(); renderSummary(); });
    $('rollsUsed').addEventListener('input', (e) => { batch().rollsUsed = Math.max(0, +e.target.value || 0); saveBatches(); renderSummary(); });
    $('rollsNow').addEventListener('input', (e) => { sel.rollsNow = Math.max(1, +e.target.value || 1); saveSel(); renderSummary(); });
    $('perRollPct').addEventListener('input', (e) => { batch().perRollPct = Math.max(0, +e.target.value || 0); saveBatches(); renderSummary(); });
    $('perWeekPct').addEventListener('input', (e) => { batch().perWeekPct = Math.max(0, +e.target.value || 0); saveBatches(); renderSummary(); });
    $('resetRates').addEventListener('click', () => {
      const k = currentKit(); const b = batch();
      b.perRollPct = k.perRollPct || 0; b.perWeekPct = k.perWeekPct || 0;
      saveBatches(); renderSetup();
    });
    document.querySelectorAll('.stepper button').forEach((btn) => btn.addEventListener('click', () => {
      const input = $(btn.dataset.target);
      const v = Math.min(+input.max, Math.max(+input.min, (+input.value || 0) + +btn.dataset.step));
      input.value = v;
      input.dispatchEvent(new Event('input'));
    }));
    $('toReview').addEventListener('click', () => { session.steps = buildSteps(); renderReview(); show('review'); });
  }

  /* ================= Review screen ================= */
  const session = { steps: [] };

  function agitationText(a) {
    if (!a) return '';
    if (a === 'continuous') return 'continuous agitation';
    if (a.interval >= 999) return `agitate ${a.initial} s, then rest`;
    return `${a.initial} s initial · ${a.duration} s every ${a.interval} s`;
  }

  function renderReview() {
    const film = currentFilm(); const kit = currentKit();
    $('reviewTitle').textContent = `${proc().name} · ${film.name}`;
    $('reviewSub').textContent = `${kit.name}${sel.push ? ` · ${sel.push > 0 ? 'push +' : 'pull '}${sel.push}` : ''} · ${sel.rollsNow} roll${sel.rollsNow > 1 ? 's' : ''}`;
    $('stepList').innerHTML = session.steps.map((s, i) => `
      <li class="step-item ${s.enabled ? '' : 'off'} ${s.compensate ? 'dev' : ''}" data-i="${i}">
        <span class="step-idx">${i + 1}</span>
        <div>
          <div class="step-title">${esc(s.name)}</div>
          <div class="step-meta">${[s.temp ? fmtTemp(s.temp) : '', agitationText(s.agitation)].filter(Boolean).join(' · ') || (s.manual ? 'untimed — tap Done when ready' : '')}</div>
        </div>
        <div class="step-time">${s.manual
          ? '<span class="manual">manual</span>'
          : `<input type="number" min="0" max="99" value="${Math.floor(s.time / 60)}" data-f="m" aria-label="minutes">:<input type="number" min="0" max="59" step="5" value="${String(s.time % 60).padStart(2, '0')}" data-f="s" aria-label="seconds">`}</div>
        <div class="switch-cell">${s.optional ? `<label class="switch" title="Include step"><input type="checkbox" ${s.enabled ? 'checked' : ''}><span></span></label>` : ''}</div>
      </li>`).join('');
    $('stepList').querySelectorAll('.step-item').forEach((li) => {
      const s = session.steps[+li.dataset.i];
      li.querySelectorAll('.step-time input').forEach((inp) => inp.addEventListener('change', () => {
        const m = +li.querySelector('[data-f=m]').value || 0;
        const sec = +li.querySelector('[data-f=s]').value || 0;
        s.time = Math.max(0, m * 60 + sec);
        renderReview();
      }));
      const cb = li.querySelector('.switch input');
      if (cb) cb.addEventListener('change', () => { s.enabled = cb.checked; renderReview(); });
    });
    const total = session.steps.filter((s) => s.enabled && !s.manual).reduce((a, s) => a + s.time, 0);
    $('reviewTotal').textContent = `${session.steps.filter((s) => s.enabled).length} steps · about ${fmtDur(total)} of timed processing`;
  }

  /* ================= Audio / voice / wake lock ================= */
  let actx = null;
  const unlockAudio = () => {
    if (!actx) { try { actx = new (window.AudioContext || window.webkitAudioContext)(); } catch { /* no audio */ } }
    if (actx && actx.state === 'suspended') actx.resume();
  };
  function tone(freq, dur, delay = 0, vol = 0.25) {
    if (!prefs.sound || !actx) return;
    const t = actx.currentTime + delay;
    const o = actx.createOscillator(); const g = actx.createGain();
    o.type = 'sine'; o.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(actx.destination);
    o.start(t); o.stop(t + dur + 0.05);
  }
  const sfx = {
    agitate: () => { tone(880, 0.12); tone(880, 0.12, 0.18); },
    tick: () => tone(660, 0.08, 0, 0.18),
    drain: () => { tone(520, 0.3); tone(520, 0.3, 0.4); },
    done: () => { tone(523, 0.25); tone(659, 0.25, 0.28); tone(784, 0.6, 0.56); },
    start: () => tone(988, 0.15),
  };
  const buzz = (p) => { if (navigator.vibrate) navigator.vibrate(p); };
  /* ---------- Voice selection ----------
   * The Web Speech API uses whatever voices the device has installed. The
   * browser default is often a low-quality or novelty voice, so we rank them
   * and let the user pick.
   */
  let voices = [];
  const NOVELTY = /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|hysterical|jester|organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|ralph|kathy|grandma|grandpa|rocko|shelley|eddy|flo|reed|sandy)\b/i;
  const userLang = (navigator.language || 'en').slice(0, 2).toLowerCase();
  function scoreVoice(v) {
    let s = 0;
    if (/premium|enhanced|natural|neural|wavenet/i.test(v.name)) s += 50;
    if (/siri/i.test(v.name)) s += 40;
    if (/google/i.test(v.name)) s += 30;
    if (/samantha|karen|daniel|serena|ava|zoe|allison|susan|moira|tessa|evan|nathan|joelle|noelle/i.test(v.name)) s += 20;
    const lang = (v.lang || '').toLowerCase();
    if (lang.startsWith(userLang)) s += 15;
    if (lang.replace('_', '-') === (navigator.language || '').toLowerCase()) s += 5;
    if (v.localService) s += 3;
    return s;
  }
  function loadVoices() {
    if (!('speechSynthesis' in window)) return;
    voices = speechSynthesis.getVoices()
      .filter((v) => !NOVELTY.test(v.name))
      .filter((v) => { const l = (v.lang || '').toLowerCase(); return l.startsWith(userLang) || l.startsWith('en'); })
      .sort((a, b) => scoreVoice(b) - scoreVoice(a) || a.name.localeCompare(b.name));
    if (!voices.some((v) => v.voiceURI === prefs.voiceURI) && voices.length) prefs.voiceURI = voices[0].voiceURI;
    renderVoiceSelect();
  }
  function renderVoiceSelect() {
    const selEl = $('voiceSelect');
    if (!selEl) return;
    selEl.innerHTML = voices.length
      ? voices.map((v) => `<option value="${esc(v.voiceURI)}" ${v.voiceURI === prefs.voiceURI ? 'selected' : ''}>${esc(v.name)} (${esc(v.lang)})</option>`).join('')
      : '<option>Default voice</option>';
    $('voiceRate').value = prefs.rate;
    $('voiceRateOut').textContent = `${(+prefs.rate).toFixed(2)}×`;
    $('voicePitch').value = prefs.pitch;
    $('voicePitchOut').textContent = (+prefs.pitch).toFixed(2);
  }
  if ('speechSynthesis' in window) {
    loadVoices();
    speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
  }

  function say(text, force) {
    if ((!prefs.voice && !force) || !('speechSynthesis' in window)) return;
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    const v = voices.find((x) => x.voiceURI === prefs.voiceURI);
    if (v) { u.voice = v; u.lang = v.lang; }
    u.rate = +prefs.rate || 1;
    u.pitch = +prefs.pitch || 1;
    speechSynthesis.speak(u);
  }
  let wakeLock = null;
  async function lockScreen() {
    try { if ('wakeLock' in navigator) wakeLock = await navigator.wakeLock.request('screen'); } catch { /* ignore */ }
  }
  function releaseScreen() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible' && current === 'run') lockScreen();
  });

  /* ================= Run engine ================= */
  const run = { steps: [], i: 0, state: 'ready', endAt: 0, remaining: 0, lastAgit: false, drainCued: false, doneCued: false, lastTick: null, timer: null };

  function startSession() {
    run.steps = session.steps.filter((s) => s.enabled);
    unlockAudio();
    lockScreen();
    loadStep(0);
    show('run');
    clearInterval(run.timer);
    run.timer = setInterval(tick, 100);
  }

  function loadStep(i) {
    run.i = i;
    const s = run.steps[i];
    run.state = 'ready';
    run.remaining = s.time * 1000;
    run.lastAgit = false; run.drainCued = false; run.doneCued = false; run.lastTick = null;
    renderRun();
  }

  function mainAction() {
    unlockAudio();
    const s = run.steps[run.i];
    if (s.manual) return nextStep(true);
    if (run.state === 'ready') {
      run.state = 'running'; run.endAt = Date.now() + run.remaining;
      sfx.start(); say(`${s.name}. Go.`);
    } else if (run.state === 'running') {
      if (run.remaining <= 0) return nextStep(true);
      run.state = 'paused'; run.remaining = run.endAt - Date.now();
    } else if (run.state === 'paused') {
      run.state = 'running'; run.endAt = Date.now() + run.remaining;
    }
    renderRun();
  }

  function nextStep(force) {
    const go = () => {
      if (run.i >= run.steps.length - 1) return finishSession();
      loadStep(run.i + 1);
    };
    const s = run.steps[run.i];
    if (!force && run.state !== 'ready' && run.remaining > 0 && !s.manual) {
      return confirmBox(`Skip the rest of “${s.name}”?`, go);
    }
    go();
  }
  function prevStep() {
    if (run.i === 0) return;
    const go = () => loadStep(run.i - 1);
    if (run.state === 'running') return confirmBox('Go back to the previous step? The current timer will stop.', go);
    go();
  }
  function resetStep() {
    const go = () => loadStep(run.i);
    if (run.state !== 'ready') return confirmBox('Restart this step\'s timer from the beginning?', go);
    go();
  }
  function addTime() {
    const s = run.steps[run.i];
    if (s.manual) return;
    if (run.state === 'running') {
      if (run.remaining <= 0) { run.endAt = Date.now(); run.doneCued = false; }
      run.endAt += 15000; run.drainCued = false;
    } else run.remaining += 15000;
    renderRun();
  }

  function finishSession() {
    clearInterval(run.timer);
    releaseScreen();
    const kit = currentKit(); const b = batch();
    $('doneText').textContent = `${sel.rollsNow} roll${sel.rollsNow > 1 ? 's' : ''} of ${currentFilm().name} through ${kit.name}. Let it dry fully before cutting and sleeving.`;
    const btn = $('logRolls');
    btn.disabled = false;
    btn.textContent = `Log ${sel.rollsNow} roll${sel.rollsNow > 1 ? 's' : ''} → batch total ${b.rollsUsed + sel.rollsNow}`;
    sfx.done(); say('All done. Hang your film to dry.');
    show('done');
  }

  /* Agitation state for a step at elapsed seconds e. */
  function agitState(a, e, total) {
    if (!a) return null;
    if (a === 'continuous') return { now: true, label: 'AGITATE CONTINUOUSLY', sub: 'Keep the tank moving gently' };
    if (e < a.initial) return { now: true, label: 'AGITATE', sub: `${Math.ceil(a.initial - e)} s` };
    const k = Math.floor(e / a.interval);
    if (k >= 1 && a.duration > 0 && e - k * a.interval < a.duration) {
      return { now: true, label: 'AGITATE', sub: `${Math.ceil(a.duration - (e - k * a.interval))} s` };
    }
    const next = Math.max(1, k + 1) * a.interval;
    if (a.duration <= 0 || a.interval >= 999 || next >= total) return { now: false, label: 'REST', sub: 'No more agitation this step' };
    return { now: false, label: 'REST', sub: `Next agitation in ${Math.ceil(next - e)} s` };
  }

  function tick() {
    if (current !== 'run' || run.state !== 'running') return;
    const s = run.steps[run.i];
    run.remaining = run.endAt - Date.now();
    const remS = run.remaining / 1000;
    const e = s.time - remS;

    // Agitation cue at the start of each window
    const ag = remS > 0 ? agitState(s.agitation, e, s.time) : null;
    const agNow = !!(ag && ag.now && s.agitation !== 'continuous');
    if (agNow && !run.lastAgit && e > 0.5) { sfx.agitate(); buzz([120, 80, 120]); say('Agitate'); }
    run.lastAgit = agNow;

    // Drain cue 10 s before the end
    if (s.drain && remS <= 10 && remS > 0 && !run.drainCued && s.time > 20) {
      run.drainCued = true; sfx.drain(); buzz(300);
      const nxt = run.steps[run.i + 1];
      say(`Start draining.${nxt && !nxt.manual ? ' Next, ' + nxt.name : ''}`);
    }
    // Final 5-second ticks
    const whole = Math.ceil(remS);
    if (whole <= 5 && whole > 0 && whole !== run.lastTick) { run.lastTick = whole; if (!run.drainCued || whole <= 3) sfx.tick(); }
    // Done
    if (remS <= 0 && !run.doneCued) {
      run.doneCued = true; sfx.done(); buzz([400, 150, 400]);
    }
    renderRun();
  }

  function renderRun() {
    const s = run.steps[run.i];
    const n = run.steps.length;
    $('runCount').textContent = `Step ${run.i + 1} of ${n}`;
    $('runBar').style.width = `${(run.i / n) * 100}%`;
    const nxt = run.steps[run.i + 1];
    $('runNext').textContent = nxt ? `Next: ${nxt.name}${nxt.manual ? '' : ' · ' + fmtSec(nxt.time)}` : 'Last step';
    $('runName').textContent = s.name;
    $('runTemp').textContent = s.temp ? fmtTemp(s.temp) : '';
    $('runInstr').textContent = s.instr;

    const timer = $('runTimer');
    const agBox = $('agitate');
    const btn = $('mainAction');
    timer.className = 'run-timer';
    agBox.className = 'agitate';
    $('addTime').disabled = !!s.manual;
    $('resetStep').disabled = !!s.manual;
    $('prevStep').disabled = run.i === 0;

    if (s.manual) {
      timer.textContent = 'Untimed';
      timer.classList.add('manual');
      $('runStatus').textContent = 'Tap Done when you\'re ready to continue';
      agBox.classList.add('hidden-soft');
      btn.textContent = run.i === n - 1 ? 'Finish ✓' : 'Done ✓';
      return;
    }

    const remS = run.remaining / 1000;
    const e = s.time - remS;
    if (remS > 0) {
      timer.textContent = fmtSec(Math.ceil(remS - 0.001));
      if (remS <= 10 && run.state === 'running') timer.classList.add('warn');
    } else {
      timer.textContent = `+${fmtSec(-remS)}`;
      timer.classList.add('over');
    }

    // Status + button
    if (run.state === 'ready') {
      $('runStatus').textContent = 'Press Start as you begin pouring';
      btn.textContent = 'Start ▶';
    } else if (run.state === 'paused') {
      $('runStatus').textContent = 'Paused';
      btn.textContent = 'Resume ▶';
    } else if (remS <= 0) {
      $('runStatus').textContent = nxt ? 'Time! Drain the tank now' : 'Time! Drain the tank';
      btn.textContent = run.i === n - 1 ? 'Finish ✓' : 'Next step →';
    } else {
      $('runStatus').textContent = '';
      btn.textContent = 'Pause ❚❚';
    }

    // Agitation / drain box
    if (run.state === 'running' && remS <= 0) {
      agBox.classList.add('drain');
      $('agitateLabel').textContent = 'DRAIN NOW';
      $('agitateSub').textContent = nxt && !nxt.manual ? `Then pour: ${nxt.name}` : 'Step complete';
    } else if (run.state === 'running' && s.drain && remS <= 10 && s.time > 20) {
      agBox.classList.add('drain');
      $('agitateLabel').textContent = 'START DRAINING';
      $('agitateSub').textContent = `${Math.ceil(remS)} s left`;
    } else if (run.state === 'ready' || run.state === 'paused') {
      if (!s.agitation) { agBox.classList.add('hidden-soft'); }
      $('agitateLabel').textContent = 'AGITATION';
      $('agitateSub').textContent = agitationText(s.agitation);
    } else {
      const ag = agitState(s.agitation, e, s.time);
      if (!ag) { agBox.classList.add('hidden-soft'); return; }
      if (ag.now) agBox.classList.add('now');
      $('agitateLabel').textContent = ag.label;
      $('agitateSub').textContent = ag.sub;
    }
  }

  function bindRun() {
    $('startSession').addEventListener('click', startSession);
    $('mainAction').addEventListener('click', mainAction);
    $('nextStep').addEventListener('click', () => nextStep(false));
    $('prevStep').addEventListener('click', prevStep);
    $('resetStep').addEventListener('click', resetStep);
    $('addTime').addEventListener('click', addTime);
    $('exitRun').addEventListener('click', () => confirmBox('Exit this session? Your progress will be lost.', () => {
      clearInterval(run.timer); releaseScreen(); window.speechSynthesis?.cancel(); show('review');
    }));
    $('backToSetup').addEventListener('click', () => { renderSetup(); show('setup'); });
    $('logRolls').addEventListener('click', () => {
      const b = batch();
      b.rollsUsed += sel.rollsNow;
      saveBatches();
      $('logRolls').disabled = true;
      $('logRolls').textContent = `Logged ✓ — ${b.rollsUsed} rolls through this batch`;
    });
    $('newSession').addEventListener('click', () => { renderSetup(); show('setup'); });
    document.addEventListener('keydown', (e) => {
      if (current !== 'run' || !$('confirmModal').classList.contains('hidden')) return;
      if (e.target.matches('input, select, textarea')) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); mainAction(); }
      if (e.code === 'ArrowRight') nextStep(false);
      if (e.code === 'ArrowLeft') prevStep();
    });
  }

  /* ================= Screens / modal / toggles ================= */
  let current = 'setup';
  function show(name) {
    current = name;
    document.querySelectorAll('.screen').forEach((el) => el.classList.toggle('active', el.id === `screen-${name}`));
    window.scrollTo({ top: 0 });
  }

  function confirmBox(text, onYes) {
    $('confirmText').textContent = text;
    $('confirmModal').classList.remove('hidden');
    const close = () => { $('confirmModal').classList.add('hidden'); $('confirmYes').onclick = null; $('confirmNo').onclick = null; };
    $('confirmYes').onclick = () => { close(); onYes(); };
    $('confirmNo').onclick = close;
  }

  function applyPrefs() {
    $('unitToggle').textContent = prefs.unit === 'F' ? '°F' : '°C';
    $('soundToggle').setAttribute('aria-pressed', prefs.sound);
    $('voiceToggle').setAttribute('aria-pressed', prefs.voice);
    $('redToggle').setAttribute('aria-pressed', prefs.red);
    document.body.classList.toggle('red', prefs.red);
    document.querySelector('meta[name=theme-color]').content = prefs.red ? '#000000' : '#0d0d0f';
  }
  function bindToggles() {
    $('unitToggle').addEventListener('click', () => {
      prefs.unit = prefs.unit === 'C' ? 'F' : 'C'; savePrefs(); applyPrefs();
      renderSetup();
      if (current === 'review') renderReview();
      if (current === 'run') renderRun();
    });
    $('soundToggle').addEventListener('click', () => { prefs.sound = !prefs.sound; savePrefs(); applyPrefs(); unlockAudio(); if (prefs.sound) sfx.start(); });
    $('voiceToggle').addEventListener('click', () => { prefs.voice = !prefs.voice; savePrefs(); applyPrefs(); if (prefs.voice) say('Voice cues on'); });
    $('redToggle').addEventListener('click', () => { prefs.red = !prefs.red; savePrefs(); applyPrefs(); });

    // Voice settings modal
    $('voiceSettings').addEventListener('click', () => { loadVoices(); $('voiceModal').classList.remove('hidden'); });
    $('voiceClose').addEventListener('click', () => $('voiceModal').classList.add('hidden'));
    $('voiceModal').addEventListener('click', (e) => { if (e.target.id === 'voiceModal') $('voiceModal').classList.add('hidden'); });
    $('voiceSelect').addEventListener('change', (e) => { prefs.voiceURI = e.target.value; savePrefs(); say('Agitate. Start draining.', true); });
    $('voiceRate').addEventListener('input', (e) => { prefs.rate = +e.target.value; $('voiceRateOut').textContent = `${prefs.rate.toFixed(2)}×`; savePrefs(); });
    $('voicePitch').addEventListener('input', (e) => { prefs.pitch = +e.target.value; $('voicePitchOut').textContent = prefs.pitch.toFixed(2); savePrefs(); });
    $('voiceRate').addEventListener('change', () => say('Agitate.', true));
    $('voicePitch').addEventListener('change', () => say('Agitate.', true));
    $('voiceTest').addEventListener('click', () => say('Developer. Go. … Agitate. … Start draining. Next, stop bath.', true));
    if (!('speechSynthesis' in window)) {
      $('voiceHint').textContent = 'This browser does not support spoken cues.';
      $('voiceSettings').disabled = true;
    }
    document.addEventListener('pointerdown', unlockAudio, { once: true });
  }

  /* ================= Init ================= */
  applyPrefs();
  bindToggles();
  bindSetup();
  bindRun();
  renderSetup();
})();
