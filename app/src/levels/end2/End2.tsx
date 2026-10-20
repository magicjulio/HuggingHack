/**
 * Ending 2 "Ascent" (the Hugging Face tower): the squad shooter with the GLM-5.2 boss, promoted by Julius
 * (handoff/design-to-app/2026-10-19-ascent-promoted.md, how it plays: ./DESIGN.md, FLOOR2/FLOOR3/BOSS.md).
 * The game is plain three.js (game/*.js, ported from prototypes/end2-ascent/), not R3F: this component
 * only gives it a root element, the saved best time and the app callbacks, and disposes it on unmount.
 */
import { useEffect, useRef } from 'react';
import type { LevelProps } from '..';
import { useGame } from '../../state/store';
import { isDebug } from '../../ui/DebugPanel';
import { createAscent } from './game/main.js';
import './end2.css';

const ID = 'end2';

export default function End2(props: LevelProps) {
  const root = useRef<HTMLDivElement>(null);
  // the game outlives re-renders: read the latest callbacks through a ref
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  useEffect(() => {
    const game = createAscent(root.current!, {
      best: useGame.getState().save.bestTimes[ID] ?? null,
      debug: import.meta.env.DEV || isDebug(),
      onExit: () => cb.current.onExit(),
      onFinish: (r) => {
        useGame.getState().recordBestTime(ID, r.time);
        cb.current.onFinish();
      },
    });
    return () => game.dispose();
  }, []);

  return <div className="end2" ref={root} />;
}
