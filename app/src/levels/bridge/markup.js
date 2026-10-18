// Bridge DOM: the reference page's stage (letterbox + HUD kit markup), fade and help (design/ch2-ui/bridge.html).
export const MARKUP = `
<canvas id="gl"></canvas>
<div class="stage" id="stage">
  <div class="c2-lb c2-lb--t"></div><div class="c2-lb c2-lb--b"></div>
  <div class="c2-hud" id="hud">
    <div class="c2-tl">
      <div class="c1-tokens">
        <div class="c1-tokens__row"><span>TOKENS <span class="c2-poisoned"></span></span><span class="c1-tokens__n">64</span></div>
        <div class="c1-tokens__bar"><span class="c1-tokens__floor" style="left:15%"></span></div>
      </div>
      <ul class="c1-quests c2-quests" id="quests"></ul>
    </div>
    <div class="c2-bubble" data-npc="phaseone" hidden>
      <div class="c2-bubble__pin"></div>
      <svg class="c2-bubble__lead" width="1" height="1"><line x1="0" y1="0" x2="46" y2="-46"/></svg>
      <div class="c2-bubble__box">
        <div class="c2-bubble__ghosts"></div>
        <div class="c2-bubble__panel">
          <div class="c2-bubble__who"><span>PHASEONE[big]</span><b class="c2-bubble__n"></b></div>
          <div class="c2-bubble__t"></div>
          <div class="c2-bubble__key"></div>
        </div>
      </div>
    </div>
  </div>
</div>
<div class="fade" id="fade"></div>
<div class="help" id="help"><b>WASD</b> move · <b>Space</b> jump / hold glide · <b>Shift</b> dash · <b>drag</b> look<br>jump into a stream · or find the way back</div>
<div class="skip" id="skipHint" hidden>Enter · skip</div>
`;
