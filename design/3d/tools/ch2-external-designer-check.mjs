// External designer (Codex, GPT-6.1), 2026-10-14. Run from repo root; design server on 8766.
import {chromium} from '../../../app/node_modules/playwright/index.mjs';
import {writeFile,readFile} from 'node:fs/promises';
const out=new URL('../ch2/previews/external-designer-2026-10-14',import.meta.url).pathname;
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist']});
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://cdn.jsdelivr.net/npm/three@0.186.1/**',async route=>{const suffix=route.request().url().split('three@0.186.1/')[1];await route.fulfill({body:await readFile(new URL('../../../app/node_modules/three/'+suffix,import.meta.url)),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});});
 await page.goto('http://127.0.0.1:8766/3d/ch2/level.html?cam=run&clean&nobubble');await page.waitForFunction('window.__ready',null,{timeout:45000});
 const checks=await page.evaluate(async()=>{
  const THREE=await import('three');const {createNpcs}=await import('./world/npcs.js');const {createCrowd}=await import('./world/crowd.js');const {createTrails}=await import('./world/trails.js');
  const results=[];function check(ok,label){if(!ok)throw Error(label);results.push(label);}
  const U={uTime:{value:0}},camera=CH2.camera,layout=LAYOUT;
  const npcs=createNpcs({layout,U});const poses={npcs:Object.fromEntries(layout.npcs.map((n,i)=>[n.id,{pos:[i*20,100+i,30],talking:true,leaving:n.id==='V8SAME'}]))};
  const input=JSON.stringify(poses);npcs.update(2,.016,poses);
  for(const [id,n]of Object.entries(npcs.byId))check(Math.abs(n.object.position.y-(poses.npcs[id].pos[1]+Math.sin(2*1.4+id.length)*.1))<1e-9&&n.object.position.x===poses.npcs[id].pos[0],id+' uses caller centre with original hover');
  check(JSON.stringify(poses)===input,'NPC state is not mutated');
  const c=npcs.byId.c03220.object,rot=c.children[3].rotation.clone();npcs.update(3,.016,poses);check(c.children[3].rotation.x!==rot.x,'c03220 cage animates');
  const v=npcs.byId.V8SAME.object;check(v.children[0].position.clone().add(v.children[1].position).length()<1e-9,'V8SAME cores orbit in opposition');
  poses.npcs.c03220.visible=false;npcs.update(3,.016,poses);check(!c.visible,'caller can hide NPC');poses.npcs.c03220.visible=true;npcs.update(3,.016,poses);check(c.visible,'caller can restore NPC');
  let bright=false;npcs.object.traverse(o=>{for(const m of[o.material].flat())if(m?.color&&Math.max(m.color.r,m.color.g,m.color.b)>.9+1e-8)bright=true;if(o.material?.uniforms?.uMax&&o.material.uniforms.uMax.value>.8+1e-8)bright=true;});check(!bright,'NPC material caps remain below bloom');
  const fx=createTrails({U,camera});let pops=0,resets=0,emissions=0;
  const originalPop=fx.pop,originalWord=fx.emitWord,originalEmit=fx.emit;
  fx.pop=(...args)=>{pops++;originalPop(...args);};fx.emitWord=(...args)=>{if(args[1]==='RESET')resets++;originalWord(...args);};fx.emit=(...args)=>{emissions++;originalEmit(...args);};
  const crowd=createCrowd({layout,U,camera,trails:fx});const states=new Set();let min=100,max=0;
  for(let frame=0;frame<7200;frame++){const t=frame/60;U.uTime.value=t;fx.update(t,1/60);crowd.update(t,1/60);const stats=crowd.stats();min=Math.min(min,stats.agents);max=Math.max(max,stats.agents);Object.keys(stats.states).forEach(s=>states.add(s));}
  check(min>=70&&max<=90,'120s population remains within 70–90');check(max===90,'population reaches accepted cap');check(['idle','walk','jump','post','path'].every(s=>states.has(s)),'all five crowd behaviours execute');check(resets>0,'runner laser hits emit RESET via shared motion');check(pops>0&&emissions>100,'crowd emits arrival/departure pops and typed/movement traffic');
  const before=JSON.stringify(crowd.stats());crowd.update(121,1,{visible:false});check(JSON.stringify(crowd.stats())===before&&!crowd.object.visible,'hidden crowd pauses simulation');crowd.update(121,0,{visible:true});check(crowd.object.visible,'crowd resumes');
  fx.update(130,10);check(fx.object.children.length===1,'expired pops are removed; glyph mesh retained');
  let disposed=0;fx.mesh.geometry.addEventListener('dispose',()=>disposed++);fx.dispose();check(disposed===1,'trails dispose releases instanced geometry');crowd.dispose();npcs.dispose();
  return{results,simulation:{seconds:120,minAgents:min,maxAgents:max,pops,resets,emissions,states:[...states]}};
 });
 console.log(JSON.stringify(checks));await writeFile(out+'/module-checks.json',JSON.stringify({checks,errors},null,2)+'\n');
 // Measure a fully populated live reference after warm-up. Default renderer includes AA and bloom.
 await page.waitForTimeout(42000);
 const dense=await page.evaluate(()=>new Promise(resolve=>{let prev=performance.now(),start=prev;const a=[];function f(now){a.push(now-prev);prev=now;if(now-start<10000)requestAnimationFrame(f);else{a.sort((a,b)=>a-b);const gl=CH2.renderer.getContext(),ext=gl.getExtension('WEBGL_debug_renderer_info');resolve({viewport:[innerWidth,innerHeight],renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):'unknown',fps:a.length*1000/(now-start),p95Ms:a[Math.floor(a.length*.95)],maxMs:Math.max(...a),stats:CH2.crowd.stats(),memory:CH2.renderer.info.memory,render:CH2.renderer.info.render});}}requestAnimationFrame(f);}));
 await page.screenshot({path:out+'/run-dense.png'});await writeFile(out+'/performance-dense.json',JSON.stringify({dense,errors},null,2)+'\n');console.log('dense',JSON.stringify(dense),'errors',errors);
}finally{await browser.close();}
