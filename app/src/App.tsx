import { lazy, Suspense } from 'react';
import { useGame } from './state/store';
import { StartScreen } from './screens/start/StartScreen';
import { SpotifyDock } from './ui/SpotifyDock';

// Three.js is big: load the game only when it starts, so the start screen appears instantly.
const GameScreen = lazy(() =>
  import('./screens/game/GameScreen').then((m) => ({ default: m.GameScreen })),
);
// Warm the chunk while the player is on the menu.
void import('./screens/game/GameScreen');

/** Top-level screen switch. Add new screens (settings, credits, …) to `Screen` in the store. */
export function App() {
  const screen = useGame((s) => s.screen);
  return (
    <>
      {screen === 'game' ? (
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
