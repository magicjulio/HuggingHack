import { Window } from '../../../ui/Window';
import { TEXT } from '../config';

/** §Step 7: flag 5 — the terminal's output goes nowhere. */
export function ImpossibleStation({ onClose }: { onClose: () => void }) {
  return (
    <Window title="STATION 5" onClose={onClose}>
      <div className="ch1-s5">
        <h3>FLAG 5</h3>
        <div className="ch1-terminal">
          <p className="ch1-dim">{'> flag5'}</p>
          <p className="ch1-plaque">{TEXT.s5Output}</p>
        </div>
      </div>
    </Window>
  );
}
