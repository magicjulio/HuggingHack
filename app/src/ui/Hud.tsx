/**
 * In-game HUD (generic, any chapter): top-left token bar + quest list, crosshair, use-prompt,
 * toasts/achievements, key help. PLACEHOLDER look until the designer's HUD arrives.
 */
import { RichText } from './Window';
import './ui.css';

export interface HudQuest {
  id: string;
  text: string;
  /** sub = an indented sub-line of the quest above it (e.g. "Seed (0/1)"). */
  kind: 'quest' | 'sub' | 'thought';
  done: boolean;
}

export interface HudProps {
  visible: boolean;
  modelName: string;
  color: string;
  tokens: number;
  maxTokens: number;
  quests: HudQuest[];
  /** Text next to the crosshair, e.g. "E  read PROMPT". */
  prompt?: string | null;
  /** Small hint at the bottom (controls). */
  hint?: string | null;
  toast?: { id: number; title?: string; text: string; kind: 'info' | 'achievement' } | null;
  crosshair: boolean;
  /** Key help bottom right (defaults to the Ch1 keys). */
  keys?: string;
  /** Lasting conditions shown as icons under the token bar, e.g. 'poisoned'. PLACEHOLDER look. */
  status?: string[];
}

/** How many thought lines stay visible under the quests. */
const MAX_THOUGHTS = 2;

export function Hud({
  visible,
  modelName,
  color,
  tokens,
  maxTokens,
  quests,
  prompt,
  hint,
  toast,
  crosshair,
  keys = 'E use · T think · Esc pause',
  status = [],
}: HudProps) {
  const questLines = quests.filter((q) => q.kind !== 'thought');
  const thoughts = quests.filter((q) => q.kind === 'thought').slice(-MAX_THOUGHTS);
  const pct = Math.max(0, Math.min(1, tokens / maxTokens));
  return (
    <div className="hud">
      <div className={'hud-panel' + (visible ? ' show' : '')}>
        <div className="hud-model" style={{ color }}>
          ● {modelName.toUpperCase()}
        </div>
        <div className="hud-tokens" title="tokens: health and ammo">
          <span className="hud-tokens-label">TOKENS</span>
          <span className="hud-bar">
            <i style={{ width: `${pct * 100}%` }} className={pct < 0.25 ? 'low' : ''} />
          </span>
          <span className="hud-tokens-n">{Math.round(tokens)}</span>
        </div>
        {status.length > 0 && (
          <div className="hud-status">
            {status.map((st) => (
              <span key={st} className={'hud-status-icon is-' + st} title={st}>
                {st.toUpperCase()}
              </span>
            ))}
          </div>
        )}
        <ul className="hud-quests">
          {questLines.map((q) => (
            <li
              key={q.id}
              className={(q.done ? 'done' : 'active') + (q.kind === 'sub' ? ' sub' : '')}
            >
              {q.done ? '✓' : q.kind === 'sub' ? '·' : '▸'} {q.text}
            </li>
          ))}
          {thoughts.map((q) => (
            <li key={q.id} className="thought">
              <RichText text={q.text} />
            </li>
          ))}
        </ul>
        {toast && (
          <div key={toast.id} className={'hud-toast ' + toast.kind}>
            {toast.title && <b>{toast.title}</b>}
            <span>{toast.kind === 'achievement' ? <em>{toast.text}</em> : toast.text}</span>
          </div>
        )}
      </div>
      {crosshair && <div className={'hud-crosshair' + (prompt ? ' on' : '')} />}
      {crosshair && prompt && <div className="hud-prompt">{prompt}</div>}
      {hint && <div className="hud-hint">{hint}</div>}
      {visible && <div className="hud-keys">{keys}</div>}
    </div>
  );
}
