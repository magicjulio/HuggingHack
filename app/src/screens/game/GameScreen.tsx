/** Hosts the selected chapter. Falls back to a placeholder for chapters that are not built. */
import { Suspense, useCallback } from 'react';
import { useGame, type ChapterResult } from '../../state/store';
import { modelById } from '../../data/models';
import { LEVELS } from '../../levels';
import './game-screen.css';

export function GameScreen() {
  const save = useGame((s) => s.save);
  const quitToMenu = useGame((s) => s.quitToMenu);
  const finishChapter = useGame((s) => s.finishChapter);
  const continueFrom = useGame((s) => s.continueFrom);
  const hasNext = useGame((s) => !!s.nextChapter(s.save.selectedChapter));
  const run = useGame((s) => s.run);
  const model = modelById(save.selectedModel);
  const chapter = save.selectedChapter;
  const Level = LEVELS[chapter];
  const onFinish = useCallback(
    (result?: ChapterResult) => finishChapter(chapter, result),
    [finishChapter, chapter],
  );
  const onContinue = useCallback(() => continueFrom(chapter), [continueFrom, chapter]);

  return (
    // keyed by `run`: CONTINUE mounts the next chapter fresh and replays the white flash-in
    <div className="game-screen" key={run}>
      {Level ? (
        <Suspense fallback={null}>
          <Level
            modelName={model?.name ?? save.selectedModel}
            color={model?.color ?? '#39ff9c'}
            onExit={quitToMenu}
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
      {/* Continues the start screen's white launch flash. */}
      <div className="game-flash-in" />
    </div>
  );
}
