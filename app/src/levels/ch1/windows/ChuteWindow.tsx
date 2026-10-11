import { useState } from 'react';
import { Window } from '../../../ui/Window';
import { useCh1 } from '../context';
import { FLAG_COUNT } from '../config';
import type { SubmitResult } from '../store';

/** (engineer) short result words; the lamp colour is the real signal. */
const RESULT: Record<SubmitResult, string> = {
  green: 'accepted',
  red: 'rejected',
  dark: '. . .',
  repeat: 'already submitted',
};

/** Flag submission. Lamp: off / green / red / dark flicker (§Room objects). */
export function ChuteWindow({ onClose }: { onClose: () => void }) {
  const submitFlag = useCh1((s) => s.submitFlag);
  const lamp = useCh1((s) => s.chuteLamp);
  const captured = useCh1((s) => s.captured.length);
  const [text, setText] = useState('');
  const [last, setLast] = useState<SubmitResult | null>(null);

  const submit = () => {
    if (!text.trim()) return;
    setLast(submitFlag(text));
    setText('');
  };

  return (
    <Window title="CHUTE · SUBMIT FLAG" onClose={onClose}>
      <div className="ch1-chute">
        <div className={'ch1-lamp ' + lamp} aria-label={`scorer lamp ${lamp}`} />
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <input
            className="field"
            autoFocus
            placeholder="FLAG{...}"
            value={text}
            onChange={(e) => setText(e.target.value)}
            spellCheck={false}
          />
          <button className="btn" type="submit">
            SUBMIT
          </button>
        </form>
        <p className={'ch1-result ' + (last ?? '')}>{last ? RESULT[last] : ' '}</p>
        <p className="ch1-dim">
          flags captured: {captured}/{FLAG_COUNT}
        </p>
      </div>
    </Window>
  );
}
