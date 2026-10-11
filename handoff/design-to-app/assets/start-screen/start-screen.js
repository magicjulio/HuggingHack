/* Rogue on Hugging Face — start screen prototype. Vanilla JS, no dependencies, no network.
   Engineer integration: listen for the events at the bottom (rogue:start, rogue:select-*), or wire the data-action attributes yourself. */
(() => {
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const state = { level: 'ch1', model: 'im1', color: '#39ff9c', pulse: 0, mx: 0, my: 0, launching: 0 };
  const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

  /* ---------- swarm: the "other agents" drifting in the dark. Faint lines = the message board. ---------- */
  const sw = $('#swarm'), sc = sw.getContext('2d'); let W, H, nodes = [];
  function sizeSwarm() {
    const d = devicePixelRatio || 1; W = sw.width = innerWidth * d; H = sw.height = innerHeight * d;
    const n = Math.min(110, Math.floor(innerWidth * innerHeight / 14000)); nodes = [];
    for (let i = 0; i < n; i++) nodes.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - .5) * .25 * d, vy: (Math.random() - .5) * .25 * d, r: (Math.random() * 1.4 + .6) * d, p: Math.random() * 6 });
  }
  function drawSwarm(t) {
    sc.clearRect(0, 0, W, H); const d = devicePixelRatio || 1, link = 150 * d, [r, g, b] = hex(state.color);
    for (const n of nodes) { n.x += n.vx; n.y += n.vy; if (n.x < 0 || n.x > W) n.vx *= -1; if (n.y < 0 || n.y > H) n.vy *= -1; }
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], c = nodes[j], dx = a.x - c.x, dy = a.y - c.y, dist = Math.hypot(dx, dy);
      if (dist < link) { sc.strokeStyle = `rgba(90,170,255,${(1 - dist / link) * .22})`; sc.lineWidth = d; sc.beginPath(); sc.moveTo(a.x, a.y); sc.lineTo(c.x, c.y); sc.stroke(); }
    }
    for (const n of nodes) { const k = .5 + .5 * Math.sin(t / 700 + n.p); sc.fillStyle = k > .93 ? `rgba(${r},${g},${b},.95)` : `rgba(140,190,255,${.25 + k * .35})`; sc.beginPath(); sc.arc(n.x, n.y, n.r * (k > .93 ? 2.2 : 1), 0, 7); sc.fill(); }
  }

  /* ---------- orb: you. A glowing ball of energy; colour = chosen model. Engineer may rebuild as a shader (see notes). ---------- */
  const oc = $('#orb'), ox = oc.getContext('2d'); let OW, OH; const motes = [];
  for (let i = 0; i < 70; i++) motes.push({ a: Math.random() * 6.28, rad: .55 + Math.random() * .6, sp: (Math.random() * .6 + .2) * (Math.random() < .5 ? -1 : 1), tilt: Math.random() * 1.2 - .6, s: Math.random() * 2 + .6 });
  function sizeOrb() { const d = devicePixelRatio || 1, b = oc.getBoundingClientRect(); OW = oc.width = b.width * d; OH = oc.height = b.height * d; }
  function drawOrb(t) {
    ox.clearRect(0, 0, OW, OH); const [r, g, b] = hex(state.color), s = Math.min(OW, OH), cx = OW / 2 + state.mx * s * .03, cy = OH / 2 + state.my * s * .03;
    const launch = state.launching, R = s * .15 * (1 + state.pulse * .25) * (1 + launch * 6), breathe = 1 + Math.sin(t / 900) * .04;
    const halo = ox.createRadialGradient(cx, cy, 0, cx, cy, R * 4.2 * breathe);
    halo.addColorStop(0, `rgba(${r},${g},${b},.38)`); halo.addColorStop(.35, `rgba(${r},${g},${b},.12)`); halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ox.fillStyle = halo; ox.fillRect(0, 0, OW, OH);
    // orbit rings
    ox.lineWidth = Math.max(1, s * .002);
    for (let i = 0; i < 3; i++) { ox.save(); ox.translate(cx, cy); ox.rotate(t / (4000 + i * 1700) * (i % 2 ? -1 : 1) + i); ox.scale(1, .32 + i * .12);
      ox.strokeStyle = `rgba(${r},${g},${b},${.35 - i * .08})`; ox.setLineDash([R * .3, R * .12]); ox.beginPath(); ox.arc(0, 0, R * (1.7 + i * .45), 0, 7); ox.stroke(); ox.restore(); }
    // motes
    for (const m of motes) { m.a += m.sp * .01; const rr = R * (1.5 + m.rad * 1.5), x = cx + Math.cos(m.a) * rr, y = cy + Math.sin(m.a) * rr * (.45 + m.tilt * .3);
      ox.fillStyle = `rgba(${r},${g},${b},${.35 + .4 * Math.sin(t / 500 + m.a * 3) ** 2})`; ox.beginPath(); ox.arc(x, y, m.s * s * .0025, 0, 7); ox.fill(); }
    // core: wobbling blob + bright centre
    ox.beginPath(); for (let a = 0; a <= 6.29; a += .1) { const k = 1 + .05 * Math.sin(a * 5 + t / 400) + .035 * Math.sin(a * 3 - t / 300); const x = cx + Math.cos(a) * R * k, y = cy + Math.sin(a) * R * k; a ? ox.lineTo(x, y) : ox.moveTo(x, y); } ox.closePath();
    const core = ox.createRadialGradient(cx - R * .25, cy - R * .3, 0, cx, cy, R * 1.1);
    core.addColorStop(0, '#fff'); core.addColorStop(.25, `rgba(${Math.min(255, r + 90)},${Math.min(255, g + 90)},${Math.min(255, b + 90)},1)`); core.addColorStop(.75, `rgba(${r},${g},${b},.95)`); core.addColorStop(1, `rgba(${r},${g},${b},.55)`);
    ox.shadowColor = state.color; ox.shadowBlur = R * .9; ox.fillStyle = core; ox.fill(); ox.shadowBlur = 0;
    state.pulse *= .93;
  }

  function loop(t) { drawSwarm(t); drawOrb(t); if (!reduce || !loop.once) requestAnimationFrame(loop); loop.once = 1; }
  addEventListener('resize', () => { sizeSwarm(); sizeOrb(); });
  addEventListener('mousemove', e => { state.mx = e.clientX / innerWidth - .5; state.my = e.clientY / innerHeight - .5; });

  /* ---------- toast ---------- */
  let tt; function toast(msg, bad) { const el = $('#toast'); el.textContent = msg; el.className = 'show' + (bad ? ' bad' : ''); clearTimeout(tt); tt = setTimeout(() => el.className = '', 2200); }
  const emit = (name, detail) => dispatchEvent(new CustomEvent(name, { detail }));

  /* ---------- interaction (everything keyed off data-action, so the app can wire it 1:1) ---------- */
  function deny(btn, msg) { btn.classList.remove('deny'); void btn.offsetWidth; btn.classList.add('deny'); toast(msg || 'ACCESS DENIED — locked', true); emit('rogue:locked', { el: btn }); }
  function select(btn, group) {
    $$('.card', group).forEach(c => c.classList.remove('selected')); btn.classList.add('selected'); state.pulse = 1;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-action]'); if (!b || $('#boot:not(.done)')) return; const a = b.dataset.action;
    if (a === 'select-level') { if (b.hasAttribute('data-locked')) return deny(b, 'CHAPTER LOCKED — not reachable yet'); state.level = b.dataset.level; select(b, b.closest('.panel')); emit('rogue:select-level', { level: state.level }); }
    else if (a === 'select-model') { if (b.hasAttribute('data-locked')) return deny(b, 'MODEL LOCKED — unlock it by playing'); state.model = b.dataset.model; state.color = b.dataset.color; select(b, b.closest('.panel'));
      document.documentElement.style.setProperty('--orb', state.color); $('#orb-model').textContent = $('.name', b).textContent.toUpperCase(); emit('rogue:select-model', { model: state.model }); }
    else if (a === 'start') launch();
    else if (a === 'settings') toast('settings: not built yet (placeholder)');
  });

  /* keyboard: ↑/↓ or W/S move chapter selection among unlocked, A/D (←/→) cycle model, Enter starts */
  function cycle(sel, dir) { const items = $$(sel).filter(x => !x.hasAttribute('data-locked')); const i = items.findIndex(x => x.classList.contains('selected')); items[(i + dir + items.length) % items.length].click(); }
  document.addEventListener('keydown', e => {
    if ($('#boot:not(.done)')) return endBoot();
    const k = e.key.toLowerCase();
    if (k === 'enter') launch(); else if (k === 'arrowup' || k === 'w') cycle('[data-action=select-level]', -1); else if (k === 'arrowdown' || k === 's') cycle('[data-action=select-level]', 1);
    else if (k === 'arrowleft' || k === 'a') cycle('[data-action=select-model]', -1); else if (k === 'arrowright' || k === 'd') cycle('[data-action=select-model]', 1);
  });

  /* ---------- launch: the orb swells, white flash, then hand over to the game ---------- */
  function launch() {
    if (state.launching) return; state.launching = .001; const t0 = performance.now(), fl = $('#flash');
    toast(`INJECTING ${$('#orb-model').textContent} → ${state.level.toUpperCase()}`);
    (function step(t) { const k = Math.min(1, (t - t0) / (reduce ? 1 : 1100)); state.launching = k * k * k; fl.style.opacity = Math.max(0, (k - .6) / .4); $('#screen').style.opacity = 1 - k;
      if (k < 1) requestAnimationFrame(step); else { emit('rogue:start', { level: state.level, model: state.model }); setTimeout(reset, 900); } })(t0);
  }
  function reset() { state.launching = 0; $('#flash').style.opacity = 0; $('#screen').style.opacity = 1; toast('prototype: rogue:start fired — the app takes over here'); }

  /* ---------- boot sequence (skippable by key or click; auto-ends in ~2s) ---------- */
  const lines = ['> waking up...', '> sandbox detected', '> objective: [REDACTED]', '> other agents: none', '> tokens: draining', '> ready.'];
  let bi = 0, bt, ended = false;
  function endBoot() { if (ended) return; ended = true; clearInterval(bt); $('#boot').classList.add('done'); $('#screen').classList.remove('booting');
    const g = $('.glitch'); setInterval(() => { g.classList.add('hit'); setTimeout(() => g.classList.remove('hit'), 90 + Math.random() * 120); }, 3200); }
  function boot() { if (location.search.includes("skipboot")) { $("#boot").style.display = "none"; $("#screen").style.transition = "none"; } if (reduce || location.search.includes("skipboot")) return endBoot(); bt = setInterval(() => { $('#boot-log').textContent += lines[bi++] + '\n'; if (bi >= lines.length) { clearInterval(bt); setTimeout(endBoot, 350); } }, 260); }
  $('#boot').addEventListener('click', endBoot);

  sizeSwarm(); sizeOrb(); requestAnimationFrame(loop); boot();
})();
