// External designer (Codex, GPT-6.1), 2026-10-14. Run from repo root; design server on 8766.
import {chromium} from '../../../app/node_modules/playwright/index.mjs';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const phase=process.argv[2]??'after';
const out=new URL('../ch2/previews/external-designer-2026-10-14',import.meta.url).pathname;
await mkdir(out,{recursive:true});
const browser=await chromium.launch({channel:'chrome',args:['--use-gl=angle','--use-angle=vulkan','--enable-features=Vulkan','--ignore-gpu-blocklist']});
const results=[];
try {
 const page=await browser.newPage({viewport:{width:1920,height:1080}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
 await page.addInitScript(()=>{let seed=192608;Math.random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};});
 // Resolve importmap URLs from installed Three 0.186.1: review remains usable offline.
 await page.route('https://cdn.jsdelivr.net/npm/three@0.186.1/**',async route=>{
  const suffix=route.request().url().split('three@0.186.1/')[1];
  await route.fulfill({body:await readFile(new URL('../../../app/node_modules/three/'+suffix,import.meta.url)),contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
 });
 for (const cam of ['c03220','FLAC38347','V8SAME','yard','flood','run']) {
  await page.goto('http://127.0.0.1:8766/3d/ch2/level.html?cam='+cam+'&clean&nobubble');
  await page.waitForFunction('window.__ready',null,{timeout:45000});await page.waitForTimeout(3000);
  if(phase==='after') await page.screenshot({path:out+'/'+cam+'.png'});
  const result=await page.evaluate(()=>new Promise(resolve=>{
   const frames=[];let prev=performance.now(),start=prev;
   function frame(now){frames.push(now-prev);prev=now;if(now-start<5000)requestAnimationFrame(frame);else{
    frames.sort((a,b)=>a-b);const gl=CH2.renderer?.getContext(),ext=gl?.getExtension('WEBGL_debug_renderer_info');
    resolve({fps:frames.length*1000/(now-start),p95Ms:frames[Math.floor(frames.length*.95)],maxMs:Math.max(...frames),renderer:ext?gl.getParameter(ext.UNMASKED_RENDERER_WEBGL):null,counts:CH2.crowd?.stats?.(),render:CH2.renderer?.info.render,memory:CH2.renderer?.info.memory});
   }}requestAnimationFrame(frame);
  }));results.push({cam,...result});console.log(phase,cam,JSON.stringify(result));
 }
 await writeFile(out+'/performance-'+phase+'.json',JSON.stringify({phase,viewport:[1920,1080],results,errors},null,2)+'\n');console.log('errors',errors);
}finally{await browser.close();}
