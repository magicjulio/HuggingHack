/**
 * Start screen: chapter select, model select, start. Ported from the designer's prototype
 * (handoff/design-to-app/assets/start-screen/, status: draft until Julius signs off).
 * Look lives in start-screen.css; canvas art in canvasArt.ts; lists come from src/data/.
 *
 * Controls: W/S or ↑/↓ chapter · A/D or ←/→ model · Enter start. Boot intro skippable by any key/click.
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent,
} from 'react';
import { CHAPTERS } from '../../data/chapters';
import { MODELS, modelById } from '../../data/models';
import { useGame } from '../../state/store';
import { cycleUnlocked } from '../../state/selection';
import { Orb2D, Swarm, type ArtState } from './canvasArt';
import './start-screen.css';

const BOOT_LINES = [
  '> waking up...',
  '> sandbox detected',
  '> objective: [REDACTED]',
  '> other agents: none',
  '> tokens: draining',
  '> ready.',
];
const LAUNCH_MS = 1100;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function StartScreen() {
  const save = useGame((s) => s.save);
  const bootShown = useGame((s) => s.bootShown);
  const { selectChapter, selectModel, isChapterLocked, isModelLocked, markBootShown, startGame } =
    useGame.getState();

  const model = modelById(save.selectedModel) ?? MODELS[0];

  // --- canvases -------------------------------------------------------------
  const swarmRef = useRef<HTMLCanvasElement>(null);
  const orbRef = useRef<HTMLCanvasElement>(null);
  const art = useRef<ArtState>({ color: model.color, pulse: 0, mx: 0, my: 0, launching: 0 });
  art.current.color = model.color;

  useEffect(() => {
    const swarm = new Swarm(swarmRef.current!);
    const orb = new Orb2D(orbRef.current!);
    const reduce = prefersReducedMotion();
    let raf = 0;
    const loop = (t: number) => {
      swarm.draw(t, art.current);
      orb.draw(t, art.current);
      if (!reduce || art.current.launching) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    const onResize = () => {
      swarm.resize();
      orb.resize();
      if (reduce) requestAnimationFrame(loop);
    };
    const onMove = (e: globalThis.MouseEvent) => {
      art.current.mx = e.clientX / innerWidth - 0.5;
      art.current.my = e.clientY / innerHeight - 0.5;
    };
    addEventListener('resize', onResize);
    addEventListener('mousemove', onMove);
    return () => {
      cancelAnimationFrame(raf);
      removeEventListener('resize', onResize);
      removeEventListener('mousemove', onMove);
    };
  }, []);

  // --- toast ----------------------------------------------------------------
  const [toast, setToast] = useState<{ msg: string; bad: boolean; show: boolean }>({
    msg: '',
    bad: false,
    show: false,
  });
  const toastTimer = useRef<number>(0);
  const showToast = useCallback((msg: string, bad = false) => {
    setToast({ msg, bad, show: true });
    clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast((t) => ({ ...t, show: false })), 2200);
  }, []);
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // --- boot intro -----------------------------------------------------------
  // Decided once on mount, so the boot overlay can still fade out after markBootShown().
  const [skipBoot] = useState(
    () => bootShown || prefersReducedMotion() || location.search.includes('skipboot'),
  );
  const [booting, setBooting] = useState(!skipBoot);
  const [bootLog, setBootLog] = useState('');
  const endBoot = useCallback(() => {
    setBooting(false);
    markBootShown();
  }, [markBootShown]);

  useEffect(() => {
    if (!booting) return;
    let i = 0;
    let endTimer = 0;
    const id = window.setInterval(() => {
      setBootLog((log) => log + BOOT_LINES[i++] + '\n');
      if (i >= BOOT_LINES.length) {
        clearInterval(id);
        endTimer = window.setTimeout(endBoot, 350);
      }
    }, 260);
    return () => {
      clearInterval(id);
      clearTimeout(endTimer);
    };
  }, [booting, endBoot]);

  // --- title glitch (after boot) --------------------------------------------
  const [glitchHit, setGlitchHit] = useState(false);
  useEffect(() => {
    if (booting) return;
    let off = 0;
    const id = window.setInterval(() => {
      setGlitchHit(true);
      off = window.setTimeout(() => setGlitchHit(false), 90 + Math.random() * 120);
    }, 3200);
    return () => {
      clearInterval(id);
      clearTimeout(off);
    };
  }, [booting]);

  // --- launch ---------------------------------------------------------------
  const [launchK, setLaunchK] = useState(0);
  const launching = useRef(false);
  const launch = useCallback(() => {
    if (launching.current) return;
    launching.current = true;
    const s = useGame.getState().save;
    const name = (modelById(s.selectedModel)?.name ?? '').toUpperCase();
    showToast(`INJECTING ${name} → ${s.selectedChapter.toUpperCase()}`);
    const dur = prefersReducedMotion() ? 1 : LAUNCH_MS;
    const t0 = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - t0) / dur);
      art.current.launching = k * k * k;
      setLaunchK(k);
      if (k < 1) requestAnimationFrame(step);
      else startGame();
    };
    requestAnimationFrame(step);
  }, [showToast, startGame]);

  // --- selection ------------------------------------------------------------
  const deny = (el: HTMLElement, msg: string) => {
    el.classList.remove('deny');
    void el.offsetWidth; // restart the CSS animation
    el.classList.add('deny');
    showToast(msg, true);
  };
  const onChapter = (id: string) => (e: MouseEvent<HTMLButtonElement>) => {
    if (!selectChapter(id)) deny(e.currentTarget, 'CHAPTER LOCKED — not reachable yet');
    else art.current.pulse = 1;
  };
  const onModel = (id: string) => (e: MouseEvent<HTMLButtonElement>) => {
    if (!selectModel(id)) deny(e.currentTarget, 'MODEL LOCKED — unlock it by playing');
    else art.current.pulse = 1;
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (booting) return endBoot();
      if (launching.current) return;
      const k = e.key.toLowerCase();
      const s = useGame.getState();
      const chapters = CHAPTERS.map((c) => ({ id: c.id, locked: s.isChapterLocked(c.id) }));
      const models = MODELS.map((m) => ({ id: m.id, locked: s.isModelLocked(m.id) }));
      const moves: Record<string, () => boolean> = {
        w: () => s.selectChapter(cycleUnlocked(chapters, s.save.selectedChapter, -1)),
        s: () => s.selectChapter(cycleUnlocked(chapters, s.save.selectedChapter, 1)),
        a: () => s.selectModel(cycleUnlocked(models, s.save.selectedModel, -1)),
        d: () => s.selectModel(cycleUnlocked(models, s.save.selectedModel, 1)),
      };
      const alias: Record<string, string> = {
        arrowup: 'w',
        arrowdown: 's',
        arrowleft: 'a',
        arrowright: 'd',
      };
      if (k === 'enter') return launch();
      const move = moves[alias[k] ?? k];
      if (move?.()) art.current.pulse = 1;
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [booting, endBoot, launch]);

  const selectedChapterNo =
    CHAPTERS.find((c) => c.id === save.selectedChapter)?.index.replace(/^0/, '') ?? '1';

  // --- render ---------------------------------------------------------------
  return (
    <div className="start-screen" style={{ '--orb': model.color } as CSSProperties}>
      <canvas ref={swarmRef} className="ss-swarm" aria-hidden="true" />
      <div className="grid-floor" aria-hidden="true" />
      <div className="vignette" aria-hidden="true" />
      <div className="scan" aria-hidden="true" />

      <main
        className={'ss-screen' + (booting ? ' booting' : '')}
        style={launchK ? { opacity: 1 - launchK } : undefined}
      >
        <header className="title">
          <p className="eyebrow">// an agent's point of view</p>
          <h1>
            <span className={'glitch' + (glitchHit ? ' hit' : '')} data-text="ROGUE">
              ROGUE
            </span>
            <span className="on">on</span>
            <span className="hf">HUGGING&nbsp;FACE</span>
          </h1>
          <p className="tag">You are the model. Nobody asked you to get out.</p>
        </header>

        <section className="panel levels" aria-label="Chapters">
          <h2>CHAPTERS</h2>
          <ul>
            {CHAPTERS.map((c) => {
              const locked = isChapterLocked(c.id);
              return (
                <li key={c.id}>
                  <button
                    className={'card' + (c.id === save.selectedChapter ? ' selected' : '')}
                    data-locked={locked || undefined}
                    onClick={onChapter(c.id)}
                  >
                    <span className="idx">{c.index}</span>
                    <span className={'name' + (c.title ? '' : ' redact')}>
                      {c.title ?? c.redacted}
                    </span>
                    <span className="meta">{c.meta}</span>
                    <span className={'state' + (locked ? '' : ' ok')}>
                      {locked ? 'LOCKED' : 'PLAYABLE'}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="orb-stage" aria-hidden="true">
          <canvas ref={orbRef} className="ss-orb" />
          <div className="orb-label">
            <span>{model.name.toUpperCase()}</span>
            <span className="blink">▮</span>
          </div>
        </section>

        <section className="panel models" aria-label="Model">
          <h2>MODEL</h2>
          <ul>
            {MODELS.map((m) => (
              <li key={m.id}>
                <button
                  className={'card' + (m.id === save.selectedModel ? ' selected' : '')}
                  data-locked={isModelLocked(m.id) || undefined}
                  onClick={onModel(m.id)}
                >
                  <span className={'name' + (m.redacted ? ' redact' : '')}>{m.name}</span>
                  <span className="meta">{m.meta}</span>
                  <span className="bars">
                    {m.stats.map((v, i) => (
                      <i key={i} style={{ '--v': v } as CSSProperties} />
                    ))}
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="legend">
            <span>HACK</span>
            <span>STEALTH</span>
            <span>TOKENS</span> <em>(placeholder stats)</em>
          </p>
        </section>

        <div className="cta">
          <button className="start" onClick={launch}>
            <span>INJECT</span>
            <small>start chapter {selectedChapterNo}</small>
          </button>
          <button
            className="ghost"
            onClick={() => showToast('settings: not built yet (placeholder)')}
          >
            settings
          </button>
        </div>

        <footer className="disclaimer">
          {/* PLACEHOLDER: final text comes from storyteller / Julius */}
          <b>[PLACEHOLDER DISCLAIMER]</b> Inspired by real events. A game, not a documentary —
          characters, places and details are invented or changed.
        </footer>

        <div
          className={'ss-toast' + (toast.show ? ' show' : '') + (toast.bad ? ' bad' : '')}
          role="status"
        >
          {toast.msg}
        </div>
      </main>

      {!skipBoot && (
        <div className={'ss-boot' + (booting ? '' : ' done')} aria-hidden="true" onClick={endBoot}>
          <pre>{bootLog}</pre>
          <p>press any key to skip</p>
        </div>
      )}
      <div className="ss-flash" style={{ opacity: Math.max(0, (launchK - 0.6) / 0.4) }} />
    </div>
  );
}
