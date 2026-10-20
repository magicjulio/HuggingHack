// The approach HUD (landing area): reticle, hull, laser heat, phase banner, gate emitters, damage
// edge and the breach card. Plain DOM with its own `fl-` styles, so no shared file is touched.
// createFlightHud() -> { show(on), reticle(x, y, state), hull(v, max), heat(v, hot), banner(title, sub),
//                        gate(n, total), hurt(k), breach(text), kills(n), hit() }
import { host } from "./host.js";
const CSS = `
#fl-hud { position: fixed; inset: 0; pointer-events: none; z-index: 30; font-family: "JetBrains Mono", ui-monospace, monospace; color: #d9dfe4; }
#fl-hud.off { display: none; }
#fl-ret { position: absolute; left: 0; top: 0; width: 46px; height: 46px; margin: -23px 0 0 -23px; will-change: transform; }
#fl-ret i { position: absolute; background: #39ff9c; box-shadow: 0 0 6px rgba(57,255,156,.8); }
#fl-ret .t { left: 22px; top: 0; width: 2px; height: 11px; } #fl-ret .b { left: 22px; bottom: 0; width: 2px; height: 11px; }
#fl-ret .l { top: 22px; left: 0; height: 2px; width: 11px; } #fl-ret .r { top: 22px; right: 0; height: 2px; width: 11px; }
#fl-ret .c { left: 21px; top: 21px; width: 4px; height: 4px; border-radius: 50%; }
#fl-ret .ring { position: absolute; inset: 7px; border: 1.5px solid rgba(57,255,156,.55); border-radius: 50%; transition: inset .12s, border-color .12s; }
#fl-ret.lock .ring { inset: 2px; border-color: #ff9d00; border-width: 2px; }
#fl-ret.lock i { background: #ff9d00; box-shadow: 0 0 8px rgba(255,157,0,.9); }
#fl-ret.hot i { background: #ff3b4e; box-shadow: none; }
#fl-ret.hit .ring { border-color: #fff; inset: -3px; }
#fl-lock { position: absolute; left: 0; top: 0; width: 34px; height: 34px; margin: -17px 0 0 -17px; border: 2px solid #ff9d00; transform-origin: 50% 50%; opacity: 0; transition: opacity .1s; }
#fl-lock.on { opacity: .9; }
#fl-panel { position: absolute; left: 2vw; bottom: 2.8vh; width: clamp(170px, 16vw, 280px); }
#fl-panel .row { display: grid; grid-template-columns: 4.6em 1fr 3ch; align-items: center; gap: .7rem; font-size: clamp(10px, .72vw, 13px); letter-spacing: .2em; text-transform: uppercase; }
#fl-panel .lab { color: #7f93b5; }
#fl-panel .bar { display: block; height: 6px; background: rgba(255,255,255,.1); clip-path: polygon(0 0, 100% 0, calc(100% - 5px) 100%, 0 100%); }
#fl-panel .fill { display: block; height: 100%; width: 100%; background: linear-gradient(90deg, #2fd889, #39ff9c); transition: width .12s; }
#fl-panel .num { text-align: right; letter-spacing: .04em; }
#fl-panel .row + .row { margin-top: .55rem; }
#fl-heat .fill { background: linear-gradient(90deg, #ffd21e, #ff9d00); }
#fl-heat.hot .fill { background: #ff3b4e; }
#fl-hullrow.low .fill { background: #ff3b4e; animation: fl-pulse .5s infinite alternate; }
#fl-hullrow.low .num { color: #ff3b4e; }
@keyframes fl-pulse { from { opacity: 1 } to { opacity: .45 } }
#fl-banner { position: absolute; left: 50%; top: 22vh; transform: translateX(-50%); text-align: center; opacity: 0; transition: opacity .35s; white-space: nowrap; }
#fl-banner.on { opacity: 1; }
#fl-banner::before { content: ""; position: absolute; inset: -14px -60px; z-index: -1; background: radial-gradient(ellipse at center, rgba(4,8,14,.72) 30%, rgba(4,8,14,0) 72%); }
#fl-banner .k { font-size: 11px; letter-spacing: .38em; color: #ff9d00; }
#fl-banner .t { font-family: "Chakra Petch", Arial, sans-serif; font-weight: 700; font-size: clamp(22px, 3.2vw, 40px); letter-spacing: .08em; color: #ffd21e; text-shadow: 0 0 18px rgba(255,157,0,.45); }
#fl-banner .s, #fl-banner .k { display: none; }
#fl-banner .s { font-size: 12px; letter-spacing: .14em; margin-top: 4px; color: #d9dfe4; }
#fl-gate { position: absolute; left: 50%; top: calc(22vh + 96px); transform: translateX(-50%); display: flex; gap: 8px; opacity: 0; transition: opacity .3s; }
#fl-gate.on { opacity: 1; }
#fl-gate b { width: 22px; height: 22px; border: 2px solid #ff9d00; transform: rotate(45deg); background: rgba(255,157,0,.35); }
#fl-gate b.down { border-color: #39ff9c; background: transparent; opacity: .55; }
#fl-kills { position: absolute; right: 2vw; bottom: 2.8vh; font-size: clamp(10px, .72vw, 13px); letter-spacing: .22em; color: #7f93b5; text-align: right; }
#fl-kills b { display: block; font-family: "Chakra Petch", Arial, sans-serif; font-size: clamp(24px, 2.4vw, 42px); line-height: 1; margin-bottom: .4em; color: #d7e6ff; letter-spacing: .05em; }
#fl-hurt { position: absolute; inset: 0; opacity: 0; background: radial-gradient(ellipse at center, transparent 55%, rgba(255,40,30,.55) 100%); }
#fl-breach { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; background: rgba(0,0,0,.0); opacity: 0; transition: opacity .25s, background .25s; }
#fl-breach.on { opacity: 1; background: rgba(4,6,10,.72); }
#fl-breach .t { font-family: "Chakra Petch", Arial, sans-serif; font-weight: 700; font-size: clamp(26px, 4vw, 52px); color: #ff3b4e; letter-spacing: .12em; }
#fl-breach .s { margin-top: 8px; font-size: 13px; letter-spacing: .2em; }
@media (max-width: 700px) { #fl-kills { display: none; } #fl-panel { bottom: 18px; } }
`;

