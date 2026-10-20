// Ending 3 DOM: the body of prototypes/end3-ghost/index.html (#game and its children, verbatim),
// minus the one overlay (intro, pause and final result): the app draws it as its shared level card. Styles: ../end3.css.
export const MARKUP = `
<main id="game">
  <canvas id="view" aria-label="Ghost Capture side-view platform game"></canvas>
  <div id="hud">
    <div>
      <span class="eyebrow">ENDING 3 / BEAT THE SCORER</span>
      <h1 id="level-title">GHOST CAPTURE</h1>
    </div>
    <div id="actor-label">KAM1196A <small>Q → GHOST</small></div>
  </div>
  <div id="toast" role="status"></div>
  <div id="footer">
    <span>A D / ← → MOVE · W / SPACE JUMP · S DROP · Q SWITCH</span><span>R RESET · ESC PAUSE</span>
  </div>
</main>
`;
