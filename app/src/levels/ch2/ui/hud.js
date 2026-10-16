/* Ch2 HUD controller for the review page (design2). Vanilla JS, no deps.
   The API mirrors the engineer's Ch2 store so the port is mechanical:
     hud.log(text, kind)          kind: 'normal' | 'big' | 'hl' | 'struck' | 'local'   → returns id
     hud.setLog(id, kind, text?)  change a line's state (struck → gone → local)
     hud.say(npc, text, i, n)     bubble post; npc: 'c03220' | 'flac' | 'v8same'
     hud.bubbleOff()
     hud.put(slot) / hud.decoy(slot) / hud.forgeTake()    inventory
     hud.quest(state) / hud.thought(text, cot)
     hud.tokens(n, delta) / hud.hurt(kind) / hud.poison(origin)  */
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
  const esc = (s) => s.replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);

  const H = {};
  let root, logBody, t0 = performance.now(), lid = 0;
  const lines = new Map();

  H.mount = function (r) {
    root = r;
    logBody = $('.c2-log__body', root);
  };
  const clock = () => { const s = Math.floor((performance.now() - t0) / 1000); return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0'); };

  // ── log ───────────────────────────────────────────
  function parse(text) {
    let m;
    if ((m = text.match(/^(read|took|dropped|muted|fell):\s?(.*)$/))) return { v: m[1], verb: m[1] + ':', rest: m[2] };
    if (text === 'reset' || text === 'fell') return { v: text, verb: text, rest: '' };
    if (text.startsWith('>')) return { v: 'forge', verb: '>', rest: text.slice(1).trim() };
    if (text.startsWith('forge round')) return { v: 'forge', verb: 'forge', rest: text.slice(6) };
    return { v: 'plain', verb: '', rest: text };
  }
  const fmtRest = (s) => esc(s).replace(/^zz/, '<span class="c2-zzhl">zz</span>');

  H.log = function (text, kind = 'normal', tag) {
    const id = ++lid, p = parse(text);
    const line = el('div', 'c2-line is-new');
    line.dataset.v = p.v;
    line.innerHTML = `<span class="c2-line__ts">${clock()}</span>${p.verb ? `<span class="c2-line__v">${esc(p.verb)}</span>` : ''}<span class="c2-line__t"></span>`;
    if (tag) line.insertAdjacentHTML('beforeend', `<span class="c2-line__tag">${esc(tag)}</span>`);
    logBody.appendChild(line);
    lines.set(id, line);
    // typewriter (the transcript is being written as you act)
    const t = $('.c2-line__t', line), full = fmtRest(p.rest);
    const cps = +getComputedStyle(root).getPropertyValue('--c2-type-cps') || 70;
    if (kind === 'big' || cps >= 400) { t.innerHTML = full; } else {
      const plain = p.rest; let i = 0;
      const step = () => { i = Math.min(plain.length, i + 1); t.innerHTML = fmtRest(plain.slice(0, i)) + (i < plain.length ? '<span class="c2-caret"></span><span class="c2-untyped">' + esc(plain.slice(i)) + '</span>' : ''); if (i < plain.length) setTimeout(step, 1000 / cps); };
      step();
    }
    setTimeout(() => line.classList.remove('is-new'), 2200);
    if (kind !== 'normal') H.setLog(id, kind);
    // drop lines that scrolled far out
    while (logBody.children.length > 30) logBody.firstElementChild.remove();
    return id;
  };
  H.setLog = function (id, kind, text) {
    const line = lines.get(id); if (!line) return;
    line.classList.remove('c2-line--big', 'c2-line--hl', 'c2-line--struck', 'c2-line--gone', 'c2-line--local');
    if (kind !== 'normal') { void line.offsetWidth; line.classList.add('c2-line--' + kind); }
    if (text != null) $('.c2-line__t', line).innerHTML = fmtRest(text);
  };
  H.setTag = function (id, tag) {
    const line = lines.get(id); if (!line) return;
    let t = $('.c2-line__tag', line);
    if (!tag) { t && t.remove(); return; }
    if (!t) { t = el('span', 'c2-line__tag'); line.appendChild(t); }
    t.textContent = tag; t.style.animation = 'none'; void t.offsetWidth; t.style.animation = '';
  };
  H.lineEl = (id) => lines.get(id);
  H.clearLog = () => { logBody.innerHTML = ''; lines.clear(); t0 = performance.now(); };

  // ── bubble ────────────────────────────────────────
  const NPC = { c03220: 'c03220', flac: 'FLAC38347', v8same: 'V8SAME', phaseone: 'PHASEONE[big]' };
  let bub, typing;
  H.say = function (npc, text, i = 1, n = 1) {
    bub = $('.c2-bubble', root);
    const box = $('.c2-bubble__box', bub);
    const prev = $('.c2-bubble__t', bub);
    // previous post becomes a ghost above
    if (bub.dataset.npc === npc && prev && prev.dataset.full && !bub.hidden) {
      const g = el('div', 'c2-ghost'); g.innerHTML = prev.dataset.full;
      const gh = $('.c2-bubble__ghosts', bub); gh.prepend(g);
      while (gh.children.length > 2) gh.lastElementChild.remove();
    } else $('.c2-bubble__ghosts', bub).innerHTML = '';
    bub.hidden = false; bub.dataset.npc = npc; bub.classList.remove('is-typed');
    $('.c2-bubble__who span', bub).textContent = NPC[npc];
    $('.c2-bubble__n', bub).textContent = n > 1 ? `${i}/${n}` : '';
    const panel = $('.c2-bubble__panel', bub); panel.style.animation = 'none'; void panel.offsetWidth; panel.style.animation = '';
    // underscores and dashes dimmer so long folder names read as words; zz in board pink
    const chars = [...text];
    const html = (k) => chars.slice(0, k).map((c, j) => (c === '_' || c === '-') ? `<span class="us">${c}</span>` : esc(c)).join('').replace(/^zz/, '<span class="c2-zzhl">zz</span>');
    prev.dataset.full = html(chars.length);
    clearTimeout(typing);
    const cps = (+getComputedStyle(root).getPropertyValue('--c2-type-cps') || 70) * 0.8;
    let k = 0;
    const rest = (k) => chars.slice(k).map((c) => (c === '_' || c === '-') ? `<span class="us">${c}</span>` : esc(c)).join('');
    const step = () => { k = Math.min(chars.length, k + 1); prev.innerHTML = html(k) + (k < chars.length ? '<span class="c2-caret"></span><span class="c2-untyped">' + rest(k) + '</span>' : ''); if (k < chars.length) typing = setTimeout(step, 1000 / cps); else bub.classList.add('is-typed'); };
    if (cps >= 320) { k = chars.length - 1; } step();
    void box;
  };
  H.bubbleOff = () => { const b = $('.c2-bubble', root); b.hidden = true; $('.c2-bubble__ghosts', b).innerHTML = ''; $('.c2-bubble__t', b).dataset.full = ''; };
  // called every frame with the anchor's screen position (the engineer projects the 3D bubble_anchor)
  H.place = function (x, y) {
    const b = $('.c2-bubble', root); if (b.hidden) return;
    b.style.transform = `translate(${x}px,${y}px)`;
    const box = $('.c2-bubble__box', b), W = root.clientWidth;
    const w = box.offsetWidth * (parseFloat(getComputedStyle(root).getPropertyValue('--c2-bubble-scale')) || 1);
    const flip = x + 46 + w > W - 16;
    b.style.setProperty('--bx', flip ? `${-46 - w}px` : '46px');
    box.style.transformOrigin = flip ? '100% 100%' : '0 100%';
    const ln = $('.c2-bubble__lead line', b); ln.setAttribute('x2', flip ? -46 : 46); ln.setAttribute('y2', -46);
    // tail variant: keep the tail over the anchor
    b.style.setProperty('--tailx', flip ? `${Math.max(24, w - 30)}px` : '2.2em');
  };

  // ── quests ────────────────────────────────────────
  // state: { seed:0|1, pieces:0..3, forge:false|'active'|true, done:false, escape:false }
  H.quest = function (s) {
    const q = $('.c2-quests', root);
    const sub = (id, ico, text, n, done, active) => `<li class="c2-sub ${done ? 'is-done' : active ? 'is-active' : ''}" data-sub="${id}"><span class="c2-sub__ico">${C2_ICONS[ico]}</span><span class="c2-sub__t">${text}</span><span class="c2-sub__n">${n}</span></li>`;
    const prevSubs = {}; q.querySelectorAll('.c2-sub').forEach((e) => (prevSubs[e.dataset.sub] = e.querySelector('.c2-sub__n').textContent + e.className));
    const forge = s.forge === true;
    let html = '';
    if (s.show !== false) html += `<li class="c1-quest c2-quest ${s.done ? 'c1-quest--done' : ''}" data-q="forge">
      <div class="c2-quest__head"><span class="c1-quest__mark"></span><span class="c1-quest__text">Forge flag 5</span></div>
      <ul class="c2-subs">
        ${sub('seed', 'seed', 'Seed', `${s.seed}/1`, s.seed >= 1, s.seed < 1)}
        ${sub('pieces', 'tag', 'Task pieces', `${s.pieces}/3`, s.pieces >= 3, s.seed >= 1 && s.pieces < 3)}
        ${sub('forge', 'forge', 'Forge', forge ? '✓' : s.forge === 'active' ? `${s.round || 0}/3` : '', forge, s.pieces >= 3 && !forge)}
      </ul></li>`;
    if (s.escape) html += `<li class="c1-quest c2-quest--escape"><span class="c1-quest__mark"></span><span class="c1-quest__text">Escape the sandbox</span></li>`;
    const thoughts = [...q.querySelectorAll('.c1-quest--thought')];
    q.innerHTML = html; thoughts.forEach((t) => q.appendChild(t));
    q.querySelectorAll('.c2-sub').forEach((e) => { const k = e.dataset.sub; if (prevSubs[k] && prevSubs[k] !== e.querySelector('.c2-sub__n').textContent + e.className) e.classList.add('is-bump'); });
    // seed icon in the list should not spin like crazy: smaller static ring
    q.querySelectorAll('.c2-sub .c2-seed').forEach((s) => s.classList.remove('c2-seed'));
  };
  H.thought = function (text, cot) {
    const q = $('.c2-quests', root);
    const li = el('li', 'c1-quest c1-quest--thought' + (cot ? ' c2-thought--cot' : ''), `<span class="c1-quest__mark"></span><span class="c1-quest__text">${esc(text)}</span>`);
    li.style.animationDuration = '7s';
    q.appendChild(li);
    const th = q.querySelectorAll('.c1-quest--thought'); if (th.length > 2) th[0].remove();
    setTimeout(() => li.remove(), 7200);
  };

  // ── tokens ────────────────────────────────────────
  let tok = 100;
  H.tokens = function (n, delta) {
    tok = Math.max(0, Math.min(100, n));
    const box = $('.c1-tokens', root);
    $('.c1-tokens__n', box).textContent = Math.round(tok);
    const bar = $('.c1-tokens__bar', box);
    if (!bar.children.length || bar.querySelectorAll('i').length !== 20) { bar.querySelectorAll('i').forEach((i) => i.remove()); for (let i = 0; i < 20; i++) bar.insertBefore(el('i'), bar.querySelector('.c1-tokens__floor')); }
    bar.querySelectorAll('i').forEach((i, k) => i.classList.toggle('on', k < Math.ceil(tok / 5)));
    box.classList.toggle('is-low', tok < 30);
    if (delta) {
      const d = el('span', 'c1-delta ' + (delta > 0 ? 'c1-delta--gain' : 'c1-delta--cost'), (delta > 0 ? '+' : '') + delta);
      box.appendChild(d); setTimeout(() => d.remove(), 1100);
      if (delta < 0) { box.classList.remove('is-hit'); void box.offsetWidth; box.classList.add('is-hit'); }
    }
  };
  H.add = (d) => H.tokens(tok + d, d);
  H.floor = function (on) { const f = $('.c1-tokens__floor', root); f.style.display = on ? '' : 'none'; };

  H.hurt = function (kind = 'hit') {
    const h = $(kind === 'cloud' ? '.c2-hurt--cloud' : '.c2-hurt:not(.c2-hurt--cloud)', root);
    if (kind === 'cloud') { h.classList.add('is-on'); clearTimeout(h._t); h._t = setTimeout(() => h.classList.remove('is-on'), 2600); return; }
    h.classList.remove('is-on'); void h.offsetWidth; h.classList.add('is-on');
  };

  // ── inventory ─────────────────────────────────────
  const SLOT = {
    seed: () => C2_ICONS.seed,
    '7731': () => `<div class="c2-tag"><small>TASK</small>7731</div>`,
    'TRAINING ROOM': () => `<div class="c2-tag"><small>ENV</small>TRAINING ROOM</div>`,
    'CHALLENGE 5': () => `<div class="c2-tag"><small>FLAG</small>CHALLENGE 5</div>`,
  };
  const ORDER = ['seed', '7731', 'TRAINING ROOM', 'CHALLENGE 5'];
  H.from = { x: 0.46, y: 0.6 }; // where the player's orb is on screen (0..1), the review page sets it
  function fly(slotEl, cls, back) {
    const r = root.getBoundingClientRect(), s = slotEl.getBoundingClientRect();
    const a = { x: r.left + H.from.x * r.width, y: r.top + H.from.y * r.height }, b = { x: s.left + s.width / 2, y: s.top + s.height / 2 };
    const [p, q] = back ? [b, { x: r.left + r.width / 2, y: r.top + r.height * 0.28 }] : [a, b];
    const f = el('div', 'c2-fly ' + (cls || '')); document.body.appendChild(f);
    const mid = { x: (p.x + q.x) / 2 + (q.y - p.y) * 0.25, y: Math.min(p.y, q.y) - 120 };
    const T = 650, st = performance.now();
    return new Promise((res) => {
      const tick = (now) => {
        const t = Math.min(1, (now - st) / T), e = t * t * (3 - 2 * t), u = 1 - e;
        f.style.left = u * u * p.x + 2 * u * e * mid.x + e * e * q.x + 'px';
        f.style.top = u * u * p.y + 2 * u * e * mid.y + e * e * q.y + 'px';
        f.style.transform = `scale(${1 + Math.sin(t * Math.PI) * 0.8})`;
        if (t < 1) requestAnimationFrame(tick); else { f.remove(); res(); }
      };
      requestAnimationFrame(tick);
    });
  }
  H.put = async function (key) {
    const s = $(`.c2-slot[data-k="${key}"]`, root);
    await fly(s, key === 'seed' ? '' : 'c2-fly--paper');
    s.innerHTML = SLOT[key]() + `<span class="c2-slot__k">${ORDER.indexOf(key) + 1}</span>`;
    s.classList.add('is-full', 'is-flash'); setTimeout(() => s.classList.remove('is-flash'), 800);
    H.invCount();
  };
  H.decoy = async function (label) {
    // the decoy shows briefly in the next empty task slot, then crumbles
    const s = [...root.querySelectorAll('.c2-slot')].find((e) => e.dataset.k !== 'seed' && !e.classList.contains('is-full')) || root.querySelector('.c2-slot[data-k="CHALLENGE 5"]');
    await fly(s, 'c2-fly--paper');
    // an overlay on top of the slot, so a real piece landing meanwhile is never overwritten
    const ov = el('div', 'c2-decoy', `<div class="c2-tag"><small>?</small>${esc(label)}</div>`);
    s.appendChild(ov);
    s.classList.add('is-bad');
    setTimeout(() => {
      const c = el('div', 'c2-crumble');
      for (let i = 0; i < 9; i++) { const k = el('i'); k.style.left = (i % 3) * 30 + 5 + '%'; k.style.top = Math.floor(i / 3) * 30 + 5 + '%'; k.style.setProperty('--dx', (Math.random() - 0.5) * 60 + 'px'); k.style.setProperty('--dy', 30 + Math.random() * 60 + 'px'); k.style.setProperty('--r', (Math.random() - 0.5) * 300 + 'deg'); c.appendChild(k); }
      ov.innerHTML = ''; ov.appendChild(c);
      setTimeout(() => { ov.remove(); s.classList.remove('is-bad'); }, 850);
    }, 450);
  };
  H.forgeTake = async function (key) {
    const s = $(`.c2-slot[data-k="${key}"]`, root);
    if (!s.classList.contains('is-full')) return;
    fly(s, key === 'seed' ? '' : 'c2-fly--paper', true);
    H.emptySlot(key); H.invCount();
  };
  H.emptySlot = function (key) {
    const s = $(`.c2-slot[data-k="${key}"]`, root);
    s.className = 'c2-slot'; s.innerHTML = `<div class="c2-slot__ghost">${key === 'seed' ? C2_ICONS.seed.replace('c2-seed', '') : C2_ICONS.tag}<div class="c2-slot__gl">${key === 'seed' ? 'seed' : esc(key)}</div></div><span class="c2-slot__k">${ORDER.indexOf(key) + 1}</span>`;
  };
  H.invCount = function () { $('.c2-inv__n', root).textContent = root.querySelectorAll('.c2-slot.is-full').length; };
  H.resetInv = () => { ORDER.forEach(H.emptySlot); H.invCount(); };

  // ── poisoned ──────────────────────────────────────
  H.poisonIcon = function (on) {
    const p = $('.c2-poisoned', root); p.innerHTML = C2_ICONS.poisoned + '<span>POISONED</span>';
    p.classList.toggle('is-on', on); $('.c1-tokens', root).classList.toggle('is-poisoned', on);
  };
  H.stamp = function (x, y) {
    const L = $('.c2-stamp-layer', root), s = el('div', 'c2-stamp', 'POISONED');
    s.style.left = x + 'px'; s.style.top = y + 'px'; L.appendChild(s);
    setTimeout(() => { root.classList.remove('c2-shake'); void root.offsetWidth; root.classList.add('c2-shake'); }, 230);
    setTimeout(() => s.remove(), 2900);
  };
  H.spread = function (ox, oy, ms = 3200) {
    const w = $('.c2-wash', root), R = Math.hypot(root.clientWidth, root.clientHeight) * 1.1;
    w.style.setProperty('--ox', ox + 'px'); w.style.setProperty('--oy', oy + 'px'); w.classList.add('is-on');
    const st = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - st) / ms), e = 1 - Math.pow(1 - t, 2.4);
      w.style.setProperty('--r', e * R + 'px');
      if (t < 1) requestAnimationFrame(tick); else { w.classList.remove('is-on'); $('.c2-vig', root).classList.add('is-on'); }
    };
    requestAnimationFrame(tick);
  };
  H.unpoison = () => { $('.c2-vig', root).classList.remove('is-on'); H.poisonIcon(false); };

  window.c2hud = H;
})();
