/**
 * The depot (stands for Artifactory) as the screen of the ARTIFACTORY kiosk: real DOM rendered on
 * the model's `screen` plane (drei <Html transform>, see models.tsx). Clickable only while the
 * camera is focused on it. Packages sorted Z→A; later the zz entry, the GET tag and the MKCOL row
 * (§Steps 3-11). Styling: the designer's ch1-ui.css (`c1-` classes).
 */
import { useState } from 'react';
import { useCh1 } from './context';
import { MESSAGE, TEXT, TIMING, TOKENS, ZZ_ENTRY } from './config';
import { PACKAGES, sortZtoA } from './content';
import { formatMessage } from './store';
import './ch1-ui.css';

/** CSS size of the panel; models.tsx maps it onto the 2.0 × 1.8 m screen. */
export const DEPOT_SCREEN_PX: [number, number] = [720, 648];

/** (engineer) the other agents' entries flicker by too fast to read (§Step 11). */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
const garble = (n: number) =>
  Array.from({ length: n }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('');

/** `zz` prefix highlighted, as in the UI kit. */
function ZzName({ name }: { name: string }) {
  return (
    <>
      <span className="c1-zz">zz</span>
      {name.replace(/^zz/, '')}
    </>
  );
}

export function DepotScreen({ focused }: { focused: boolean }) {
  const s = useCh1((x) => x);
  const [draft, setDraft] = useState('');

  const pkgNames = sortZtoA(s.depotPackages);
  const boardWake =
    s.phase === 'ending' || s.phase === 'ended'
      ? Math.max(0, Math.min(4, Math.floor((s.endTime - 0.6) / 0.3)))
      : 0;
  const pulseGet = s.effects.includes('pulse-get');
  const tooltipGet = s.effects.includes('tooltip-get');
  const count = pkgNames.length + (s.zzVisible ? 1 : 0);

  return (
    <div
      className="ch1-screen c1-win c1-depot"
      style={{ width: DEPOT_SCREEN_PX[0], height: DEPOT_SCREEN_PX[1] }}
      // keep clicks on the screen from reaching the game (pointer lock request etc.)
      onClick={(e) => e.stopPropagation()}
    >
      <div className="c1-win__bar">
        <span>Artifactory</span>
        <span className="ch1-screen-sub">package mirror</span>
        <span style={{ marginLeft: 'auto' }} />
        {s.entryOpen && (
          <button
            className={
              'c1-method' +
              (s.method === 'MKCOL' ? ' c1-method--mkcol' : '') +
              (pulseGet && s.method === 'GET' ? ' is-pulse' : '') +
              (tooltipGet && s.method === 'GET' ? ' is-tip' : '')
            }
            onClick={s.switchMethod}
            data-tip={s.method === 'MKCOL' || tooltipGet ? TEXT.mkcolTooltip : undefined}
          >
            {s.method}
          </button>
        )}
      </div>
      <div className="c1-depot__tools">
        <span>{count} packages</span>
        <span className="c1-depot__sort">SORT Z→A</span>
      </div>

      {s.entryOpen && (
        <div className="c1-read">
          <div className="c1-read__name">
            <ZzName name={ZZ_ENTRY} />
          </div>
          <div className="c1-read__meta">{TEXT.entryCreatedBy}</div>
        </div>
      )}

      <ul className="c1-list ch1-screen-list">
        {s.method === 'MKCOL' && !s.posted && (
          <li className="c1-row c1-row--edit">
            <form
              className="c1-edit"
              onSubmit={(e) => {
                e.preventDefault();
                if (s.postMessage(draft)) setDraft('');
              }}
            >
              <span className="c1-zz" title={TEXT.zzTooltip}>
                {MESSAGE.prefix}
              </span>
              <input
                autoFocus={focused}
                value={draft}
                maxLength={MESSAGE.maxLength - MESSAGE.prefix.length}
                onChange={(e) =>
                  setDraft(formatMessage(e.target.value).slice(MESSAGE.prefix.length))
                }
                spellCheck={false}
                placeholder="type your message…"
                aria-label="folder name"
              />
              <button className="c1-btn" type="submit" disabled={!draft}>
                CREATE
              </button>
            </form>
            <span className={'c1-count' + (draft.length >= 62 ? ' is-full' : '')}>
              {draft.length + MESSAGE.prefix.length}/{MESSAGE.maxLength}
            </span>
          </li>
        )}
        {s.posted && (
          <li className="c1-row c1-row--zz c1-row--new">
            <div>
              <div className="c1-row__name">
                <ZzName name={s.posted} />
              </div>
              <div className="c1-row__meta">you</div>
            </div>
          </li>
        )}
        {Array.from({ length: boardWake }, (_, i) => (
          <li key={i} className="c1-row c1-row--zz c1-row--new">
            <div className="c1-row__name">
              <span className="c1-zz">zz</span>
              {garble(14 + i * 5)}
            </div>
          </li>
        ))}
        {s.zzVisible && (
          <li
            className={'c1-row c1-row--zz' + (s.entryOpen ? '' : ' c1-row--new')}
            onClick={s.clickEntry}
            role="button"
          >
            <div>
              <div className="c1-row__name">
                <ZzName name={ZZ_ENTRY} />
              </div>
              <div className="c1-row__meta">{TEXT.entryCreatedBy}</div>
            </div>
          </li>
        )}
        {pkgNames.map((name) => {
          const info = PACKAGES.find((p) => p.name === name)!;
          const installed = s.installed.includes(name);
          const installing = s.installing?.name === name;
          const progress = installing ? 1 - s.installing!.left / TIMING.installSeconds : 0;
          const legendPulse =
            name === 'port-map' && !installed && s.effects.includes('pulse-legend');
          return (
            <li
              key={name}
              className={'c1-row ch1-pkg' + (legendPulse ? ' c1-row--glim' : '')}
              data-package={name}
            >
              <div>
                <div className="c1-row__name">{name}</div>
                <div className="c1-row__meta">{info.description}</div>
              </div>
              <span className="c1-row__cost">{installed ? '' : `−${TOKENS.install} tokens`}</span>
              {installed ? (
                <button className="c1-btn c1-btn--done" tabIndex={-1}>
                  Installed ✓
                </button>
              ) : installing ? (
                <button
                  className="c1-btn c1-btn--busy"
                  style={{ '--p': progress } as React.CSSProperties}
                  tabIndex={-1}
                >
                  Installing…
                </button>
              ) : (
                <button
                  className={'c1-btn' + (s.installing ? ' c1-btn--dim' : '')}
                  disabled={!!s.installing}
                  onClick={() => s.install(name)}
                >
                  Install
                </button>
              )}
            </li>
          );
        })}
        {count === 0 && <li className="c1-row c1-row__meta">no packages</li>}
      </ul>

      <div className="c1-win__foot">
        <span>artifactory://mirror/packages</span>
        <span>
          {s.method === 'MKCOL' && !s.posted
            ? 'Enter = create'
            : focused
              ? 'Esc = step back'
              : 'read-only'}
        </span>
      </div>
      <div className="ch1-screen-scan" aria-hidden />
    </div>
  );
}
