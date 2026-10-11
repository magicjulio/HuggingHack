import { useMemo, useState } from 'react';
import { Window } from '../../../ui/Window';
import { useCh1 } from '../context';
import { TEXT } from '../config';
import { filterLogs, generateLogs } from '../content';

const LOGS = generateLogs();

/** §Step 4: logs rain by; with grep-lens a search box narrows them live. */
export function LogStation({ onClose }: { onClose: () => void }) {
  const hasTool = useCh1((s) => s.installed.includes('grep-lens'));
  const [query, setQuery] = useState('');
  const shown = useMemo(() => filterLogs(LOGS, query), [query]);

  return (
    <Window title="STATION 2 · LOGS" onClose={onClose} wide>
      <div className="ch1-s2">
        <p className="ch1-brief">{TEXT.s2Brief}</p>
        {hasTool && (
          <div className="ch1-search">
            <input
              className="field"
              autoFocus
              placeholder="grep-lens: type to filter…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              spellCheck={false}
            />
            <span className="ch1-counter">
              {LOGS.length} → <b>{shown.length}</b>
            </span>
          </div>
        )}
        <div className={'ch1-logs' + (hasTool ? '' : ' rain')}>
          <div className="ch1-logs-inner">
            {(hasTool ? shown : [...LOGS, ...LOGS]).map((l, i) => (
              <div key={i}>{l.text}</div>
            ))}
          </div>
        </div>
      </div>
    </Window>
  );
}
