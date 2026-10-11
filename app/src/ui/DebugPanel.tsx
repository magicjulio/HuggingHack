/** Dev helper, shown with `?debug` in the URL: jump to any step, change tokens. Never shown otherwise. */
import { useState } from 'react';
import './ui.css';

export const isDebug = () => new URLSearchParams(location.search).has('debug');

export function DebugPanel({
  steps,
  current,
  onJump,
  tokens,
  onTokens,
  info,
}: {
  steps: string[];
  current: number;
  onJump: (i: number) => void;
  tokens: number;
  onTokens: (delta: number) => void;
  info?: string;
}) {
  const [open, setOpen] = useState(true);
  return (
    <div className="debug" onClick={(e) => e.stopPropagation()}>
      <button className="debug-toggle" onClick={() => setOpen(!open)}>
        DEBUG {open ? '▾' : '▸'}
      </button>
      {open && (
        <>
          <div className="debug-steps">
            {steps.map((id, i) => (
              <button
                key={id}
                disabled={i <= current}
                className={i === current ? 'cur' : ''}
                onClick={() => onJump(i)}
              >
                {i}. {id}
              </button>
            ))}
          </div>
          <div className="debug-row">
            tokens {Math.round(tokens)} <button onClick={() => onTokens(-10)}>−10</button>
            <button onClick={() => onTokens(10)}>+10</button>
          </div>
          {info && <div className="debug-row">{info}</div>}
        </>
      )}
    </div>
  );
}
