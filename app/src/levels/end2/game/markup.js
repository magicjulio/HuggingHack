// Ending 2 DOM: the body of prototypes/end2-ascent/index.html (verbatim) minus #overlay (menu panel and end card):
// the app draws those as its shared level card (main.js `showOverlay`).
export const MARKUP = `

<canvas id="c"></canvas>
<div id="hud" class="hidden">
  <div id="objective" class="gh-goal"></div>
  <div id="detail"></div>
  <div id="flightmeter" class="meter">
    <div id="flightfill" class="fill"></div>
  </div>
  <div id="topright" class="gh-time">
    <div id="timer">00:00</div>
    <small id="phase"></small>
  </div>
  <!-- floor 3: the end boss's health (fight, round 4). Marks at 66 % and 33 %. -->
  <div id="bossbar" class="off" aria-hidden="true">
    <div class="bb-head"><span id="bossname">GLM-5.2</span><span id="bossphase">PHASE 1</span></div>
    <div class="bb-track">
      <div id="bossghost"></div>
      <div id="bossfill"></div>
      <i class="bb-mark" style="left: 66%"></i>
      <i class="bb-mark" style="left: 33%"></i>
    </div>
  </div>
  <div id="crosshair"></div>
  <div id="buffs"></div>
  <div id="toast"></div>
  <div id="hint" class="gh-hint hidden"></div>
  <div id="bottom">
    <div id="vitals" class="gh-vitals">
      <div class="gh-row"><span>Health</span><span class="gh-bar"><i id="healthfill"></i></span><span class="gh-n" id="healthtext">100</span></div>
      <div id="heatbox" class="gh-row">
        <span id="heatlabel">Heat</span>
        <span class="gh-bar meter"><i id="heatfill"></i></span><span class="gh-n"></span>
      </div>
    </div>
    <div id="ability" class="gh-vitals gh-right">
      <div class="gh-row"><span><kbd>Q</kbd> Squad</span><span class="gh-bar"><i id="callfill"></i></span><span class="gh-n" id="abilitydetail">READY</span></div>
    </div>
  </div>
  <div id="controls"></div>
</div>
<div id="damage"></div>
<div id="fade"></div>
`;
