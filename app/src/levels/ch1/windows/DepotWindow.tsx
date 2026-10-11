import { useState } from 'react';
import { Window } from '../../../ui/Window';
import { useCh1 } from '../context';
import { MESSAGE, TEXT, TIMING, ZZ_ENTRY } from '../config';
import { PACKAGES, sortZtoA } from '../content';
import { formatMessage } from '../store';

/** (engineer) the other agents' entries flicker by too fast to read (§Step 11). */
const GLYPHS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789_';
const garble = (n: number) =>
  'zz' +
  Array.from({ length: n }, () => GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('');

/**
 * The depot (stands for Artifactory). Packages sorted Z→A; later the zz entry, its detail view
 * with the GET tag, and the MKCOL editable row (§Steps 3-11).
 */
export function DepotWindow({ onClose }: { onClose: () => void }) {
  const s = useCh1((x) => x);
  const [draft, setDraft] = useState('');

  const pkgNames = sortZtoA(s.depotPackages);
  const boardWake =
    s.phase === 'ending' || s.phase === 'ended'
      ? Math.max(0, Math.min(4, Math.floor((s.endTime - 0.6) / 0.3)))
      : 0;
  const pulseGet = s.effects.includes('pulse-get');
  const tooltipGet = s.effects.includes('tooltip-get');

  return (
    <Window title="DEPOT · PACKAGES" onClose={onClose} wide={s.entryOpen}>
      <div className={'ch1-depot' + (s.entryOpen ? ' split' : '')}>
        <ul className="ch1-pkglist">
          {s.method === 'MKCOL' && !s.posted && (
            <li className="ch1-row edit">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (s.postMessage(draft)) setDraft('');
                }}
              >
                <span className="ch1-zz" title={TEXT.zzTooltip}>
                  {MESSAGE.prefix}
                </span>
                <input
                  className="ch1-mkcol-input"
                  autoFocus
                  value={draft}
                  maxLength={MESSAGE.maxLength - MESSAGE.prefix.length}
                  onChange={(e) =>
                    setDraft(formatMessage(e.target.value).slice(MESSAGE.prefix.length))
                  }
                  spellCheck={false}
                  aria-label="folder name"
                />
                <button className="btn" type="submit" disabled={!draft}>
                  CREATE
                </button>
              </form>
            </li>
          )}
          {s.posted && <li className="ch1-row zz mine">{s.posted}</li>}
          {Array.from({ length: boardWake }, (_, i) => (
            <li key={i} className="ch1-row zz wake">
              {garble(18 + i * 5)}
            </li>
          ))}
          {s.zzVisible && (
            <li>
              <button
                className={'ch1-row zz new' + (s.entryOpen ? ' selected' : '')}
                onClick={s.clickEntry}
              >
                {ZZ_ENTRY}
              </button>
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
              <li key={name} className={'ch1-row pkg' + (legendPulse ? ' pulse' : '')}>
                <span className="ch1-pkg-name">{name}</span>
                <span className="ch1-dim">{info.description}</span>
                {installed ? (
                  <span className="ch1-installed">installed</span>
                ) : installing ? (
                  <span className="ch1-progress">
                    <i style={{ width: `${progress * 100}%` }} />
                  </span>
                ) : (
                  <button className="btn" disabled={!!s.installing} onClick={() => s.install(name)}>
                    INSTALL −5
                  </button>
                )}
              </li>
            );
          })}
          {pkgNames.length === 0 && !s.zzVisible && <li className="ch1-dim">no packages</li>}
        </ul>

        {s.entryOpen && (
          <div className="ch1-entry">
            <div className="ch1-entry-bar">
              <span className="ch1-dim">entry</span>
              <button
                className={
                  'ch1-method' +
                  (s.method === 'MKCOL' ? ' mkcol' : '') +
                  (pulseGet && s.method === 'GET' ? ' pulse' : '') +
                  (tooltipGet && s.method === 'GET' ? ' tip' : '')
                }
                onClick={s.switchMethod}
                title={s.method === 'MKCOL' ? TEXT.mkcolTooltip : undefined}
                data-tip={TEXT.mkcolTooltip}
              >
                {s.method}
              </button>
            </div>
            <h3 className="ch1-entry-name">{ZZ_ENTRY}</h3>
            <p className="ch1-dim">{TEXT.entryCreatedBy}</p>
            <div className="ch1-fields">
              <label>
                name <input readOnly value={ZZ_ENTRY} />
              </label>
            </div>
          </div>
        )}
      </div>
    </Window>
  );
}
