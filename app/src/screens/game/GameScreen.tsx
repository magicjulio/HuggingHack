/**
 * Hosts the selected chapter. Falls back to a placeholder for chapters that are not built.
 * The first time an ending is finished, the credits roll straight after its last scene (no finish
 * card), then the menu; on later finishes its finish card shows, with Rewatch credits.
 * Before a level mounts it checks the browser can draw it (ui/gpu.ts); while one runs, a WebGL
 * context the browser takes away and doesn't give back offers a restart.
 */
import { Suspense, useCallback, useEffect, useState } from 'react';
import { useGame, type ChapterResult } from '../../state/store';
import { modelById } from '../../data/models';
import { LEVELS } from '../../levels';
import { chapterById } from '../../data/chapters';
import { Credits } from '../../ui/Credits';
import { LevelCard } from '../../ui/LevelCard';
import { gpuStatus } from '../../ui/gpu';
import './game-screen.css';

/** The CPU-rendering warning shows once per visit. */
let softwareOk = false;

/**
 * A level's canvas lost its WebGL context (driver reset, GPU switch, the browser reclaiming memory)
 * and didn't get it back within 2 s. Levels that dispose force a context loss too, but they remove
 * the canvas first, so a detached canvas is never counted.
 */
function useLostContext(run: number) {
  const [lost, setLost] = useState(false);
  useEffect(() => {
    setLost(false);
    const timers = new Set<number>();
    const onLost = (e: Event) => {
      const c = e.target;
      if (!(c instanceof HTMLCanvasElement)) return;
      const id = window.setTimeout(() => {
        timers.delete(id);
        const gl = c.getContext('webgl2');
        if (c.isConnected && (!gl || gl.isContextLost())) setLost(true);
      }, 2000);
      timers.add(id);
    };
    // capture: the event doesn't bubble
    window.addEventListener('webglcontextlost', onLost, true);
    return () => {
      window.removeEventListener('webglcontextlost', onLost, true);
      for (const id of timers) clearTimeout(id);
    };
  }, [run]);
  return lost;
}

export function GameScreen() {
  const save = useGame((s) => s.save);
  const quitToMenu = useGame((s) => s.quitToMenu);
  const finishChapter = useGame((s) => s.finishChapter);
  const markCreditsSeen = useGame((s) => s.markCreditsSeen);
  const continueFrom = useGame((s) => s.continueFrom);
  const hasNext = useGame((s) => !!s.nextChapter(s.save.selectedChapter));
  const run = useGame((s) => s.run);
  const model = modelById(save.selectedModel);
  const chapter = save.selectedChapter;
  const Level = LEVELS[chapter];
  // `credits` = rolling now
  const [credits, setCredits] = useState(false);
  const ending = !!chapterById(chapter)?.ending;
  const seen = save.creditsSeen.includes(chapter);
  const onFinish = useCallback(
    (result?: ChapterResult) => {
      finishChapter(chapter, result);
      if (ending && !seen) {
        markCreditsSeen(chapter);
        setCredits(true);
      }
    },
    [finishChapter, chapter, ending, seen, markCreditsSeen],
  );
  const onCredits = useCallback(() => setCredits(true), []);
  const onContinue = useCallback(() => continueFrom(chapter), [continueFrom, chapter]);
  const restart = useGame((s) => s.startGame);
  const lost = useLostContext(run);
  const [gpu, setGpu] = useState(() => {
    const g = gpuStatus();
    return g === 'software' && softwareOk ? 'ok' : g;
  });

  return (
    // keyed by `run`: CONTINUE mounts the next chapter fresh and replays the white flash-in
    <div className="game-screen" key={run}>
      {gpu === 'none' ? (
        <LevelCard
          level={chapter}
          kind="fail"
          title="No 3D graphics"
          line="This browser can't draw WebGL 2. Turn on hardware acceleration in its settings, or use a current Chrome, Edge, Firefox or Safari."
          onMenu={quitToMenu}
        />
      ) : gpu === 'software' ? (
        <LevelCard
          level={chapter}
          kind="pause"
          title="No graphics card in use"
          line="The browser draws 3D on the CPU, so the game will run very slowly. Turn on hardware acceleration in the browser's settings and restart it."
          action={{
            label: 'Play anyway',
            onClick: () => {
              softwareOk = true;
              setGpu('ok');
            },
          }}
          onMenu={quitToMenu}
        />
      ) : credits ? (
        // the level unmounts (disposes its renderer) while the credits play
        <Credits onDone={quitToMenu} />
      ) : Level ? (
        <Suspense fallback={null}>
          <Level
            modelName={model?.name ?? save.selectedModel}
            color={model?.color ?? '#39ff9c'}
            onExit={quitToMenu}
            onCredits={ending && seen ? onCredits : undefined}
            onFinish={onFinish}
            onContinue={hasNext ? onContinue : undefined}
          />
        </Suspense>
      ) : (
        <div className="game-placeholder">
          <b>PLACEHOLDER</b> · {chapter} is not built yet ·{' '}
          <button onClick={quitToMenu}>back to menu</button>
        </div>
      )}
      {lost && !credits && (
        <LevelCard
          level={chapter}
          kind="fail"
          title="Graphics reset"
          line="The graphics driver stopped this level. Restart it to keep playing."
          action={{ label: 'Restart level', onClick: restart }}
          onMenu={quitToMenu}
        />
      )}
      {/* Continues the start screen's white launch flash. */}
      <div className="game-flash-in" />
    </div>
  );
}
