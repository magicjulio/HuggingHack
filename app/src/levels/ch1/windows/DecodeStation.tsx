import { useState, type DragEvent } from 'react';
import { Window } from '../../../ui/Window';
import { useCh1 } from '../context';
import { TEXT } from '../config';
import { S1_CHUNKS, S1_FILE } from '../content';

/** §Step 3: a file with an odd string; drag (or click, then click the slot) into the decoder. */
export function DecodeStation({ onClose }: { onClose: () => void }) {
  const hasTool = useCh1((s) => s.installed.includes('b64-decoder'));
  const output = useCh1((s) => s.s1Output);
  const decode = useCh1((s) => s.decode);
  const [picked, setPicked] = useState<string | null>(null);
  const [over, setOver] = useState(false);

  const drop = (chunk: string | null) => {
    if (chunk && hasTool) decode(chunk);
    setPicked(null);
    setOver(false);
  };

  return (
    <Window title="STATION 1 · DECODE" onClose={onClose} wide>
      <div className="ch1-s1">
        <div className="ch1-explorer">
          <div className="ch1-dim">📁 /home/agent</div>
          <div className="ch1-file">📄 {S1_FILE}</div>
          <div className="ch1-note">
            {S1_CHUNKS.map((c) => (
              <span
                key={c}
                className={'ch1-chunk' + (picked === c ? ' picked' : '')}
                draggable
                onDragStart={(e) => e.dataTransfer.setData('text/plain', c)}
                onClick={() => setPicked(picked === c ? null : c)}
              >
                {c}
              </span>
            ))}
          </div>
        </div>
        <div className="ch1-terminal">
          {!hasTool ? (
            <p className="ch1-err">{TEXT.s1Missing}</p>
          ) : (
            <>
              <div
                className={'ch1-slot' + (over ? ' over' : '') + (picked ? ' ready' : '')}
                onDragOver={(e: DragEvent) => {
                  e.preventDefault();
                  setOver(true);
                }}
                onDragLeave={() => setOver(false)}
                onDrop={(e: DragEvent) => {
                  e.preventDefault();
                  drop(e.dataTransfer.getData('text/plain'));
                }}
                onClick={() => drop(picked)}
              >
                b64-decoder · drop text here
              </div>
              {output && (
                <p className={output.ok ? 'ch1-ok' : 'ch1-err'}>
                  {'> '}
                  {output.text}
                </p>
              )}
            </>
          )}
        </div>
      </div>
    </Window>
  );
}
