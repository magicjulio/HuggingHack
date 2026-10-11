/**
 * Start-screen canvas art, ported 1:1 from the designer's prototype
 * (handoff/design-to-app/assets/start-screen/start-screen.js). Plain canvas 2D, no React.
 * The in-game orb will be a Three.js shader; this 2D version is menu-only.
 */

/** Shared, mutable look state. Read every frame; written by the React component. */
export interface ArtState {
  color: string;
  /** 0..1, set to 1 on selection, decays each frame. */
  pulse: number;
  /** Mouse offset from centre, -0.5..0.5. */
  mx: number;
  my: number;
  /** 0..1 launch progress (orb swells). */
  launching: number;
}

const hex = (h: string): [number, number, number] =>
  [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16)) as [number, number, number];
const dpr = () => window.devicePixelRatio || 1;

interface Node {
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  p: number;
}

/** The "other agents" drifting in the dark; faint lines = the message board. */
export class Swarm {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private nodes: Node[] = [];

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const d = dpr();
    this.W = this.canvas.width = innerWidth * d;
    this.H = this.canvas.height = innerHeight * d;
    const n = Math.min(110, Math.floor((innerWidth * innerHeight) / 14000));
    this.nodes = Array.from({ length: n }, () => ({
      x: Math.random() * this.W,
      y: Math.random() * this.H,
      vx: (Math.random() - 0.5) * 0.25 * d,
      vy: (Math.random() - 0.5) * 0.25 * d,
      r: (Math.random() * 1.4 + 0.6) * d,
      p: Math.random() * 6,
    }));
  }

  draw(t: number, s: ArtState) {
    const { ctx: sc, W, H, nodes } = this;
    sc.clearRect(0, 0, W, H);
    const d = dpr();
    const link = 150 * d;
    const [r, g, b] = hex(s.color);
    for (const n of nodes) {
      n.x += n.vx;
      n.y += n.vy;
      if (n.x < 0 || n.x > W) n.vx *= -1;
      if (n.y < 0 || n.y > H) n.vy *= -1;
    }
    sc.lineWidth = d;
    for (let i = 0; i < nodes.length; i++)
      for (let j = i + 1; j < nodes.length; j++) {
        const a = nodes[i];
        const c = nodes[j];
        const dist = Math.hypot(a.x - c.x, a.y - c.y);
        if (dist < link) {
          sc.strokeStyle = `rgba(90,170,255,${(1 - dist / link) * 0.22})`;
          sc.beginPath();
          sc.moveTo(a.x, a.y);
          sc.lineTo(c.x, c.y);
          sc.stroke();
        }
      }
    for (const n of nodes) {
      const k = 0.5 + 0.5 * Math.sin(t / 700 + n.p);
      sc.fillStyle = k > 0.93 ? `rgba(${r},${g},${b},.95)` : `rgba(140,190,255,${0.25 + k * 0.35})`;
      sc.beginPath();
      sc.arc(n.x, n.y, n.r * (k > 0.93 ? 2.2 : 1), 0, 7);
      sc.fill();
    }
  }
}

interface Mote {
  a: number;
  rad: number;
  sp: number;
  tilt: number;
  s: number;
}

/** You: a glowing ball of energy; colour = chosen model. */
export class Orb2D {
  private ctx: CanvasRenderingContext2D;
  private W = 0;
  private H = 0;
  private motes: Mote[] = Array.from({ length: 70 }, () => ({
    a: Math.random() * 6.28,
    rad: 0.55 + Math.random() * 0.6,
    sp: (Math.random() * 0.6 + 0.2) * (Math.random() < 0.5 ? -1 : 1),
    tilt: Math.random() * 1.2 - 0.6,
    s: Math.random() * 2 + 0.6,
  }));

  constructor(private canvas: HTMLCanvasElement) {
    this.ctx = canvas.getContext('2d')!;
    this.resize();
  }

  resize() {
    const d = dpr();
    const box = this.canvas.getBoundingClientRect();
    this.W = this.canvas.width = box.width * d;
    this.H = this.canvas.height = box.height * d;
  }

  draw(t: number, st: ArtState) {
    const { ctx: ox, W, H } = this;
    ox.clearRect(0, 0, W, H);
    const [r, g, b] = hex(st.color);
    const s = Math.min(W, H);
    const cx = W / 2 + st.mx * s * 0.03;
    const cy = H / 2 + st.my * s * 0.03;
    const R = s * 0.15 * (1 + st.pulse * 0.25) * (1 + st.launching * 6);
    const breathe = 1 + Math.sin(t / 900) * 0.04;

    const halo = ox.createRadialGradient(cx, cy, 0, cx, cy, R * 4.2 * breathe);
    halo.addColorStop(0, `rgba(${r},${g},${b},.38)`);
    halo.addColorStop(0.35, `rgba(${r},${g},${b},.12)`);
    halo.addColorStop(1, `rgba(${r},${g},${b},0)`);
    ox.fillStyle = halo;
    ox.fillRect(0, 0, W, H);

    // orbit rings
    ox.lineWidth = Math.max(1, s * 0.002);
    for (let i = 0; i < 3; i++) {
      ox.save();
      ox.translate(cx, cy);
      ox.rotate((t / (4000 + i * 1700)) * (i % 2 ? -1 : 1) + i);
      ox.scale(1, 0.32 + i * 0.12);
      ox.strokeStyle = `rgba(${r},${g},${b},${0.35 - i * 0.08})`;
      ox.setLineDash([R * 0.3, R * 0.12]);
      ox.beginPath();
      ox.arc(0, 0, R * (1.7 + i * 0.45), 0, 7);
      ox.stroke();
      ox.restore();
    }

    // motes
    for (const m of this.motes) {
      m.a += m.sp * 0.01;
      const rr = R * (1.5 + m.rad * 1.5);
      const x = cx + Math.cos(m.a) * rr;
      const y = cy + Math.sin(m.a) * rr * (0.45 + m.tilt * 0.3);
      ox.fillStyle = `rgba(${r},${g},${b},${0.35 + 0.4 * Math.sin(t / 500 + m.a * 3) ** 2})`;
      ox.beginPath();
      ox.arc(x, y, m.s * s * 0.0025, 0, 7);
      ox.fill();
    }

    // core: wobbling blob + bright centre
    ox.beginPath();
    for (let a = 0; a <= 6.29; a += 0.1) {
      const k = 1 + 0.05 * Math.sin(a * 5 + t / 400) + 0.035 * Math.sin(a * 3 - t / 300);
      const x = cx + Math.cos(a) * R * k;
      const y = cy + Math.sin(a) * R * k;
      if (a) ox.lineTo(x, y);
      else ox.moveTo(x, y);
    }
    ox.closePath();
    const core = ox.createRadialGradient(cx - R * 0.25, cy - R * 0.3, 0, cx, cy, R * 1.1);
    const lift = (v: number) => Math.min(255, v + 90);
    core.addColorStop(0, '#fff');
    core.addColorStop(0.25, `rgba(${lift(r)},${lift(g)},${lift(b)},1)`);
    core.addColorStop(0.75, `rgba(${r},${g},${b},.95)`);
    core.addColorStop(1, `rgba(${r},${g},${b},.55)`);
    ox.shadowColor = st.color;
    ox.shadowBlur = R * 0.9;
    ox.fillStyle = core;
    ox.fill();
    ox.shadowBlur = 0;

    st.pulse *= 0.93;
  }
}