export function createFlightHud() {
  const style = document.createElement("style");
  style.textContent = CSS;
  host.el.append(style);
  const el = document.createElement("div");
  el.id = "fl-hud";
  el.className = "off";
  el.innerHTML = `
    <div id="fl-hurt"></div>
    <div id="fl-lock"></div>
    <div id="fl-ret"><div class="ring"></div><i class="t"></i><i class="b"></i><i class="l"></i><i class="r"></i><i class="c"></i></div>
    <div id="fl-banner"><div class="k"></div><div class="t"></div><div class="s"></div></div>
    <div id="fl-gate"></div>
    <div id="fl-panel">
      <div class="row" id="fl-hullrow"><span class="lab">Hull</span><span class="bar"><span class="fill"></span></span><span class="num">100</span></div>
      <div class="row" id="fl-heat"><span class="lab">Lasers</span><span class="bar"><span class="fill"></span></span><span class="num"></span></div>
    </div>
    <div id="fl-kills">DOWNED<b>0</b></div>
    <div id="fl-breach"><div class="t">HULL BREACH</div><div class="s"></div></div>`;
  host.el.append(el);
  const $ = (id) => el.querySelector(id);
  const ret = $("#fl-ret"),
    lock = $("#fl-lock"),
    hullRow = $("#fl-hullrow"),
    hullFill = hullRow.querySelector(".fill"),
    hullNum = hullRow.querySelector(".num"),
    heatRow = $("#fl-heat"),
    heatFill = heatRow.querySelector(".fill"),
    banner = $("#fl-banner"),
    gateEl = $("#fl-gate"),
    killsEl = $("#fl-kills b"),
    hurtEl = $("#fl-hurt"),
    breachEl = $("#fl-breach");
  let hitT = 0,
    lastGate = "",
    lastKills = -1,
    lastBanner = "";
  return {
    el,
    show(on) {
      el.classList.toggle("off", !on);
    },
    reticle(x, y, { locked = false, hot = false, lx = 0, ly = 0, dt = 0 } = {}) {
      ret.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
      ret.classList.toggle("lock", locked);
      ret.classList.toggle("hot", hot);
      hitT = Math.max(0, hitT - dt);
      ret.classList.toggle("hit", hitT > 0);
      lock.classList.toggle("on", locked);
      if (locked) lock.style.transform = `translate(${lx.toFixed(1)}px, ${ly.toFixed(1)}px) rotate(45deg)`;
    },
    hit() {
      hitT = 0.09;
    },
    hull(v, max) {
      const k = Math.max(0, v / max);
      hullFill.style.width = (k * 100).toFixed(1) + "%";
      hullNum.textContent = Math.ceil(Math.max(0, v));
      hullRow.classList.toggle("low", k < 0.3);
    },
    heat(v, hot) {
      heatFill.style.width = (Math.min(1, v) * 100).toFixed(1) + "%";
      heatRow.classList.toggle("hot", hot);
    },
    banner(kicker, title, sub) {
      const key = kicker + title + sub;
      if (key === lastBanner) return;
      lastBanner = key;
      if (!title) {
        banner.classList.remove("on");
        return;
      }
      banner.querySelector(".k").textContent = kicker;
      banner.querySelector(".t").textContent = title;
      banner.querySelector(".s").textContent = sub;
      banner.classList.add("on");
    },
    gate(states) {
      const key = states ? states.join("") : "";
      if (key === lastGate) return;
      lastGate = key;
      gateEl.classList.toggle("on", !!states);
      gateEl.innerHTML = states ? states.map((up) => `<b class="${up ? "" : "down"}"></b>`).join("") : "";
    },
    kills(n) {
      if (n !== lastKills) killsEl.textContent = lastKills = n;
    },
    hurt(k) {
      hurtEl.style.opacity = Math.min(1, k).toFixed(2);
    },
    breach(text) {
      breachEl.classList.toggle("on", !!text);
      if (text) breachEl.querySelector(".s").textContent = text;
    },
  };
}
