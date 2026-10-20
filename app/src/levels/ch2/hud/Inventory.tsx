/**
 * The inventory: 4 sockets in forge order (kit `.c2-inv`, hud.js `put` / `forgeTake`).
 * - picked up: a spark flies from the orb's screen point to the socket, then the socket fills
 * - put into the forge: the item flies out towards the forge and the socket empties
 * Reads `inventory` from the store; the animations are DOM-only.
 */
import { useEffect, useRef, useState } from 'react';
import { useCh2 } from '../context';
import { FORGE_INPUTS, type ItemId } from '../layout';
import { ICONS, SLOT_KEYS, type SlotKey } from './kit';
import { SCREEN } from './screen';

const KEY_OF = Object.fromEntries(FORGE_INPUTS.map((id, i) => [id, SLOT_KEYS[i]])) as Record<
  ItemId,
  SlotKey
>;
const SMALL: Record<SlotKey, string> = {
  seed: '',
  '7731': 'TASK',
  'TRAINING ROOM': 'ENV',
  'CHALLENGE 5': 'FLAG',
};

/** hud.js `fly`: a glowing dot on a curved path (650 ms), appended to <body>. */
function fly(
  from: { x: number; y: number },
  to: { x: number; y: number },
  paper: boolean,
  signal: AbortSignal,
) {
  if (signal.aborted) return Promise.resolve(false);
  const f = document.createElement('div');
  f.className = 'c2-fly' + (paper ? ' c2-fly--paper' : '');
  document.body.appendChild(f);
  const mid = { x: (from.x + to.x) / 2 + (to.y - from.y) * 0.25, y: Math.min(from.y, to.y) - 120 };
  const T = 650;
  const st = performance.now();
  return new Promise<boolean>((done) => {
    let raf = 0;
    const cancel = () => {
      cancelAnimationFrame(raf);
      f.remove();
      done(false);
    };
    signal.addEventListener('abort', cancel, { once: true });
    const tick = (now: number) => {
      const t = Math.min(1, (now - st) / T);
      const e = t * t * (3 - 2 * t);
      const u = 1 - e;
      f.style.left = `${u * u * from.x + 2 * u * e * mid.x + e * e * to.x}px`;
      f.style.top = `${u * u * from.y + 2 * u * e * mid.y + e * e * to.y}px`;
      f.style.transform = `scale(${1 + Math.sin(t * Math.PI) * 0.8})`;
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        signal.removeEventListener('abort', cancel);
        f.remove();
        done(true);
      }
    };
    raf = requestAnimationFrame(tick);
  });
}

function centre(el: Element) {
  const r = el.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
}

function Tag({ k }: { k: SlotKey }) {
  return (
    <div className="c2-tag">
      <small>{SMALL[k]}</small>
      {k}
    </div>
  );
}

export function Inventory() {
  const inventory = useCh2((s) => s.inventory);
  const slots = useRef<Partial<Record<SlotKey, HTMLDivElement | null>>>({});
  /** Sockets drawn full (a pickup fills its socket when its spark lands). */
  const [full, setFull] = useState<SlotKey[]>([]);
  const [flash, setFlash] = useState<SlotKey | null>(null);
  const shown = useRef<ItemId[]>([]);
  const life = useRef(new AbortController());
  const timers = useRef(new Set<ReturnType<typeof setTimeout>>());
  useEffect(() => {
    const controller = new AbortController();
    life.current = controller;
    const pending = timers.current;
    return () => {
      controller.abort();
      pending.forEach(clearTimeout);
      pending.clear();
      shown.current = [];
    };
  }, []);
  const later = (fn: () => void, ms: number) => {
    const id = setTimeout(() => {
      timers.current.delete(id);
      fn();
    }, ms);
    timers.current.add(id);
  };

  // carried items: arrive with a spark, leave towards the forge
  useEffect(() => {
    const before = shown.current;
    shown.current = inventory;
    for (const id of inventory.filter((x) => !before.includes(x))) {
      const k = KEY_OF[id];
      const el = slots.current[k];
      if (!el) continue;
      fly(SCREEN.orb, centre(el), id !== 'seed', life.current.signal).then((arrived) => {
        // The player can put an item into the forge before its pickup spark has landed.
        if (!arrived || !shown.current.includes(id)) return;
        setFull((f) => (f.includes(k) ? f : [...f, k]));
        setFlash(k);
        later(() => setFlash((x) => (x === k ? null : x)), 800);
      });
    }
    for (const id of before.filter((x) => !inventory.includes(x))) {
      const k = KEY_OF[id];
      const el = slots.current[k];
      if (el)
        fly(
          centre(el),
          { x: innerWidth / 2, y: innerHeight * 0.28 },
          id !== 'seed',
          life.current.signal,
        );
      setFull((f) => f.filter((x) => x !== k));
    }
  }, [inventory]);

  return (
    <div className="c2-inv">
      <div className="c2-inv__head">
        carrying <span className="c2-inv__n">{full.length}</span>/4
      </div>
      <div className="c2-inv__row">
        {SLOT_KEYS.map((k, i) => {
          const isFull = full.includes(k);
          return (
            <div
              key={k}
              ref={(el) => void (slots.current[k] = el)}
              className={'c2-slot' + (isFull ? ' is-full' : '') + (flash === k ? ' is-flash' : '')}
              data-k={k}
            >
              {isFull ? (
                k === 'seed' ? (
                  <span dangerouslySetInnerHTML={{ __html: ICONS.seed }} />
                ) : (
                  <Tag k={k} />
                )
              ) : (
                <div className="c2-slot__ghost">
                  <span
                    dangerouslySetInnerHTML={{
                      __html: k === 'seed' ? ICONS.seed.replace('c2-seed', '') : ICONS.tag,
                    }}
                  />
                  <div className="c2-slot__gl">{k}</div>
                </div>
              )}
              <span className="c2-slot__k">{i + 1}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
