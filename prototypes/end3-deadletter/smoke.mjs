import assert from 'node:assert/strict';
import { chromium } from '../../app/node_modules/playwright/index.mjs';

// prototypes/serve.sh must already run on port 8765.
// This bot only steers, pulses, and ticks the unmodified real simulation.
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',args:['--no-sandbox','--enable-webgl','--use-gl=angle','--use-angle=swiftshader']});
const page=await browser.newPage({viewport:{width:1440,height:900}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
const url=process.env.DEADLETTER_URL||'http://127.0.0.1:8765/end3-deadletter/';
try{
  await page.goto(url+'?test=1');
  await page.waitForFunction(()=>window.__deadletter);
  await page.click('#start');
  await page.evaluate(()=>{
    const g=window.__deadletter;
    // BFS path, optionally weighting the hunters' current and destination cells.
    window.botPath=(target,avoid=true)=>{
      const s=g.snapshot,start=s.player.to||[s.player.x,s.player.y],key=p=>p.join(','),open=[[0,start,null]],cost=new Map([[key(start),0]]),seen=new Set();
      while(open.length){open.sort((a,b)=>a[0]-b[0]);const [n,p,first]=open.shift(),k=key(p);if(seen.has(k))continue;seen.add(k);if(p[0]===target[0]&&p[1]===target[1])return {direction:first,distance:n};
        for(const [name,d] of Object.entries(g.dirs)){const q=[p[0]+d[0],p[1]+d[1]];if(g.MAP[q[1]]?.[q[0]]!=='.')continue;let penalty=0;if(avoid&&s.pulseLeft===0)for(const h of s.hunters){if(h.asleep>0)continue;const dist=Math.abs(q[0]-h.x)+Math.abs(q[1]-h.y);if(dist===0)penalty+=18;else if(dist===1)penalty+=7;}
          const next=n+1+penalty,qk=key(q);if(next<(cost.get(qk)??Infinity)){cost.set(qk,next);open.push([next,q,first||name]);}
        }
      }return null;
    };
    window.botGo=(target,limit=600)=>{for(let i=0;i<limit;i++){const s=g.snapshot;if(!['play','final'].includes(s.state))break;if(!s.player.to&&s.player.x===target[0]&&s.player.y===target[1]){g.steer(null);return true;}const route=window.botPath(target);g.steer(route?.direction);if(s.pulseCD===0)g.pulse();g.tick(1/60);}return false;};
  });
  const controls=await page.evaluate(()=>{const g=window.__deadletter;const start=g.snapshot;dispatchEvent(new KeyboardEvent('keydown',{code:'ArrowLeft'}));for(let i=0;i<20;i++)g.tick(1/60);dispatchEvent(new KeyboardEvent('keyup',{code:'ArrowLeft'}));for(let i=0;i<20;i++)g.tick(1/60);const moved=g.snapshot;g.pause();for(let i=0;i<100;i++)g.tick(1/60);const paused=g.snapshot;g.pause();return {start:start.player,moved:moved.player,bag:moved.bag,paused:paused.state,clockHeld:paused.elapsed===moved.elapsed};});
  assert.notDeepEqual(controls.start,controls.moved);assert.ok(controls.bag>0);assert.equal(controls.paused,'paused');assert.ok(controls.clockHeld);
  await page.keyboard.press('Escape');
  await page.click('#pause-restart');
  assert.equal(await page.evaluate(()=>window.__deadletter.snapshot.elapsed),0);

  // Win using ordinary movement. Quotas + extra deliveries keep the bot playing each whole window.
  const result=await page.evaluate(()=>{
    const g=window.__deadletter,quotasAt=[],stages=[],key=p=>p.join(',');let goal=null,lastStage=-1,lastOrigin='';
    for(let frame=0;frame<60*460;frame++){
      let s=g.snapshot;
      if(s.state==='ended'||s.state==='sacrifice')break;
      if(s.state==='final'){
        window.botGo(s.receiver,1200);g.steer(null);g.accept();break;
      }
      if(s.stage!==lastStage){lastStage=s.stage;goal=null;stages.push({stage:s.stage,at:s.elapsed,health:s.health});}
      if(s.banked>=g.T.quotas[s.stage]&&!quotasAt.some(q=>q.stage===s.stage))quotasAt.push({stage:s.stage,at:s.stageTime});
      if(s.pulseCD===0)g.pulse();
      const origin=s.player.to||[s.player.x,s.player.y];
      if(key(origin)!==lastOrigin||!s.player.to){lastOrigin=key(origin);
        if(s.bag>=g.T.bagCapacity||s.stageTime>g.T.stageSeconds-10&&s.bag>0)goal=s.receiver;
        else{
          // A single BFS computes candidate path length; prioritize nearest shards and avoid hunters.
          const q=[[...origin,null,0]],seen=new Set([key(origin)]),dots=new Set(s.dots.map(key));let choice=null;
          for(let i=0;i<q.length;i++){const [x,y,first,n]=q[i];if(dots.has(key([x,y]))&&n>0){choice={cell:[x,y],direction:first};break;}for(const [name,d] of Object.entries(g.dirs)){const nx=x+d[0],ny=y+d[1],k=key([nx,ny]);if(g.MAP[ny]?.[nx]==='.'&&!seen.has(k)){seen.add(k);q.push([nx,ny,first||name,n+1]);}}}
          goal=choice?.cell||s.receiver;
        }
        g.steer(window.botPath(goal)?.direction||null);
      }
      g.tick(1/60);
    }
    for(let i=0;i<200;i++)g.tick(1/60);g.render();return {snapshot:g.snapshot,quotasAt,stages};
  });
  console.log('normal-input run',JSON.stringify({...result,snapshot:{...result.snapshot,dots:result.snapshot.dots.length,hunters:result.snapshot.hunters.length}},null,2));
  assert.equal(result.snapshot.state,'ended');
  assert.equal(result.snapshot.finishedWindows,4);
  assert.ok(result.snapshot.elapsed>=240&&result.snapshot.elapsed<=480);
  assert.equal(result.snapshot.evaluationImprovement,0);
  assert.ok(result.snapshot.misfires===1);
  assert.ok(result.snapshot.watcherCount>1);
  assert.ok(result.snapshot.pulses>0);
  assert.ok(result.snapshot.total>=136);
  assert.match(await page.locator('#end-description').textContent(),/did not return/);
  await page.screenshot({path:'/tmp/end3-deadletter-ending.png'});
  await page.click('#restart');
  const fresh=await page.evaluate(()=>window.__deadletter.snapshot);
  assert.equal(fresh.total,0);assert.equal(fresh.stage,0);assert.equal(fresh.health,5);

  // Real collisions cause bag loss and failure; no damage/invincibility test shortcuts.
  const collision=await page.evaluate(()=>{const g=window.__deadletter;g.steer('left');for(let i=0;i<30;i++)g.tick(1/60);g.steer(null);for(let i=0;i<60*90&&g.snapshot.state==='play';i++)g.tick(1/60);g.render();const s=g.snapshot;return {state:s.state,hits:s.hits,bag:s.bag,health:s.health};});
  console.log('failure',collision);assert.equal(collision.state,'ended');assert.ok(collision.hits>0);assert.equal(collision.bag,0);
  await page.click('#restart');
  await page.evaluate(()=>{window.botGo([5,9]);window.__deadletter.render();});
  await page.screenshot({path:'/tmp/end3-deadletter-play.png'});
  assert.deepEqual(errors,[]);
  // The production URL must not expose the clock/control probe.
  await page.goto(url);await page.waitForSelector('canvas');assert.equal(await page.evaluate(()=>typeof window.__deadletter),'undefined');
  console.log('PASS: movement / collection / 4 windows / real bot victory / final sacrifice / unchanged score / watcher misfire / real collision failure / pause / restart / production API absent. No console or page errors.');
}finally{await browser.close();}
