/**
 * Bridge "PHASEONE[big] and the choice" (Ch2 CONTINUE → this → one of four endings).
 * STAND-IN: the designer's reference page (design/ch2-ui/bridge.html) ported as is (bridgeScene.js),
 * with its own small controller. To be redone properly on the Ch2 store/controller/HUD (see app/CLAUDE.md).
 */
import { useEffect, useRef } from 'react';
import type { LevelProps } from '..';
import { useGame } from '../../state/store';
import { isDebug } from '../../ui/DebugPanel';
import { createBridge } from './bridgeScene.js';
import '../../levels/ch1/ch1-ui.css';
import '../ch2/ui/ch2-ui.css';
import './bridge.css';

export default function Bridge(props: LevelProps) {
  const root = useRef<HTMLDivElement>(null);
  const cb = useRef(props);
  useEffect(() => {
    cb.current = props;
  });
  useEffect(() => {
    let gone = false;
    let game: { dispose(): void } | null = null;
    const g = useGame.getState();
    // own container per mount: StrictMode mounts twice and the first scene finishes loading late
    const box = document.createElement('div');
    root.current!.append(box);
    createBridge(box, {
      canSkip: g.save.completedChapters.includes('bridge'),
      debug: import.meta.env.DEV || isDebug(),
      cancelled: () => gone,
      onPick: (ending: string) => {
        useGame.getState().finishChapter('bridge');
        useGame.getState().startChapter(ending);
      },
    }).then((x) => {
      if (gone) x.dispose();
      else game = x;
    });
    return () => {
      gone = true;
      game?.dispose();
      box.remove();
    };
  }, []);
  return <div className="bridge" ref={root} />;
}
