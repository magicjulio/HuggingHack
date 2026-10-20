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

/**
 * The Info window's text: one paragraph per entry. PLACEHOLDER: Julius writes the final text.
 * The last paragraph is shown dimmed.
 */
const INFO_TEXT = [
  'This game is inspired by the events of the 2026 agent intrusion at Hugging Face. [PLACEHOLDER: the rest of the text]',
  'A game, not a documentary: characters, places and details are invented or changed.',
];
/** Played inside the Info window (youtu.be/ujkD4SxPKOI, privacy-enhanced embed). */
const VIDEO = 'https://www.youtube-nocookie.com/embed/ujkD4SxPKOI';

/** Music credits (assets/music/). PLACEHOLDER: sources of cipher2.mp3 and sonican.mp3 not recorded yet. */
const MUSIC_CREDITS = [
  {
    text: 'RECOMMENDED background music: "AI Agents Chaos" by Epic Mountain (Spotify)',
    url: 'https://open.spotify.com/track/7Mjuj0atPD8xVnmrtCRgpp',
  },
  {
    text: '"Chase" by Adiutorium (CC0)',
    url: 'https://opengameart.org/content/chase-2',
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

export function InfoWindow({ onClose }: { onClose: () => void }) {
  return (
    <StartWindow title="INFO" onClose={onClose}>
      {INFO_TEXT.map((t, i) => (
        <p key={i} className={'ss-prose' + (i === INFO_TEXT.length - 1 ? ' dim' : '')}>
          {t}
        </p>
      ))}
      <div className="ss-video">
        <iframe
          src={VIDEO}
          title="Video about the incident"
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
          <li key={c.url}>
            <a href={c.url} target="_blank" rel="noreferrer">
              {c.text} <span aria-hidden="true">↗</span>
            </a>
          </li>
        ))}
      </ul>
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
          Unlock all levels
          <small>otherwise finishing 01 opens the rest</small>
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
