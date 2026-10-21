// DOM HUD + speed lines canvas.
import * as THREE from 'three';

const $ = id => document.getElementById(id);
const _p = new THREE.Vector3();

export function fmtTime(s) {
  const m = Math.floor(s / 60), r = s - m * 60;
  return `${m}:${r.toFixed(2).padStart(5, '0')}`;
}

export class Hud {
  constructor(game) {
    this.game = game;
    this.el = {
      timer: $('timer'), goal: $('goaldist'), traceFill: $('tracefill'), traceBox: $('trace'),
      speed: $('speed'), chain: $('chain'), cross: $('cross'), crossTxt: $('crosstxt'), hint: $('hint'),
      toast: $('toast'), marker: $('marker'), markerTxt: $('markertxt'), vignette: $('vignette'), lost: $('lost'),
      bracket: $('bracket'), sling: $('slingcue'),
    };
    this.fx = $('fx'); this.g2 = this.fx.getContext('2d');
    this.hintT = 0; this.toastT = 0; this.flashT = 0; this.chainT = 0;
    this.resize();
    addEventListener('resize', () => this.resize());
  }
  resize() { this.fx.width = innerWidth; this.fx.height = innerHeight; }
  hint(text, dur = 5) { this.el.hint.textContent = text; this.el.hint.classList.add('on'); this.hintT = dur; }
  clearHint() { this.hintT = 0; this.el.hint.classList.remove('on'); }
  toast(text, kind = '') {
    const t = this.el.toast;
    t.textContent = text; t.className = 'on ' + kind;
    void t.offsetWidth; t.classList.add('pop');
    this.toastT = 0.9;
  }
  chain(n) { this.el.chain.textContent = `CHAIN ×${n}`; this.el.chain.classList.add('on'); this.chainT = 2.5; }
  flash(kind) { this.flashT = 0.35; this.el.vignette.dataset.kind = kind; }
  setLost(on) { this.el.lost.classList.toggle('on', on); }

  update(dt, aim) {
    const g = this.game, p = g.player, e = this.el;
    e.timer.textContent = fmtTime(g.runTime);
    const dz = p.pos.distanceTo(g.world.corePos);
    e.goal.textContent = `${Math.round(dz)} m`;
    e.traceFill.style.width = `${g.trace}%`;
    e.traceBox.classList.toggle('hot', g.trace > 60);
    e.traceBox.classList.toggle('rise', g.traceRising > 0);
    e.speed.textContent = Math.round(p.speed);
    if (this.chainT > 0) { this.chainT -= dt; if (this.chainT <= 0 || p.chain < 2) e.chain.classList.remove('on'); }
    if (this.hintT > 0) { this.hintT -= dt; if (this.hintT <= 0) e.hint.classList.remove('on'); }
    if (this.toastT > 0) { this.toastT -= dt; if (this.toastT <= 0) e.toast.className = ''; }
    // crosshair state
    let cls = 'none', txt = '';
    const tt = aim.tether;
    if (tt) {
      if (tt.action === 'attach') cls = 'ok';
      else if (tt.action === 'core') cls = 'core';
      else if (tt.action === 'yank') cls = 'yank';
      else if (tt.action === 'deny') { cls = 'deny'; txt = 'NO RIGHTS'; }
      else if (tt.action === 'far') { cls = 'far'; txt = `${Math.round(tt.dist)} m`; }
    }
    if (p.attached && p.teth.inWin) cls += ' win';
    e.cross.className = cls;
    e.crossTxt.textContent = txt;
    e.bracket.classList.toggle('on', !!aim.laser);
    if (aim.laser) {
      const r = this.project(aim.laser.center);
      if (r) { e.bracket.style.left = r.x + 'px'; e.bracket.style.top = r.y + 'px'; }
    }
    e.sling.classList.toggle('on', !!(p.attached && p.teth.inWin));
    // next-target marker
    const tgt = g.nextTarget();
    if (tgt) {
      _p.copy(tgt.pos).project(g.camera);
      let x = _p.x, y = _p.y;
      const behind = _p.z > 1;
      if (behind) { x = -x; y = -y; }
      const inside = !behind && Math.abs(x) < 0.95 && Math.abs(y) < 0.9;
      if (!inside) { const m = Math.max(Math.abs(x) / 0.92, Math.abs(y) / 0.86); x /= m; y /= m; }
      e.marker.style.left = ((x + 1) / 2 * innerWidth) + 'px';
      e.marker.style.top = ((1 - y) / 2 * innerHeight) + 'px';
      e.marker.className = (inside ? 'on ' : 'on edge ') + tgt.kind;
      e.markerTxt.textContent = `${Math.round(p.pos.distanceTo(tgt.pos))}`;
    } else e.marker.className = '';
    // damage / trace vignette
    if (this.flashT > 0) this.flashT -= dt;
    e.vignette.style.opacity = Math.min(1, g.trace / 130 + Math.max(0, this.flashT) * 2);
    this.speedLines(p.speed, p.slingT);
  }
  project(v) {
    _p.copy(v).project(this.game.camera);
    if (_p.z > 1) return null;
    return { x: (_p.x + 1) / 2 * innerWidth, y: (1 - _p.y) / 2 * innerHeight };
  }
  speedLines(sp, sling) {
    const c = this.g2, w = this.fx.width, h = this.fx.height;
    c.clearRect(0, 0, w, h);
    const k = Math.min(1, Math.max(0, (sp - 26) / 50)) + sling * 0.6;
    if (k <= 0.02 || this.game.state !== 'play') return;
    const cx = w / 2, cy = h / 2, R = Math.hypot(cx, cy);
    c.lineWidth = 1.5;
    const n = Math.floor(18 + 40 * Math.min(1, k));
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      const r0 = R * (0.42 + Math.random() * 0.35);
      const len = R * (0.08 + Math.random() * 0.22) * Math.min(1.4, k + 0.2);
      const ca = Math.cos(a), sa = Math.sin(a);
      c.strokeStyle = sling > 0.1 ? `rgba(255,230,160,${0.25 * Math.min(1, k)})` : `rgba(200,255,225,${0.18 * Math.min(1, k)})`;
      c.beginPath(); c.moveTo(cx + ca * r0, cy + sa * r0); c.lineTo(cx + ca * (r0 + len), cy + sa * (r0 + len)); c.stroke();
    }
  }
}
