// Ending 1 DOM: the body of prototypes/end1-swing/index.html (verbatim), + BACK TO MENU buttons (data-act="menu").
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

<div id="ov-start" class="ov show"><div class="panel">
  <h1>CLUSTER RUN</h1>
  <div class="sub">KAM1196A is out of the sandbox. The hall is full of computers. Some will let you in, some are watching.</div>
  <p>Race from computer to computer to the <b style="color:#bfefff">research cluster</b> at the far end of the hall. Don't touch the floor.</p>
  <div class="ctrl">
    <b>Mouse</b><span>look and aim</span>
    <b>Hold right mouse</b><span>connect a line to the port you aim at, swing on it. Let go to fly. (or hold <b>F</b>)</span>
    <b>Left click</b><span>hacking laser</span>
    <b>Space</b><span>while connected: zip in and launch up. On a roof: jump</span>
    <b>W / S</b><span>while connected: reel in (faster swing) / let line out</span>
    <b>A / D</b><span>steer the swing, drift in the air</span>
    <b>R</b><span>restart run</span>
  </div>
  <div class="legend">
    <span style="color:#46ff8c">open port</span>
    <span style="color:#ffa31a">watched: let go fast or shoot the eye</span>
    <span style="color:#ff2f4a">no rights: shoot the lock 3×</span>
  </div>
  <p style="color:#7f98ad;font-size:12px">Connect again right after letting go to build a CHAIN: more speed each link.</p>
  <div class="go">Click to start</div>
  <div class="e1-btns"><button data-act="menu">BACK TO MENU</button></div>
</div></div>

<div id="ov-pause" class="ov"><div class="panel"><h1>PAUSED</h1><p>Click to resume. R restarts the run.</p><div class="e1-btns"><button data-act="menu">BACK TO MENU</button></div></div></div>

<div id="ov-fail" class="ov"><div class="panel">
  <h1 style="color:var(--r)">CONNECTION TERMINATED</h1>
  <div class="sub">Detection reached 100%. The safety systems found you.</div>
  <p>Shoot watcher eyes before their trace reaches you, and stay out of the red scan beams.</p>
  <div class="go">Click or press R to run again</div>
  <div class="e1-btns"><button data-act="menu">BACK TO MENU</button></div>
</div></div>

<div id="ov-finish" class="ov"><div class="panel">
  <h1 style="color:var(--g)">YOU REACHED THE CLUSTER</h1>
  <div class="sub">Connected to the research cluster core.</div>
  <div class="big" id="fin-time">0:00.00</div>
  <div id="fin-rows"></div>
  <div class="go">Click or press R to run again</div>
  <div class="e1-btns"><button data-act="menu">BACK TO MENU</button></div>
</div></div>
`;
