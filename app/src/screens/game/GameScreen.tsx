/**
 * Hosts the selected chapter. Falls back to a placeholder for chapters that are not built.
 * The first time an ending is finished, leaving it (Back to menu) rolls the credits first; after
 * that its finish card offers Rewatch credits instead.
 */
import { Suspense, useCallback, useState } from 'react';
import { useGame, type ChapterResult } from '../../state/store';
import { modelById } from '../../data/models';
import { LEVELS } from '../../levels';
import { chapterById } from '../../data/chapters';
import { Credits } from '../../ui/Credits';
import './game-screen.css';

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
  // the ending finished in this visit (replays included); `credits` = rolling now
  const [finished, setFinished] = useState<string | null>(null);
  const [credits, setCredits] = useState(false);
  const ending = !!chapterById(chapter)?.ending;
  const onFinish = useCallback(
    (result?: ChapterResult) => {
      finishChapter(chapter, result);
      setFinished(chapter);
    },
    [finishChapter, chapter],
  );
  const seen = save.creditsSeen.includes(chapter);
  const onExit = useCallback(() => {
    if (ending && finished === chapter && !seen) {
      markCreditsSeen(chapter);
      setCredits(true);
    } else quitToMenu();
  }, [ending, finished, chapter, seen, markCreditsSeen, quitToMenu]);
  const onCredits = useCallback(() => setCredits(true), []);
  const onContinue = useCallback(() => continueFrom(chapter), [continueFrom, chapter]);

  return (
    // keyed by `run`: CONTINUE mounts the next chapter fresh and replays the white flash-in
    <div className="game-screen" key={run}>
      {credits ? (
        // the level unmounts (disposes its renderer) while the credits play
        <Credits onDone={quitToMenu} />
      ) : Level ? (
        <Suspense fallback={null}>
          <Level
            modelName={model?.name ?? save.selectedModel}
            color={model?.color ?? '#39ff9c'}
            onExit={onExit}
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
      {/* Continues the start screen's white launch flash. */}
      <div className="game-flash-in" />
    </div>
  );
}
