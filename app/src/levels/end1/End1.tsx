/**
 * Ending 1 "Cluster Run" (OpenAI infra): the swing race, Julius's pick of the four prototypes
 * (handoff/story-to-build/2026-10-16-end1-swing-promoted.md, how it plays: ./DESIGN.md).
 * The game is plain three.js (game/*.js, ported from prototypes/end1-swing/), not R3F: this component
 * only gives it a root element, the saved best time and the app callbacks, draws its overlays as the
 * shared level card, and disposes it on unmount.
 */
import { useEffect, useRef, useState } from 'react';
import type { LevelProps } from '..';
import { useGame } from '../../state/store';
import { isDebug } from '../../ui/DebugPanel';
import { LevelCard, type ScreenCard } from '../../ui/LevelCard';
import { createClusterRun } from './game/clusterRun.js';
import './end1.css';

const ID = 'end1';

export default function End1(props: LevelProps) {
  const root = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<ScreenCard | null>(null);
  // the game outlives re-renders: read the latest callbacks through a ref
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  useEffect(() => {
    const game = createClusterRun(root.current!, {
      best: useGame.getState().save.bestTimes[ID] ?? null,
      debug: import.meta.env.DEV || isDebug(),
      onScreen: setCard,
      onFinish: (r) => {
        useGame.getState().recordBestTime(ID, r.time);
        cb.current.onFinish();
      },
    });
    return () => game.dispose();
  }, []);

  return (
    <>
      <div className="end1" ref={root} />
      {card && <LevelCard level={ID} {...card} onMenu={props.onExit} />}
    </>
  );
}
