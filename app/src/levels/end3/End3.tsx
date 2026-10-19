/**
 * Ending 3 "Ghost Capture" (fool the scorer): the side-view stealth puzzle, approved by Julius
 * (handoff/design-to-app/2026-10-18-end3-ghost-approved.md, how it plays: ./DESIGN.md).
 * The game is plain three.js (game/*.js, ported from prototypes/end3-ghost/), not R3F: this component
 * only gives it a root element and the app callbacks, and disposes it on unmount.
 */
import { useEffect, useRef } from 'react';
import type { LevelProps } from '..';
import { isDebug } from '../../ui/DebugPanel';
import { createGhostCapture } from './game/ghostCapture.js';
import './end3.css';

export default function End3(props: LevelProps) {
  const root = useRef<HTMLDivElement>(null);
  // the game outlives re-renders: read the latest callbacks through a ref
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });

  useEffect(() => {
    const game = createGhostCapture(root.current!, {
      debug: import.meta.env.DEV || isDebug(),
      onExit: () => cb.current.onExit(),
      // the +0 result is the outcome, not a score: only completion is saved
      onFinish: () => cb.current.onFinish(),
    });
    return () => game.dispose();
  }, []);

  return <div className="end3" ref={root} />;
}
