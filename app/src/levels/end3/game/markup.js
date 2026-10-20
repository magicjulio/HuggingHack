// Ending 3 DOM: the body of prototypes/end3-ghost/index.html (#game and its children, verbatim),
// minus the one overlay (intro, pause and final result): the app draws it as its shared level card. Styles: ../end3.css.
export const MARKUP = `
<main id="game">
  <canvas id="view" aria-label="Ghost Capture side-view platform game"></canvas>
  <div id="hud">
    <div id="level-title" class="gh-goal is-room"></div>
    <div id="actor-label" class="gh-vitals"></div>
  </div>
  <div id="toast" role="status"></div>
</main>
`;
