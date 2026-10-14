/**
 * Chapter 2 Step 0 intro — PLACEHOLDER until the designer's tornado export.
 * The accepted Step 7 film lives in Cutscene.tsx and world/step7.js.
 */
import { useMemo } from 'react';
import { useCh2 } from './context';
import { TIMING } from './config';
import { replyFor } from './store';

// ------------------------------------------------------------------ Step 0 intro
/** The reply appears under the player's message, its letters whirl into a stream, fade to the void. */
export function IntroOverlay({ message }: { message: string }) {
  const t = useCh2((s) => s.introT);
  const reply = useMemo(() => replyFor(message), [message]);
  const end = TIMING.introSeconds;
  return (
    <div className="ch2-intro" style={{ opacity: t > end - 1 ? Math.max(0, end - t) : 1 }}>
      <div className={'ch2-intro-list' + (t > 3.4 ? ' is-pulling' : '')}>
        <div className="ch2-intro-row is-old">{message}</div>
        {t > 1.4 && (
          <div className="ch2-intro-row is-reply">
            {[...reply].map((ch, i) => (
              <span key={i} style={{ '--i': i, '--n': reply.length } as React.CSSProperties}>
                {ch}
              </span>
            ))}
          </div>
        )}
      </div>
      <div className="ch2-intro-skip">any key / click to skip · PLACEHOLDER intro</div>
    </div>
  );
}
