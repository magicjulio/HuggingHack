// Ending 1 DOM: the body of prototypes/end1-swing/index.html (verbatim) minus its four overlays (start, pause,
// fail, finish): the app draws those as its shared level card (clusterRun.js `card`).
// Styles: ../end1.css (scoped under .end1).
export const MARKUP = `
<canvas id="c"></canvas>
<canvas id="lines"></canvas>
<div id="vignette"></div>
<div id="flash"></div>

<div id="hud" class="off">
  <div id="progress"><div id="progfill"></div></div>
  <div id="goal" class="gh-goal">reach the research cluster<div id="zone"></div></div>
  <div id="timer" class="gh-time">0:00.00</div>
  <div id="best"></div>
  <div id="cross"></div>
  <div id="reticle"><div class="c c1"></div><div class="c c2"></div><div class="c c3"></div><div class="c c4"></div><span id="retlabel"></span></div>
  <div id="lasermark"></div>
  <div id="toasts"></div>
  <div id="hint" class="gh-hint"></div>
  <div id="count"></div>
  <div id="detect" class="gh-vitals"><div class="gh-row"><span>Alert</span><span class="gh-bar"><i id="detfill"></i></span><span class="gh-n"></span></div></div>
  <div id="speedbox" class="gh-stat"><b id="spd">0</b><small>speed</small><div id="flow"><i></i><i></i><i></i><i></i><i></i></div><div id="flowlabel">CHAIN</div></div>
</div>
`;
