// Ending 1 DOM: the body of prototypes/end1-swing/index.html (verbatim) minus its four overlays (start, pause,
// fail, finish): the app draws those as its shared level card (clusterRun.js `card`).
// Styles: ../end1.css (scoped under .end1).
export const MARKUP = `
<canvas id="c"></canvas>
<canvas id="lines"></canvas>
<div id="vignette"></div>
<div id="flash"></div>

<div id="hud" class="off">
  <div id="top">
    <div id="timer">0:00.00</div>
    <div id="best"></div>
    <div id="progress"><div id="progfill"></div><span>CLUSTER</span></div>
  </div>
  <div id="goal"><b>GOAL</b> reach the research cluster<div id="zone"></div></div>
  <div id="cross"></div>
  <div id="reticle"><div class="c c1"></div><div class="c c2"></div><div class="c c3"></div><div class="c c4"></div><span id="retlabel"></span></div>
  <div id="lasermark"></div>
  <div id="toasts"></div>
  <div id="hint"></div>
  <div id="count"></div>
  <div id="detect">DETECTION<div class="bar"><div id="detfill"></div></div></div>
  <div id="speedbox"><span id="spd">0</span><small>speed</small><div id="flow"><i></i><i></i><i></i><i></i><i></i></div><div id="flowlabel">CHAIN</div></div>
</div>
`;
