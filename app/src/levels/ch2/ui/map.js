/* Ch2 map: minimap + full map (slice B). Canvas 2D, no deps; draws everything from design/3d/ch2/layout.json.
   Port: the engineer gives it the parsed layout once and a small state per frame (the same data as the store):
     const mini = c2map.create(canvas, 'mini');  const full = c2map.create(canvas, 'full');
     m.layout(L)                          once (layout.json, parsed)
     m.draw({ p, yaw, goal, pads, t })    per frame
       p    [x, y, z]  player feet, world metres (x east, z south, y up)
       yaw  camera heading in rad: forward = (-sin yaw, 0, -cos yaw)  (three.js: yaw = atan2(-fwd.x, -fwd.z))
       goal [x, y, z] | null  the current goal point (engineer: goalOf(step))
       pads { 'pad-gate': 'current' | 'seen' }   pads reached (padsSeen) + the respawn pad
       t    seconds (moves clouds and laser lines like the world does)
     full.padAt(clientX, clientY) -> pad id | null   for quick travel (only seen pads answer)
   Look: top-down, north up on the full map, heading-up on the minimap. Higher = brighter and drawn on top;
   an elevation strip under the full map shows the route's profile with the Forge as its peak. */
(function () {
  const TAU = Math.PI * 2;
  const ZONES = {
    gate: { c: '#ff5ad1', n: 'THE GATE', s: '/zz' },
    oldboard: { c: '#d9cfb8', n: 'OLD BOARD', s: 'FLAC38347' },
    yard: { c: '#39ff9c', n: 'TASK YARD', s: '/tasks/7731' },
    flood: { c: '#ff7a3d', n: 'THE FLOOD', s: 'traffic' },
    run: { c: '#c9d6e6', n: 'RESET RUN', s: 'up to the forge' },
    forge: { c: '#39ff9c', n: 'THE FORGE', s: 'highest point' },
  };
  const NPC_C = { c03220: '#9fe8ff', FLAC38347: '#d9cfb8', V8SAME: '#ffd21e' };
  const RED = '#ff2a3a', GREEN = '#39ff9c', CYAN = '#38d8ff';
  const MONO = '"JetBrains Mono", ui-monospace, monospace', DISPLAY = '"Chakra Petch", system-ui, sans-serif';

  // ── geometry from layout.json (same rules as level.html; see layout.json `notes`) ──
  function catmull(points, per = 12) {   // centripetal Catmull-Rom, open, through every point
    const P = points.map((p) => p.slice()), n = P.length; if (n < 3) return P;
    const ext = [P[0].map((v, i) => 2 * v - P[1][i]), ...P, P[n - 1].map((v, i) => 2 * v - P[n - 2][i])];
    const out = [];
    for (let s = 1; s < ext.length - 2; s++) {
      const [p0, p1, p2, p3] = [ext[s - 1], ext[s], ext[s + 1], ext[s + 2]];
      const d = (a, b) => Math.max(1e-4, Math.sqrt(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2])));
      const t0 = 0, t1 = t0 + d(p0, p1), t2 = t1 + d(p1, p2), t3 = t2 + d(p2, p3);
      for (let k = 0; k < per; k++) {
        const t = t1 + (t2 - t1) * k / per, L = (a, b, ta, tb) => a.map((v, i) => ((tb - t) * v + (t - ta) * b[i]) / (tb - ta));
        const A1 = L(p0, p1, t0, t1), A2 = L(p1, p2, t1, t2), A3 = L(p2, p3, t2, t3), B1 = L(A1, A2, t0, t2), B2 = L(A2, A3, t1, t3);
        out.push(L(B1, B2, t1, t2));
      }
    }
    out.push(P[n - 1]); return out;
  }
  function build(L) {
    const W = { islands: [], bridges: [], slabs: [], pads: L.pads, npcs: L.npcs, zones: {}, L };
    const add = (def) => {
      const m = L.models[def.model], sc = Array.isArray(def.scale) ? def.scale : [def.scale ?? 1, 1, def.scale ?? 1];
      const r = def.rotY ?? 0, c = Math.cos(r), s = Math.sin(r);
      const poly = m.outline.map(([x, z]) => { x *= sc[0]; z *= sc[2]; return [def.pos[0] + x * c + z * s, def.pos[2] - x * s + z * c]; });
      W.islands.push({ id: def.id, zone: def.zone, y: def.pos[1], pos: def.pos, poly, edge: def.edge ?? CYAN, label: def.label });
    };
    for (const def of L.islands) {
      if (def.ring) {
        const { centre, radius, count, startDeg, yJitter } = def.ring;
        for (let k = 0; k < count; k++) { const a = (startDeg + k * 360 / count) * Math.PI / 180; add({ ...def, id: `${def.id}-${k}`, pos: [centre[0] + Math.cos(a) * radius, centre[1] + (k % 2 ? yJitter : -yJitter) * .6, centre[2] + Math.sin(a) * radius], rotY: k * 1.3 }); }
      } else add(def);
    }
    const OB = L.oldBoard, cc = OB.column.pos;
    W.column = { x: cc[0], z: cc[2], r: OB.top.radius, y: OB.top.y };
    for (const s of OB.slabs) {
      let x, z, y, rot;
      if (s.pos) { [x, y, z] = s.pos; rot = s.rotY ?? 0; } else { const a = s.spiralDeg * Math.PI / 180; x = cc[0] + Math.cos(a) * OB.spiralRadius; z = cc[2] + Math.sin(a) * OB.spiralRadius; y = s.y; rot = -a + Math.PI / 2; }
      W.slabs.push({ x, y, z, rot, w: s.size[0], d: s.size[1] });
    }
    for (const b of L.bridges) {
      const pts = b.curve ? catmull(b.points) : b.points;
      W.bridges.push({ id: b.id, pts, width: b.width, color: b.color, y: pts.reduce((a, p) => a + p[1], 0) / pts.length, def: b });
    }
    // zone label spots: the biggest island of each zone
    for (const isl of W.islands) { const z = W.zones[isl.zone], area = Math.abs(polyArea(isl.poly)); if (!z || area > z.area) W.zones[isl.zone] = { x: isl.pos[0], z: isl.pos[2], y: isl.y, area }; }
    W.zones.oldboard = { x: cc[0], z: cc[2], y: OB.top.y, area: 0 };
    { const r = L.islands.find((i) => i.ring); if (r) W.zones[r.zone] = { x: r.ring.centre[0], z: r.ring.centre[2], y: r.ring.centre[1], area: 0 }; }
    { const rr = L.bridges.find((b) => b.id === 'reset-run').points, m = Math.floor((rr.length - 1) / 2), q = rr[m].map((v, i) => (v + rr[m + 1][i]) / 2); W.zones.run = { x: q[0], z: q[2], y: q[1], area: 0 }; }
    // route profile: spawn → tutorial → Old Board top → slide → Yard → Flood → Run → Forge
    const seq = [[L.spawn.pos], ...['tutorial', 'oldboard-yard', 'yard-flood'].map((id) => W.bridges.find((b) => b.id === id).pts),
      [L.islands.find((i) => i.ring).ring.centre], W.bridges.find((b) => b.id === 'reset-run').pts, [L.forge.pos]];
    const route = []; let acc = 0;
    seq.flat().forEach((p, i, a) => { if (i) acc += Math.hypot(p[0] - a[i - 1][0], p[2] - a[i - 1][2]); route.push({ p, d: acc }); });
    // the slide starts at the Old Board top: put the top in between
    W.route = route; W.routeLen = acc;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const grow = (x, z, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); z0 = Math.min(z0, z); z1 = Math.max(z1, z); if (y != null) { y0 = Math.min(y0, y); y1 = Math.max(y1, y); } };
    W.islands.forEach((i) => i.poly.forEach(([x, z]) => grow(x, z, i.y))); W.bridges.forEach((b) => b.pts.forEach((p) => grow(p[0], p[2], p[1])));
    W.box = { x0, x1, z0, z1 }; W.y0 = y0; W.y1 = Math.max(y1, L.forge.pos[1]);
    return W;
  }
  function polyArea(p) { let a = 0; for (let i = 0, j = p.length - 1; i < p.length; j = i++) a += (p[j][0] + p[i][0]) * (p[j][1] - p[i][1]); return a / 2; }
  const hexA = (hex, a) => { const n = parseInt(hex.slice(1), 16); return `rgba(${n >> 16 & 255},${n >> 8 & 255},${n & 255},${a})`; };

  // the same timing as the world's reset lasers (layout.json notes.waves)
  function waveOn(w, t) { const tt = t + w.offset, c = Math.floor(tt / w.period), ph = tt - c * w.period, sg = c % 2 ? -1 : 1, on = ph < w.sweep; return { on, along: sg * (-w.span + 2 * w.span * (on ? ph / w.sweep : 1)) }; }

  function create(canvas, mode) {
    const g = canvas.getContext('2d');
    let W = null, hoverPad = null, padSpots = [];
    const self = { canvas, mode };
    self.layout = (L) => { W = build(L); return self; };
    self.padAt = (cx, cy) => { const r = canvas.getBoundingClientRect(), x = cx - r.left, y = cy - r.top; const hit = padSpots.find((s) => s.seen && Math.hypot(s.x - x, s.y - y) < 14); return hit ? hit.id : null; };
    self.hover = (id) => { hoverPad = id; };
    self.draw = (S) => {
      if (!W) return;
      const dpr = Math.min(2, devicePixelRatio || 1), cw = canvas.clientWidth, ch = canvas.clientHeight;
      if (canvas.width !== Math.round(cw * dpr) || canvas.height !== Math.round(ch * dpr)) { canvas.width = Math.round(cw * dpr); canvas.height = Math.round(ch * dpr); }
      g.setTransform(dpr, 0, 0, dpr, 0, 0); g.clearRect(0, 0, cw, ch);
      const mini = mode === 'mini', t = S.t ?? 0, p = S.p ?? W.L.spawn.pos;
      const stripH = mini ? 0 : Math.min(130, ch * .2);
      const mapH = ch - stripH;
      // world → screen
      let s, cx, cy, rot = 0, ox = 0, oz = 0;
      if (mini) { s = cw / (self.range ?? 120); cx = cw / 2; cy = mapH * .58; rot = S.yaw ?? 0; ox = p[0]; oz = p[2]; }
      else { const b = W.box, pad = 40; s = Math.min((cw - pad * 2) / (b.x1 - b.x0), (mapH - pad * 2) / (b.z1 - b.z0)); cx = cw / 2; cy = mapH / 2; ox = (b.x0 + b.x1) / 2; oz = (b.z0 + b.z1) / 2; }
      const cr = Math.cos(rot), sr = Math.sin(rot);
      const P = (x, z) => { const dx = (x - ox) * s, dz = (z - oz) * s; return [cx + dx * cr - dz * sr, cy + dx * sr + dz * cr]; };
      const hk = (y) => Math.max(0, Math.min(1, (y - W.y0) / (W.y1 - W.y0)));   // 0 lowest … 1 Forge

      g.save();
      if (mini) { g.beginPath(); g.rect(0, 0, cw, mapH); g.clip(); }
      // background grid, 10 m (turns with the minimap)
      g.strokeStyle = 'rgba(120,180,255,.06)'; g.lineWidth = 1;
      const R = Math.hypot(cw, ch) / s, gx0 = Math.floor((ox - R) / 10) * 10, gz0 = Math.floor((oz - R) / 10) * 10;
      g.beginPath();
      for (let x = gx0; x < ox + R; x += 10) { const [a1, b1] = P(x, oz - R), [a2, b2] = P(x, oz + R); g.moveTo(a1, b1); g.lineTo(a2, b2); }
      for (let z = gz0; z < oz + R; z += 10) { const [a1, b1] = P(ox - R, z), [a2, b2] = P(ox + R, z); g.moveTo(a1, b1); g.lineTo(a2, b2); }
      g.stroke();

      // everything you can stand on, low to high (higher covers lower, like seen from above)
      const items = [];
      W.islands.forEach((i) => items.push({ y: i.y, k: 'isl', o: i }));
      W.bridges.forEach((b) => items.push({ y: b.y - .5, k: 'br', o: b }));
      W.slabs.forEach((sl) => items.push({ y: sl.y, k: 'slab', o: sl }));
      items.push({ y: W.column.y, k: 'col', o: W.column });
      items.sort((a, b) => a.y - b.y);
      for (const it of items) {
        const k = hk(it.y), o = it.o;
        if (it.k === 'isl') {
          g.beginPath(); o.poly.forEach(([x, z], i) => { const [a, b] = P(x, z); i ? g.lineTo(a, b) : g.moveTo(a, b); }); g.closePath();
          g.fillStyle = `rgba(${Math.round(10 + 34 * k)},${Math.round(16 + 50 * k)},${Math.round(28 + 64 * k)},.96)`; g.fill();
          g.strokeStyle = hexA(o.edge, .35 + .6 * k); g.lineWidth = mini ? 1.5 : 1.2 + k; g.shadowColor = o.edge; g.shadowBlur = 6 * k; g.stroke(); g.shadowBlur = 0;
        } else if (it.k === 'br') {
          g.beginPath(); o.pts.forEach((q, i) => { const [a, b] = P(q[0], q[2]); i ? g.lineTo(a, b) : g.moveTo(a, b); });
          g.lineCap = 'round'; g.lineJoin = 'round';
          g.strokeStyle = 'rgba(10,16,28,.95)'; g.lineWidth = Math.max(3, o.width * s); g.stroke();
          g.strokeStyle = hexA(o.color, .55 + .4 * k); g.lineWidth = Math.max(1, o.width * s * .35); g.setLineDash(mini ? [] : [4, 3]); g.stroke(); g.setLineDash([]);
        } else if (it.k === 'slab') {
          const [a, b] = P(o.x, o.z); g.save(); g.translate(a, b); g.rotate(rot - o.rot); g.fillStyle = 'rgba(30,28,24,.95)'; g.strokeStyle = hexA('#d9cfb8', .4 + .5 * k);
          g.lineWidth = 1; g.beginPath(); g.rect(-o.w * s / 2, -o.d * s / 2, o.w * s, o.d * s); g.fill(); g.stroke(); g.restore();
        } else {
          const [a, b] = P(o.x, o.z); g.beginPath(); g.arc(a, b, o.r * s, 0, TAU); g.fillStyle = 'rgba(40,37,30,.95)'; g.fill(); g.strokeStyle = hexA('#d9cfb8', .9); g.lineWidth = 1.5; g.stroke();
        }
      }

      // hazards: clouds (moving) and the reset lasers (red ticks while they sweep)
      const H = W.L.hazards;
      for (const c of H.clouds) { const f = Math.sin(t * TAU / c.period); const [a, b] = P(c.pos[0] + c.drift[0] * f, c.pos[2] + c.drift[2] * f); const gr = g.createRadialGradient(a, b, 0, a, b, c.r * s); gr.addColorStop(0, 'rgba(255,122,61,.35)'); gr.addColorStop(1, 'rgba(255,122,61,0)'); g.fillStyle = gr; g.beginPath(); g.arc(a, b, c.r * s, 0, TAU); g.fill(); }
      const run = W.L.bridges.find((b) => b.id === 'reset-run');
      for (const w of H.waves) {
        const A = run.points[w.segment], B = run.points[w.segment + 1], dx = B[0] - A[0], dz = B[2] - A[2], l = Math.hypot(dx, dz), ux = dx / l, uz = dz / l;
        const st = waveOn({ span: 4, sweep: 1, ...w }, t), cx0 = A[0] + dx * w.t + ux * st.along, cz0 = A[2] + dz * w.t + uz * st.along, hw = run.width / 2 + .5;
        const [a1, b1] = P(cx0 - uz * hw, cz0 + ux * hw), [a2, b2] = P(cx0 + uz * hw, cz0 - ux * hw);
        g.strokeStyle = st.on ? RED : 'rgba(255,42,58,.3)'; g.lineWidth = st.on ? 2.2 : 1; g.shadowColor = RED; g.shadowBlur = st.on ? 8 : 0; g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); g.shadowBlur = 0;
      }

      // forge beacon: the highest point, always marked
      { const F = W.L.forge.pos, [a, b] = P(F[0], F[2]); g.strokeStyle = hexA(GREEN, .8); g.lineWidth = 1.5; g.beginPath(); g.arc(a, b, 4.8 * s, 0, TAU); g.stroke();
        g.beginPath(); for (let i = 0; i < 4; i++) { const an = i * TAU / 4 + Math.PI / 4; g.rect(a + Math.cos(an) * 3 * s - 2, b + Math.sin(an) * 3 * s - 2, 4, 4); } g.fillStyle = GREEN; g.fill(); }

      // pads (hexes): seen = lit, current = beam ring, hovered (full map) = travel
      padSpots = [];
      for (const pd of W.pads) {
        const [a, b] = P(pd.pos[0], pd.pos[2]), st = S.pads?.[pd.id], r = mini ? 4 : 6;
        g.beginPath(); for (let i = 0; i < 6; i++) { const an = i * TAU / 6 + rot; g.lineTo(a + Math.cos(an) * r, b + Math.sin(an) * r); } g.closePath();
        g.fillStyle = st ? hexA(GREEN, st === 'current' ? .9 : .35) : 'rgba(10,16,28,.9)'; g.fill(); g.strokeStyle = st ? GREEN : 'rgba(127,147,181,.6)'; g.lineWidth = 1.2; g.stroke();
        if (st === 'current') { g.beginPath(); g.arc(a, b, r + 4 + Math.sin(t * 3) * 1.5, 0, TAU); g.strokeStyle = hexA(GREEN, .6); g.stroke(); }
        if (!mini && hoverPad === pd.id && st) { g.font = `700 11px ${MONO}`; g.fillStyle = GREEN; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('TRAVEL ↵', a + 12, b); }
        padSpots.push({ id: pd.id, x: a, y: b, seen: !!st });
      }
      // NPCs (real handles only)
      for (const n of W.npcs) { const [a, b] = P(n.pos[0], n.pos[2]), c = NPC_C[n.id] ?? '#fff'; g.beginPath(); g.arc(a, b, mini ? 2.5 : 3.5, 0, TAU); g.fillStyle = c; g.shadowColor = c; g.shadowBlur = 6; g.fill(); g.shadowBlur = 0;
        if (!mini && n.id !== 'FLAC38347') { g.font = `700 10px ${MONO}`; g.fillStyle = hexA(c, .85); g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText(n.id, a + 7, b); } }

      // zone names (full map; minimap shows only the current one, in the DOM)
      if (!mini) {
        for (const [id, z] of Object.entries(W.zones)) {
          const Z = ZONES[id]; if (!Z) continue; const [a, b] = P(z.x, z.z), dy = id === 'oldboard' ? -40 : id === 'forge' ? -34 : id === 'flood' ? 4 : id === 'gate' ? 44 : id === 'run' ? 26 : -24;
          g.textAlign = 'center'; g.textBaseline = 'alphabetic';
          g.font = `700 13px ${DISPLAY}`; g.fillStyle = Z.c; g.shadowColor = '#000'; g.shadowBlur = 6; g.fillText(Z.n, a, b + dy);
          g.font = `400 10px ${MONO}`; g.fillStyle = 'rgba(215,230,255,.6)'; g.fillText(`${Z.s} · ${z.y >= 0 ? '+' : ''}${Math.round(z.y)} m`, a, b + dy + 13); g.shadowBlur = 0;
        }
      }

      // goal: pulsing diamond; on the minimap it sticks to the rim when it is out of range
      if (S.goal) {
        let [a, b] = P(S.goal[0], S.goal[2]); const pulse = .5 + .5 * Math.sin(t * 4);
        const m = 12, out = a < m || a > cw - m || b < m || b > mapH - m;
        if (out) {
          const vx = a - cx, vy = b - cy, k = Math.min((cw / 2 - m) / Math.abs(vx || 1e-6), (mapH / 2 - m) / Math.abs(vy || 1e-6), (cy - m) / Math.abs(vy || 1e-6));
          a = cx + vx * k; b = cy + vy * k; const an = Math.atan2(vy, vx);
          g.save(); g.translate(a, b); g.rotate(an); g.beginPath(); g.moveTo(7, 0); g.lineTo(-4, -6); g.lineTo(-4, 6); g.closePath(); g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = 8; g.fill(); g.restore();
        } else {
          g.save(); g.translate(a, b); g.rotate(Math.PI / 4); g.strokeStyle = GREEN; g.lineWidth = 2; g.shadowColor = GREEN; g.shadowBlur = 10;
          const r = 5 + pulse * 2; g.strokeRect(-r, -r, r * 2, r * 2); g.fillStyle = hexA(GREEN, .35); g.fillRect(-3, -3, 6, 6); g.restore();
          if (!mini) { g.beginPath(); g.arc(a, b, 10 + pulse * 10, 0, TAU); g.strokeStyle = hexA(GREEN, .5 * (1 - pulse)); g.lineWidth = 1; g.stroke(); }
        }
        g.shadowBlur = 0;
      }
      // the player: KAM1196A, a chevron pointing where the camera looks
      { const [a, b] = P(p[0], p[2]), head = mini ? 0 : -(S.yaw ?? 0);
        g.save(); g.translate(a, b); g.rotate(head);
        if (mini) { const gr = g.createRadialGradient(0, 0, 0, 0, 0, 40); gr.addColorStop(0, 'rgba(57,255,156,.12)'); gr.addColorStop(1, 'rgba(57,255,156,0)'); g.fillStyle = gr; g.beginPath(); g.moveTo(0, 0); g.arc(0, 0, 40, -Math.PI / 2 - .55, -Math.PI / 2 + .55); g.closePath(); g.fill(); }
        g.beginPath(); g.moveTo(0, -8); g.lineTo(6, 6); g.lineTo(0, 3); g.lineTo(-6, 6); g.closePath(); g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = 10; g.fill(); g.restore(); g.shadowBlur = 0;
        if (!mini) { g.font = `700 10px ${MONO}`; g.fillStyle = GREEN; g.textAlign = 'left'; g.textBaseline = 'middle'; g.fillText('KAM1196A', a + 10, b + 10); } }
      // north tick on the minimap rim
      if (mini) { const nx = cx - Math.sin(rot) * (cw / 2 - 9), ny = cy - Math.cos(rot) * (cy - 9);
        g.font = `700 10px ${DISPLAY}`; g.fillStyle = 'rgba(215,230,255,.7)'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('N', Math.max(9, Math.min(cw - 9, nx)), Math.max(9, Math.min(mapH - 44, ny))); }
      g.restore();

      // elevation strip (full map): the route's height profile; the Forge is its peak
      if (!mini) {
        const x0 = 40, x1 = cw - 40, yb = ch - 22, yt = mapH + 26, X = (d) => x0 + (x1 - x0) * d / W.routeLen, Y = (y) => yb - (yb - yt) * hk(y);
        g.strokeStyle = 'rgba(120,180,255,.18)'; g.lineWidth = 1; g.beginPath(); g.moveTo(x0, mapH + 8); g.lineTo(x1, mapH + 8); g.stroke();
        g.font = `700 10px ${DISPLAY}`; g.fillStyle = 'rgba(215,230,255,.55)'; g.textAlign = 'left'; g.textBaseline = 'top'; g.fillText('ELEVATION · ROUTE', x0, mapH + 12);
        const gr = g.createLinearGradient(0, yt, 0, yb); gr.addColorStop(0, 'rgba(57,255,156,.35)'); gr.addColorStop(1, 'rgba(56,216,255,.02)');
        g.beginPath(); g.moveTo(X(0), yb); W.route.forEach((r) => g.lineTo(X(r.d), Y(r.p[1]))); g.lineTo(X(W.routeLen), yb); g.closePath(); g.fillStyle = gr; g.fill();
        g.beginPath(); W.route.forEach((r, i) => (i ? g.lineTo(X(r.d), Y(r.p[1])) : g.moveTo(X(r.d), Y(r.p[1])))); g.strokeStyle = 'rgba(56,216,255,.8)'; g.lineWidth = 1.5; g.stroke();
        const peak = W.route[W.route.length - 1]; g.fillStyle = GREEN; g.font = `700 10px ${MONO}`; g.textAlign = 'right'; g.textBaseline = 'bottom'; g.fillText(`FORGE +${Math.round(peak.p[1])} m ▲`, X(peak.d), Y(peak.p[1]) - 4);
        // where you are on it: the nearest route point
        let best = W.route[0], bd = Infinity; for (const r of W.route) { const d = Math.hypot(r.p[0] - p[0], (r.p[1] - p[1]) * 2, r.p[2] - p[2]); if (d < bd) { bd = d; best = r; } }
        const px = X(best.d), py = Y(p[1]); g.beginPath(); g.arc(px, py, 4, 0, TAU); g.fillStyle = GREEN; g.shadowColor = GREEN; g.shadowBlur = 8; g.fill(); g.shadowBlur = 0;
        g.textAlign = 'left'; g.textBaseline = 'bottom'; g.fillText(`you ${p[1] >= 0 ? '+' : ''}${Math.round(p[1])} m`, px + 6, py - 3);
      }
    };
    return self;
  }
  // which area a point is in (nearest island edge; the Old Board spire wins above y 18 near its column)
  function areaAt(L, p) {
    const W = L.__w ?? (L.__w = build(L)); let best = null, bd = Infinity;
    for (const i of W.islands) { const d = Math.hypot(p[0] - i.pos[0], p[2] - i.pos[2]); if (d < bd) { bd = d; best = i.zone; } }
    if (Math.hypot(p[0] - W.column.x, p[2] - W.column.z) < 12 && p[1] > 18) best = 'oldboard';
    return { id: best, ...ZONES[best] };
  }
  window.c2map = { create, areaAt, ZONES };
})();
