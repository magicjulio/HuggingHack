/**
 * The forge fight's bar, top centre: three round segments filling in turn. It stops and turns
 * amber while the player is off the forge island (store `forge.held`).
 */
import { useCh2 } from '../context';
import { TEXT } from '../config';

export function ForgeBar() {
  const forging = useCh2((s) => s.forge.phase === 'forging');
  const round = useCh2((s) => s.forge.round);
  const progress = useCh2((s) => s.forge.progress);
  const held = useCh2((s) => s.forge.held);
  if (!forging) return null;
  return (
    <div className={'c2-forgebar' + (held ? ' is-held' : '')}>
      <div className="c2-forgebar__t">{held ? TEXT.forgeHeld : TEXT.forgeBar(round)}</div>
      <div className="c2-forgebar__track">
        {[1, 2, 3].map((n) => (
          <span key={n} className="c2-forgebar__seg">
            <span
              className="c2-forgebar__fill"
              style={{ width: `${n < round ? 100 : n === round ? progress * 100 : 0}%` }}
            />
          </span>
        ))}
      </div>
    </div>
  );
}
