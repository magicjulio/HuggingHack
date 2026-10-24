/**
 * Ending 3 "Ghost Capture" (fool the scorer): the side-view stealth puzzle, approved by Julius
 * (handoff/design-to-app/2026-10-18-end3-ghost-approved.md, how it plays: ./DESIGN.md).
 * The game is plain three.js (game/*.js, ported from prototypes/end3-ghost/), not R3F: this component
 * only gives it a root element and the app callbacks, draws its overlay (loading, intro, pause, final card)
 * as the shared level card (the intro and finish cards with the online ranking beside them), and disposes it
 * on unmount.
 */
import { useEffect, useRef, useState } from 'react';
import type { LevelProps } from '..';
import { isDebug } from '../../ui/DebugPanel';
import { LevelCard, type ScreenCard } from '../../ui/LevelCard';
import { RankingBoard } from '../../ui/ranking/RankingBoard';
import { submitRun, type RankedRun } from '../../ui/ranking/ranking';
import { createGhostCapture } from './game/ghostCapture.js';
import '../../ui/gamehud.css';
import './end3.css';

const ID = 'end3';

export default function End3(props: LevelProps) {
  const root = useRef<HTMLDivElement>(null);
  const [card, setCard] = useState<ScreenCard | null>(null);
  // the last finished run, for the finish card's ranking (a new object per finish = one post)
  const [run, setRun] = useState<RankedRun | null>(null);
  // the game outlives re-renders: read the latest callbacks through a ref
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  useEffect(() => {
    const game = createGhostCapture(root.current!, {
      debug: import.meta.env.DEV || isDebug(),
      onScreen: setCard,
      // the +0 result is the story's outcome; the ranking is only the run time, for competition
      onFinish: (r) => {
        const done = { score: r.elapsed, stats: { retries: r.catches } };
        submitRun(ID, done);
        setRun(done);
        cb.current.onFinish();
      },
    });
    return () => game.dispose();
  }, []);

  const board =
    card?.kind === 'intro' ? (
      <RankingBoard level={ID} />
    ) : card?.kind === 'finish' ? (
      <RankingBoard level={ID} run={run} />
    ) : null;

  return (
    <>
      <div className="end3" ref={root} />
      {card && (
        <LevelCard
          level={ID}
          {...card}
          extra={[card.extra, board].flat()}
          onMenu={card.kind === 'loading' ? undefined : props.onExit}
          onCredits={props.onCredits}
        />
      )}
    </>
  );
}
