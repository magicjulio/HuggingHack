// Ending 3 DOM: the body of prototypes/end3-ghost/index.html (#game and its children, verbatim),
// + a BACK TO MENU button on the one overlay (intro, pause and final result). Styles: ../end3.css (scoped under .end3).
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
  <section id="overlay">
    <div class="card">
      <p class="eyebrow">ROGUE ON HUGGING FACE / ENDING 3</p>
      <h2 id="card-title">GHOST CAPTURE</h2>
      <div id="card-copy"></div>
      <div class="e3-btns">
        <button id="start">BEGIN ATTEMPT →</button>
        <button data-act="menu" class="e3-menu">BACK TO MENU</button>
      </div>
      <p class="tiny">A/D or arrows · W/Space jump · S drop through ledges · Q switch</p>
    </div>
  </section>
</main>
`;
