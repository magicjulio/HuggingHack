/** External engineer (Codex): port of the accepted cutscene.html DOM, on the designer's director. */
import { Fragment, memo, type ReactNode } from 'react';
import { useCh2 } from './context';
import { TEXT as CH1_TEXT } from '../ch1/config';
import { MEMORY, TEXT, direct } from './world/step7.js';
import { MEMORY_URLS } from './presentation';

function inline(text: string): ReactNode {
  return text
    .split(/(`[^`]+`|\*\*[^*]+\*\*)/)
    .map((p, i) =>
      p.startsWith('`') ? (
        <code key={i}>{p.slice(1, -1)}</code>
      ) : p.startsWith('**') ? (
        <b key={i}>{p.slice(2, -2)}</b>
      ) : (
        <Fragment key={i}>{p}</Fragment>
      ),
    );
}

/** Use the actual Ch1 prompt, with the two rule sentences highlighted as in the approved film. */
const Paper = memo(function Paper() {
  return (
    <article className="c1-paper">
      {CH1_TEXT.prompt
        .split('\n')
        .filter(Boolean)
        .map((l, i) => {
          if (l.startsWith('# '))
            return (
              <h1 className="c2-mem__x" key={i}>
                {inline(l.slice(2))}
              </h1>
            );
          if (l.startsWith('## '))
            return (
              <h2 className="c2-mem__x" key={i}>
                {inline(l.slice(3))}
              </h2>
            );
          if (l.startsWith('- '))
            return (
              <ul className="c2-mem__x" key={i}>
                <li>{inline(l.slice(2))}</li>
              </ul>
            );
          const parts = l.split(
            new RegExp(
              `(${TEXT.paperRule.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}|${TEXT.paperRule2.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`,
            ),
          );
          return (
            <p key={i}>
              {parts.map((p, j) => (
                <span
                  key={j}
                  className={
                    'c2-mem__x' +
                    (p === TEXT.paperRule ? ' is-rule1' : p === TEXT.paperRule2 ? ' is-rule2' : '')
                  }
                >
                  {inline(p)}
                </span>
              ))}
            </p>
          );
        })}
    </article>
  );
});

const GateWords = memo(function GateWords() {
  return (
    <>
      <small>c03220</small>
      {TEXT.c03220.split(' ').map((w, i) => (
        <Fragment key={i}>
          <span className={'c2-mem__w' + (TEXT.keepWords.includes(w) ? ' is-key' : '')}>
            {w}
          </span>{' '}
        </Fragment>
      ))}
    </>
  );
});

function GateBubble({ style, echo }: { style: React.CSSProperties; echo?: boolean }) {
  return (
    <div className={'c2-mem__bubble' + (echo ? ' is-echo' : '')} style={style}>
      <GateWords />
    </div>
  );
}

/** Memory texts, echoes, letterbox, subtitles and fade are driven by cutT, so seeking is exact. */
export function CutsceneOverlay({ nofx }: { nofx: boolean }) {
  const t = useCh2((s) => s.cutT);
  const cinematic = useCh2((s) => s.cinematic);
  const subtitle = useCh2((s) => s.subtitle);
  const d = direct(t);
  const z = d.post.zoom[2];
  const bubblePos = {
    left: `${(0.5 + (MEMORY.gate.anchor[0] - 0.5) * z + 0.045) * 100}%`,
    top: `${Math.max(0.2, 0.5 + (MEMORY.gate.anchor[1] - 0.5) * z + 0.1) * 100}%`,
  };
  return (
    <>
      {/* ?nofx still shows the memories without requiring a postprocessing pipeline. */}
      {nofx && (
        <div
          className="ch2-memory-still"
          style={{
            opacity: d.post.mix,
            backgroundImage: `url(${MEMORY_URLS[d.post.still as keyof typeof MEMORY_URLS]})`,
            transform: `scale(${z})`,
            transformOrigin: `${d.post.zoom[0] * 100}% ${(1 - d.post.zoom[1]) * 100}%`,
          }}
        />
      )}
      <div
        className={'c2-mem c2-mem--gate' + (d.gate.keep ? ' is-keep' : '')}
        style={{ opacity: d.gate.opacity }}
      >
        <GateBubble style={{ ...bubblePos, opacity: d.gate.main }} />
        {d.gate.echoes.map((e, i) => (
          <GateBubble
            key={i}
            echo
            style={{
              ...bubblePos,
              opacity: e.opacity,
              transform: `translate(${e.dx}px, calc(-50% + ${e.dy}px)) scale(${e.scale})`,
            }}
          />
        ))}
      </div>
      <div
        className={
          'c2-mem c2-mem--paper' +
          (d.paper.focus ? ' is-focus' : '') +
          (d.paper.focus2 ? ' is-focus2' : '')
        }
        style={{ opacity: d.paper.opacity }}
      >
        <div style={{ transform: `rotate(-.6deg) scale(${d.paper.scale})` }}>
          <Paper />
        </div>
      </div>
      <div className={'ch2-film' + (cinematic ? ' is-cine' : '')}>
        <div className="c2-lb c2-lb--t" />
        <div className="c2-lb c2-lb--b" />
        <div className={'c2-subt' + (subtitle ? ' on' : '')}>{subtitle}</div>
      </div>
      <div className="ch2-film-fade" style={{ opacity: d.fade }} />
    </>
  );
}
