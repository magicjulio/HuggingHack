// Ending 2 DOM: the body of prototypes/end2-ascent/index.html (verbatim) minus #overlay (menu panel and end card):
// the app draws those as its shared level card (main.js `showOverlay`).
export const MARKUP = `

<canvas id="c"></canvas>
<div id="hud" class="hidden">
  <div class="eyebrow">ROGUE ON HUGGING FACE / ENDING 02</div>
  <div id="objective"></div>
  <div id="detail"></div>
  <div id="flightmeter" class="meter">
    <div id="flightfill" class="fill"></div>
  </div>
  <div id="topright">
    <div id="phase"></div>
    <div id="timer">00:00</div>
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
  <div id="hint" class="hidden"></div>
  <div id="bottom">
    <div id="vitals">
      <div class="label">KAM1196A <span id="healthtext">100</span></div>
      <div class="meter"><div id="healthfill" class="fill"></div></div>
      <div class="label" style="color: #a6c76e">
        ● POISONED / CORE ONLINE
      </div>
      <div id="heatbox">
        <div class="label" id="heatlabel">PULSE RIFLE / HEAT</div>
        <div class="meter"><div id="heatfill" class="fill"></div></div>
      </div>
    </div>
    <div id="ability">
      <strong><kbd>Q</kbd> SPAWN SUBAGENTS</strong>
      <div class="meter"><div id="callfill" class="fill"></div></div>
      <div id="abilitydetail">3 agents · ready for deployment</div>
    </div>
  </div>
  <div id="controls">
    WASD MOVE · RMB AIM · LMB FIRE · C COVER · SHIFT SPRINT · SPACE DODGE
  </div>
</div>
<div id="damage"></div>
<div id="fade"></div>
`;
