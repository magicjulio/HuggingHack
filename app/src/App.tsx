import { lazy, Suspense, useState } from 'react';
import { useGame } from './state/store';
import { StartScreen } from './screens/start/StartScreen';
import { SpotifyDock } from './ui/SpotifyDock';
import { Credits } from './ui/Credits';

// Three.js is big: load the game only when it starts, so the start screen appears instantly.
const GameScreen = lazy(() =>
  import('./screens/game/GameScreen').then((m) => ({ default: m.GameScreen })),
);
// Warm the chunk while the player is on the menu.
void import('./screens/game/GameScreen');

/** Top-level screen switch. Add new screens (settings, credits, …) to `Screen` in the store. */
export function App() {
  const screen = useGame((s) => s.screen);
  // `?credits`: play the end credits on their own (review), then the menu
  const [credits, setCredits] = useState(() => new URLSearchParams(location.search).has('credits'));
  return (
    <>
      {credits ? (
        <Credits onDone={() => setCredits(false)} />
      ) : screen === 'game' ? (
        <Suspense fallback={<div className="screen-loading" />}>
          <GameScreen />
        </Suspense>
      ) : (
        <StartScreen />
      )}
      {/* outside the switch: keeps playing through the levels */}
      <SpotifyDock />
    </>
  );
}
