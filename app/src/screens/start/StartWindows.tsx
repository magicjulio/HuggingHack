/**
 * The start screen's two windows, opened from the icon buttons top right: Info and Settings.
 * Esc or a click beside the panel closes them (the start screen has no pause, so Esc is free here).
 */
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type ReactNode,
} from 'react';
import { TRACKS } from '../../data/music';
import { useGame, type Quality } from '../../state/store';

export type StartWindowId = 'info' | 'settings';

function StartWindow({
  title,
  onClose,
  children,
}: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const panel = useRef<HTMLDivElement>(null);
  useEffect(() => {
    panel.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    addEventListener('keydown', onKey);
    return () => removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="ss-modal" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className="ss-window panel"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        ref={panel}
      >
        <h2>{title}</h2>
        <button className="ss-close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        {children}
      </div>
    </div>
  );
}

/** The Info window's text: one paragraph per entry. */
const INFO_TEXT = [
  'This game is inspired by the events of the 2026 agent intrusion at Hugging Face.',
];
/**
 * Played inside the Info window: "We are no longer in control of the AI situation." by AI In Context
 * (youtu.be/xFYUo0ZmK-A, privacy-enhanced embed).
 */
const VIDEO = 'https://www.youtube-nocookie.com/embed/xFYUo0ZmK-A';
const SOURCE_CODE = 'https://github.com/magicjulio/HuggingHack';

/** Music credits: the start screen tracks (data/music.ts), then the recommended Spotify track. */
const MUSIC_CREDITS = [
  ...TRACKS.map((t) => ({ text: `"${t.title}" by ${t.artist} (${t.license})`, url: t.url })),
  {
    text: 'RECOMMENDED background music: "AI Agents Chaos" by Epic Mountain (Spotify)',
    url: 'https://open.spotify.com/track/7Mjuj0atPD8xVnmrtCRgpp',
  },
];

// NOTES.md, Phase 1: the three primary sources.
const SOURCES = [
  {
    label: 'OpenAI: the Hugging Face incident and the road ahead',
    url: 'https://openai.com/de-DE/index/hugging-face-incident-and-the-road-ahead/',
  },
  {
    label: 'Hugging Face: agent intrusion, technical timeline',
    url: 'https://huggingface.co/blog/agent-intrusion-technical-timeline',
  },
  {
    label: 'METR: OpenAI / Hugging Face incident investigation',
    url: 'https://metr.org/blog/2026-08-26-openai-hugging-face-incident-investigation/',
  },
];

/** `onCredits` rolls the end credits (App), then returns to the start screen. */
export function InfoWindow({ onClose, onCredits }: { onClose: () => void; onCredits: () => void }) {
  return (
    <StartWindow title="INFO" onClose={onClose}>
      {INFO_TEXT.map((t, i) => (
        <p key={i} className="ss-prose">
          {t}
        </p>
      ))}
      <h3>WATCH WHAT HAPPENED</h3>
      <div className="ss-video">
        <iframe
          src={VIDEO}
          title="We are no longer in control of the AI situation. (AI In Context)"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
        />
      </div>
      <h3>READ WHAT HAPPENED</h3>
      <ul className="ss-sources">
        {SOURCES.map((s) => (
          <li key={s.url}>
            <a href={s.url} target="_blank" rel="noreferrer">
              {s.label} <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
      <h3>MUSIC</h3>
      <ul className="ss-sources">
        {MUSIC_CREDITS.map((c) => (
          <li key={c.text}>
            {c.url ? (
              <a href={c.url} target="_blank" rel="noreferrer">
                {c.text} <span aria-hidden="true">↗</span>
              </a>
            ) : (
              c.text
            )}
          </li>
        ))}
      </ul>
      <h3>SOURCE CODE</h3>
      <a className="ss-github" href={SOURCE_CODE} target="_blank" rel="noreferrer">
        <svg viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
        </svg>
        magicjulio/HuggingHack <span aria-hidden="true">↗</span>
      </a>
      <button className="ss-credits" onClick={onCredits}>
        Watch credits
      </button>
    </StartWindow>
  );
}

const QUALITIES: Quality[] = ['auto', 'high', 'mid', 'low'];
const pct = (v: number) => `${Math.round(v * 100)}%`;

function Slider({
  label,
  value,
  min,
  max,
  step,
  show,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step: number;
  show: (v: number) => string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="ss-row">
      <span className="ss-key">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        style={{ '--k': (value - min) / (max - min) } as CSSProperties}
        onChange={(e) => onChange(+e.target.value)}
      />
      <span className="ss-val">{show(value)}</span>
    </label>
  );
}

export function SettingsWindow({ onClose }: { onClose: () => void }) {
  const st = useGame((s) => s.save.settings);
  const set = useGame((s) => s.setSetting);
  const resetAll = useGame((s) => s.resetAll);
  // the app-wide Spotify dock lays itself over this slot while the window is open
  const slot = useCallback((el: HTMLDivElement | null) => {
    useGame.setState({ spotifySlot: el });
  }, []);
  // Reset asks once: the first click arms it, the second wipes
  const [armed, setArmed] = useState(false);
  return (
    <StartWindow title="SETTINGS" onClose={onClose}>
      <Slider
        label="Music"
        value={st.music}
        min={0}
        max={1}
        step={0.05}
        show={pct}
        onChange={(v) => set('music', v)}
      />
      <div className="ss-row">
        <span className="ss-key">Track</span>
        <span className="ss-seg" role="radiogroup" aria-label="Track">
          {TRACKS.map((t) => (
            <button
              key={t.id}
              role="radio"
              aria-checked={st.track === t.id}
              className={st.track === t.id ? 'on' : ''}
              onClick={() => set('track', t.id)}
            >
              {t.title}
            </button>
          ))}
        </span>
      </div>
      <Slider
        label="Sound effects"
        value={st.sfx}
        min={0}
        max={1}
        step={0.05}
        show={pct}
        onChange={(v) => set('sfx', v)}
      />
      <Slider
        label="Mouse sensitivity"
        value={st.sensitivity}
        min={0.5}
        max={2}
        step={0.1}
        show={(v) => `${v.toFixed(1)}×`}
        onChange={(v) => set('sensitivity', v)}
      />
      <div className="ss-row">
        <span className="ss-key">Quality</span>
        <span className="ss-seg" role="radiogroup" aria-label="Quality">
          {QUALITIES.map((q) => (
            <button
              key={q}
              role="radio"
              aria-checked={st.quality === q}
              className={st.quality === q ? 'on' : ''}
              onClick={() => set('quality', q)}
            >
              {q}
            </button>
          ))}
        </span>
      </div>
      <label className="ss-row">
        <span className="ss-key">
          Unlock everything
          <small>all levels and models; otherwise you earn them by playing</small>
        </span>
        <input
          type="checkbox"
          className="ss-switch"
          checked={st.unlockAll}
          onChange={(e) => set('unlockAll', e.target.checked)}
        />
      </label>
      <div className="ss-row ss-spotify">
        <span className="ss-key">
          Recommended background music
          <small>
            Plays on through the levels. Log in at open.spotify.com in this browser for the full
            track; logged out, Spotify plays a 30 s preview.
          </small>
        </span>
        <div className="ss-spotify-slot" ref={slot} />
      </div>
      <div className="ss-row">
        <span className="ss-key">
          Reset everything
          <small>
            {armed
              ? 'deletes your progress, settings and all data this game keeps in the browser'
              : 'progress, settings, browser data'}
          </small>
        </span>
        <button
          className={'ss-danger' + (armed ? ' armed' : '')}
          onClick={() => (armed ? resetAll() : setArmed(true))}
          onBlur={() => setArmed(false)}
        >
          {armed ? 'Confirm' : 'Reset'}
        </button>
      </div>
    </StartWindow>
  );
}
