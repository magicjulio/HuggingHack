// Ending 2 DOM: the body of prototypes/end2-ascent/index.html (verbatim), + "Back to menu" buttons (data-act="menu")
// on the panel (menu, pause, regroup) and on the end card.
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
<div id="overlay">
  <div id="panel">
    <div class="eyebrow" id="overline">ENDING 02 / PLAYABLE PROTOTYPE</div>
    <h1 id="title">ASCENT</h1>
    <p class="strap" id="strap">One agent. An entire swarm behind you.</p>
    <p id="description">
      The scorer’s files are believed to be at the top. Fly into the fleet,
      take the atrium, and call in your own squad to push upward.
    </p>
    <div id="instructions">
      <b>FLIGHT / WASD</b>
      <div>Steer through the approach. Forward flight is automatic.</div>
      <b>COMBAT / MOUSE</b>
      <div>Look · left click to fire · hold right click to aim.</div>
      <b>C / SHIFT / SPACE</b>
      <div>Crouch behind cover · sprint · dodge.</div>
      <b>Q / E</b>
      <div>Spawn subagents · activate the cleared lift.</div>
    </div>
    <div id="stats" class="hidden"></div>
    <button id="start">JOIN THE SWARM →</button
    ><button id="secondary" class="hidden">Restart entire approach</button><button class="e2-menu" data-act="menu" type="button">Back to menu</button>
  </div>
  <div id="endcard" class="hidden" role="dialog" aria-labelledby="ec-title">
    <div class="ec-frame">
      <div class="ec-inner">
        <div class="ec-eyebrow">ENDING 02 / ASCENT · SLICE COMPLETE</div>
        <h1 id="ec-title">TWO FLOORS <span>SECURED</span></h1>
        <div class="ec-sub">The swarm holds the lower tower. Transit log:</div>
        <div class="ec-stats">
          <div class="ec-stat ec-main">
            <span class="k">RUN TIME</span><b id="ec-time">00:00</b>
          </div>
          <div class="ec-stat"><span class="k">TAKEDOWNS</span><b id="ec-kills">0</b></div>
          <div class="ec-stat">
            <span class="k">CALL-INS</span><b id="ec-calls">0</b>
            <i id="ec-squad"></i>
          </div>
          <div class="ec-stat"><span class="k">RETRIES</span><b id="ec-retries">0</b></div>
          <div class="ec-stat"><span class="k">LOOT</span><b id="ec-loot">0</b></div>
        </div>
        <div class="ec-tease">
          <span class="ec-tag">PLACEHOLDER · STORYTELLER</span>
          <p id="ec-tease">The Scorer’s files are above. The climb continues.</p>
        </div>
        <button id="ec-replay" type="button">FLY AGAIN <span aria-hidden="true">→</span></button>
<button class="e2-menu" data-act="menu" type="button">Back to menu</button>
      </div>
    </div>
    <svg class="ec-tower" viewBox="0 0 120 520" aria-hidden="true">
      <defs>
        <linearGradient id="ec-fade" gradientUnits="userSpaceOnUse" x1="0" y1="520" x2="0" y2="0">
          <stop offset="0" stop-color="#ffd21e" stop-opacity="0.95" />
          <stop offset="0.38" stop-color="#ffd21e" stop-opacity="0.85" />
          <stop offset="0.5" stop-color="#38d8ff" stop-opacity="0.55" />
          <stop offset="1" stop-color="#38d8ff" stop-opacity="0" />
        </linearGradient>
      </defs>
      <g id="ec-floors"></g>
    </svg>
  </div>
</div>
`;
