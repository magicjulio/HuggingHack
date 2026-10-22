/**
 * Ending 1 "Cluster Run" (OpenAI infra): the swing race, Julius's pick of the four prototypes
 * (handoff/story-to-build/2026-10-16-end1-swing-promoted.md, how it plays: ./DESIGN.md).
 * The game is plain three.js (game/*.js, ported from prototypes/end1-swing/), not R3F: this component
 * only gives it a root element, the saved best time and the app callbacks, draws its overlays as the
 * shared level card (the intro and finish cards with the online ranking beside them), and disposes it
 * on unmount.
 */
import { useEffect, useRef, useState } from 'react';
import type { LevelProps } from '..';
import { useGame } from '../../state/store';
import { isDebug } from '../../ui/DebugPanel';
import { LevelCard, type ScreenCard } from '../../ui/LevelCard';
import { RankingBoard } from '../../ui/ranking/RankingBoard';
import { submitRun, type RankedRun } from '../../ui/ranking/ranking';
import { createClusterRun } from './game/clusterRun.js';
import '../../ui/gamehud.css';
import './end1.css';

const ID = 'end1';

export default function End1(props: LevelProps) {
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
    const game = createClusterRun(root.current!, {
      best: useGame.getState().save.bestTimes[ID] ?? null,
      debug: import.meta.env.DEV || isDebug(),
      onScreen: setCard,
      onFinish: (r) => {
        const done = { score: r.time, stats: { falls: r.falls } };
        submitRun(ID, done);
        setRun(done);
        useGame.getState().recordBestTime(ID, r.time);
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
      <div className="end1" ref={root} />
      {card && (
        <LevelCard
          level={ID}
          {...card}
          extra={[card.extra, board].flat()}
          onMenu={props.onExit}
          onCredits={props.onCredits}
        />
      )}
    </>
  );
}
