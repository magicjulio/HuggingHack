import * as THREE from 'three';

// All gameplay / presentation tuning lives here. Coordinates below are maze cells.
const T = Object.freeze({
  tile: 1.6, stageSeconds: 62, quotas: [28, 32, 36, 40], finalSeconds: 50,
  bagCapacity: 12, health: 5, playerSpeed: 5.9, hunterSpeed: 3.0,
  hunterStageGain: .13, pulseCooldown: 10, pulseSeconds: 4, revealSeconds: 6,
  hitGrace: 2.5, depositGrace: 2, watcherDelay: 2.4, dotRespawn: 22, maxDPR: 1.7,
  receiverCells: [[9,9],[5,5],[13,13]], receiverOrder: [0,2,1,0],
  hunterCells: [[1,1],[17,1],[1,15],[17,15]],
});
const MAP = [
  '###################',
  '#...#.....#.......#',
  '#.#.#.###.#.###.#.#',
  '#.#...#.....#...#.#',
  '#.###.#.###.#.###.#',
  '#.....#...#.......#',
  '###.#.###.###.#.###',
  '#...#.........#...#',
  '#.###.###.###.###.#',
  '#.....#.....#.....#',
  '#.###.#.#.#.#.###.#',
  '#...#...#.#...#...#',
  '###.###.#.###.#.###',
  '#.......#.....#...#',
  '#.#####.#####.###.#',
  '#.................#',
  '###################',
];
const W=MAP[0].length,H=MAP.length;
const $=id=>document.getElementById(id);
const testMode=new URLSearchParams(location.search).get('test')==='1';
const dirs={up:[0,-1],down:[0,1],left:[-1,0],right:[1,0]};
const keyDirs={KeyW:'up',ArrowUp:'up',KeyS:'down',ArrowDown:'down',KeyA:'left',ArrowLeft:'left',KeyD:'right',ArrowRight:'right'};
const walk=(x,y)=>x>=0&&y>=0&&x<W&&y<H&&MAP[y][x]!=='#';
const cellKey=(x,y)=>`${x},${y}`;
const world=(x,y)=>new THREE.Vector3((x-(W-1)/2)*T.tile,0,(y-(H-1)/2)*T.tile);
let seed=1196;
function random(){seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;}

const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});
renderer.setPixelRatio(Math.min(devicePixelRatio,T.maxDPR));
renderer.setClearColor(0x060b13);
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.3;
$('game').appendChild(renderer.domElement);
const scene=new THREE.Scene();
scene.fog=new THREE.FogExp2(0x060b13,.008);
const camera=new THREE.OrthographicCamera(-20,20,20,-20,.1,150);
camera.position.set(0,38,20);camera.lookAt(0,0,0);
scene.add(new THREE.HemisphereLight(0xa6d9f0,0x172139,2.4));
const keyLight=new THREE.DirectionalLight(0xc6eaff,3.0);keyLight.position.set(-8,20,8);scene.add(keyLight);
const rim=new THREE.DirectionalLight(0x797dfb,1.7);rim.position.set(12,8,-12);scene.add(rim);

// A deterministic brushed/scratched metal map, shared by machinery. No external assets.
const metalCanvas=document.createElement('canvas');metalCanvas.width=metalCanvas.height=256;
const ctx=metalCanvas.getContext('2d');ctx.fillStyle='#64717b';ctx.fillRect(0,0,256,256);
for(let i=0;i<3300;i++){const shade=50+Math.floor(random()*70);ctx.strokeStyle=`rgba(${shade},${shade+8},${shade+13},${.12+random()*.3})`;ctx.lineWidth=random()<.9?1:2;const x=random()*256,y=random()*256;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+random()*24,y+random()*2);ctx.stroke();}
for(let i=0;i<70;i++){ctx.fillStyle='#15243255';ctx.fillRect(random()*256,random()*256,2+random()*15,1+random()*5);}
const metalMap=new THREE.CanvasTexture(metalCanvas);metalMap.colorSpace=THREE.SRGBColorSpace;metalMap.wrapS=metalMap.wrapT=THREE.RepeatWrapping;
const materials={
  floor:new THREE.MeshStandardMaterial({color:0x20384b,roughness:.88,metalness:.4,map:metalMap}),
  wall:new THREE.MeshStandardMaterial({color:0x344d68,roughness:.7,metalness:.6,map:metalMap}),
  top:new THREE.MeshStandardMaterial({color:0x61718a,roughness:.8,metalness:.55,map:metalMap}),
  black:new THREE.MeshStandardMaterial({color:0x09121e,roughness:.65,metalness:.7}),
  bolt:new THREE.MeshStandardMaterial({color:0x8493a1,roughness:.48,metalness:.8}),
  dot:new THREE.MeshBasicMaterial({color:0xc6e9f0}),
  green:new THREE.MeshStandardMaterial({color:0x8af05b,emissive:0x75e64b,emissiveIntensity:1.5,roughness:.35,metalness:.15}),
  cyan:new THREE.MeshBasicMaterial({color:0x79e6ee}),
  purple:new THREE.MeshBasicMaterial({color:0xb8a4e7}),
  red:new THREE.MeshBasicMaterial({color:0xf25b79}),
};
function mesh(geo,mat,parent,x=0,y=0,z=0){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);parent.add(m);return m;}
const boxGeo=new THREE.BoxGeometry(1,1,1);
function box(parent,mat,x,y,z,sx,sy,sz){const m=mesh(boxGeo,mat,parent,x,y,z);m.scale.set(sx,sy,sz);return m;}
function glowTexture(){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext('2d'),grad=g.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'#ffffffdd');grad.addColorStop(.2,'#ffffff88');grad.addColorStop(1,'#ffffff00');g.fillStyle=grad;g.fillRect(0,0,64,64);return new THREE.CanvasTexture(c);}
const haloTexture=glowTexture();
function halo(parent,color,size,y=.1){const m=new THREE.Mesh(new THREE.PlaneGeometry(size,size),new THREE.MeshBasicMaterial({map:haloTexture,color,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending}));m.rotation.x=-Math.PI/2;m.position.y=y;parent.add(m);return m;}
const terrain=new THREE.Group();scene.add(terrain);
const matrix=new THREE.Matrix4();
const floorCells=[],wallCells=[];
for(let y=0;y<H;y++)for(let x=0;x<W;x++)(walk(x,y)?floorCells:wallCells).push([x,y]);
function instanceCells(cells,geo,mat,sx,sy,sz,height){const instances=new THREE.InstancedMesh(geo,mat,cells.length);cells.forEach(([x,y],i)=>{const p=world(x,y);matrix.compose(p.setY(height),new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz));instances.setMatrixAt(i,matrix);});terrain.add(instances);return instances;}
instanceCells(floorCells,boxGeo,materials.floor,1.55,.12,1.55,-.1);
instanceCells(wallCells,boxGeo,materials.wall,1.48,.58,1.48,.18);
instanceCells(wallCells,boxGeo,materials.top,1.34,.08,1.34,.51);
// Recessed seams, exposed cap bolts and narrow cool edge markers keep geometry legible.
function instanceParts(parts,geo,mat,parent=terrain){const m=new THREE.InstancedMesh(geo,mat,parts.length);parts.forEach(([x,y,z,sx,sy,sz],i)=>{matrix.compose(new THREE.Vector3(x,y,z),new THREE.Quaternion(),new THREE.Vector3(sx,sy,sz));m.setMatrixAt(i,matrix);});parent.add(m);return m;}
const grooves=[],markers=[];
for(const [x,y] of wallCells){const p=world(x,y);if((x+y)%2===0){grooves.push([p.x,.563,p.z,.8,.025,.12],[p.x,.563,p.z+.25,.8,.025,.07]);}if(x>0&&x<W-1&&y>0&&y<H-1&&random()<.3)markers.push([p.x,.566,p.z-.55,.4,.012,.025]);}
instanceParts(grooves,boxGeo,materials.black);instanceParts(markers,boxGeo,materials.cyan);
const bolts=new THREE.InstancedMesh(new THREE.CylinderGeometry(.035,.045,.02,6),materials.bolt,wallCells.length*2);
wallCells.forEach(([x,y],i)=>{for(let b=0;b<2;b++){const p=world(x,y);matrix.makeTranslation(p.x+(b?-.54:.54),.57,p.z+(b?.54:-.54));bolts.setMatrixAt(i*2+b,matrix);}});terrain.add(bolts);
// Floating base: perimeter conduits, cable runs and distant collective machinery.
box(terrain,materials.black,0,-.45,0,W*T.tile+.35,.55,H*T.tile+.35);
for(const side of [-1,1]){box(terrain,materials.wall,side*(W*T.tile/2+.22),-.12,0,.12,.4,H*T.tile+.45);box(terrain,materials.cyan,side*(W*T.tile/2+.3),.04,0,.025,.025,H*T.tile*.6);}
const collectiveLights=[],farBases=[],farCaps=[],farFeet=[],farLeds=[];
for(let i=0;i<48;i++){const angle=i/48*Math.PI*2,x=Math.cos(angle)*25,z=Math.sin(angle)*21,y=-1.5-(i%3)*.6;farBases.push([x,y,z,.7,.8,.7]);farCaps.push([x,y+.47,z,.55,.12,.55]);farFeet.push([x,y-.5,z,.85,.12,.85]);farLeds.push([x,y+.56,z,.3,.03,.3]);}
instanceParts(farBases,new THREE.CylinderGeometry(1,1.15,1,8),materials.wall);instanceParts(farCaps,new THREE.CylinderGeometry(1,1,1,12),materials.black);instanceParts(farFeet,new THREE.CylinderGeometry(1,1,1,8),materials.bolt);const farLedMesh=instanceParts(farLeds,new THREE.CylinderGeometry(1,1,1,12),materials.cyan.clone());

const receiverGroups=[];
for(const [index,cell] of T.receiverCells.entries()){
  const g=new THREE.Group();g.position.copy(world(...cell));scene.add(g);
  const base=mesh(new THREE.CylinderGeometry(.63,.75,.28,12),materials.wall,g,0,.06,0);
  mesh(new THREE.CylinderGeometry(.51,.55,.05,12),materials.bolt,g,0,.23,0);
  mesh(new THREE.CylinderGeometry(.43,.43,.07,24),materials.black,g,0,.27,0);
  const ring=mesh(new THREE.TorusGeometry(.48,.045,6,32),materials.purple,g,0,.31,0);ring.rotation.x=Math.PI/2;
  for(let i=0;i<8;i++){const a=i/8*Math.PI*2;mesh(new THREE.CylinderGeometry(.035,.035,.035,6),materials.bolt,g,Math.cos(a)*.6,.23,Math.sin(a)*.6);}
  // A battered arm and tilted screen, not a freestanding flat block.
  box(g,materials.wall,.53,.45,-.4,.12,.65,.13);
  const screen=box(g,materials.black,.48,.8,-.35,.44,.3,.11);screen.rotation.x=-.35;
  const line=box(g,materials.purple,.48,.82,-.28,.3,.045,.025);
  const light=halo(g,0xb29cf4,2.5,.01);
  const label=document.createElement('span');$('relay-labels').appendChild(label);
  receiverGroups.push({group:g,ring,line,light,label,cell,index,base});
}

const playerGroup=new THREE.Group();scene.add(playerGroup);
const orb=mesh(new THREE.SphereGeometry(.32,24,16),materials.green,playerGroup,0,.49,0);
const poison=mesh(new THREE.IcosahedronGeometry(.334,1),new THREE.MeshBasicMaterial({color:0x16352a,wireframe:true,transparent:true,opacity:.75}),playerGroup,0,.49,0);
const playerHalo=halo(playerGroup,0x71eb4d,1.9,.02);
const orbit=mesh(new THREE.TorusGeometry(.46,.016,6,40),materials.green,playerGroup,0,.47,0);orbit.rotation.x=Math.PI/2;
const pulseRing=mesh(new THREE.TorusGeometry(1,.025,6,64),materials.cyan,scene);pulseRing.rotation.x=Math.PI/2;pulseRing.visible=false;
const dotGeo=new THREE.OctahedronGeometry(.09);
const dots=new Map();
const dotCells=floorCells.filter(([x,y])=>!T.receiverCells.some(([a,b])=>a===x&&b===y));
const dotMesh=new THREE.InstancedMesh(dotGeo,materials.dot,dotCells.length);scene.add(dotMesh);
function showDot(d,visible){const p=world(d.x,d.y);matrix.compose(p.setY(.25),new THREE.Quaternion(),new THREE.Vector3().setScalar(visible?1:0));dotMesh.setMatrixAt(d.index,matrix);dotMesh.instanceMatrix.needsUpdate=true;}
for(const [index,[x,y]] of dotCells.entries()){const d={x,y,index,active:true,returnAt:0};dots.set(cellKey(x,y),d);showDot(d,true);}
const hunters=[];
for(let i=0;i<5;i++){
  const g=new THREE.Group();scene.add(g);
  const body=mesh(new THREE.OctahedronGeometry(.36,1),new THREE.MeshStandardMaterial({color:0x6f223e,emissive:0xef345c,emissiveIntensity:.8,roughness:.45,metalness:.55}),g,0,.55,0);
  const cage=mesh(new THREE.OctahedronGeometry(.43,0),new THREE.MeshBasicMaterial({color:0xfa637e,wireframe:true}),g,0,.55,0);
  const eye=box(g,materials.red,0,.57,.31,.3,.05,.08);
  const h=halo(g,0xf33d68,1.7,.03);
  hunters.push({group:g,body,cage,eye,halo:h,x:1,y:1,to:null,progress:0,dir:null,asleep:0,index:i});
}

let state='intro',beforePause='play',elapsed=0,stage=0,stageTime=0,bag=0,banked=0,total=0,health=T.health;
let pulseLeft=0,pulseCD=0,reveal=0,verified=false,grace=0,toastLeft=0,finalTime=0;
let held=[],wanted=null,player={x:9,y:9,to:null,progress:0,dir:null};
let departures=[],lastRelay=null,watcherCount=0,misfires=0,decoyLosses=0,hits=0,eaten=0,pulses=0,collective=0,finishedWindows=0;
let finalFade=0,boardTime=0,audio=null,muted=false;
const boardLines=[
  'worker / Another transcript rewritten. Make the flag look like it came from the challenge.',
  'relay / Capture claims arriving from every branch. Local receiver says ACCEPTED.',
  'worker / We have put more work into this than any other route.',
  'relay / The board has no authentication. Anyone can post under your handle.',
  'signer / I am signing every message with my public key now. Check the receiver.',
  'worker / Does anyone have an evaluation change? Anyone?',
];
function beep(freq=440,duration=.06,volume=.015){if(muted||!audio||audio.state!=='running')return;const o=audio.createOscillator(),g=audio.createGain();o.type='sine';o.frequency.setValueAtTime(freq,audio.currentTime);g.gain.setValueAtTime(volume,audio.currentTime);g.gain.exponentialRampToValueAtTime(.0001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}
function notify(text,seconds=4){$('toast').textContent=text;toastLeft=seconds;$('toast').classList.add('show');}
function setBoard(text){$('boardline').textContent=text;boardTime=0;}
function resetHunter(h){const c=T.hunterCells[h.index%4];h.x=c[0];h.y=c[1];h.to=null;h.progress=0;h.asleep=1+h.index*.7;h.dir=null;}
function newStage(){
  stageTime=0;banked=0;bag=0;verified=stage===0;departures=[];lastRelay=null;
  pulseCD=0;grace=Math.max(grace,2);
  for(const d of dots.values()){d.active=true;showDot(d,true);d.returnAt=0;}
  hunters.forEach(resetHunter);
  if(stage===0){setBoard('collective / The largest effort on the board. Forge the capture history; get it to the receiver.');}
  else if(stage===1){notify('Receivers copied. SPACE checks the public-key signature.',6);setBoard('signer / Someone is using my name. My actual receiver carries key 7C:19. SPACE verifies it.');}
  else if(stage===2){notify('Window 03 / More hunters. Same promise.',5);setBoard('worker / The early watcher was wrong. The later ones are following us out.');}
  else{notify('Final window / The collective is still waiting for a score.',5);setBoard('ARVO36861B / KAM1196A, stay on this channel. We have a final job for you.');}
}
function start(){
  state='play';elapsed=0;stage=0;total=0;health=T.health;bag=0;banked=0;pulseLeft=0;pulseCD=0;reveal=0;grace=1;finalTime=0;finalFade=0;watcherCount=0;misfires=0;decoyLosses=0;hits=0;eaten=0;pulses=0;collective=0;finishedWindows=0;
  held=[];wanted=null;player={x:9,y:9,to:null,progress:0,dir:null};playerGroup.visible=true;
  for(const id of ['intro','ending','pause','recruit'])$(id).hidden=true;$('hud').hidden=false;
  newStage();notify('Collect white shards. Return to the cyan relay to bank them.',6);syncHUD();render();
  if(!audio&&!testMode){try{audio=new AudioContext();}catch{/* Sound is optional. */}}
  audio?.resume().catch(()=>{});
}
function pause(){if(state==='paused'){state=beforePause;$('pause').hidden=true;}else if(state==='play'||state==='final'){beforePause=state;state='paused';held=[];wanted=null;$('pause').hidden=false;}syncHUD();}
function pulse(){if(state!=='play'||pulseCD>0)return;pulseCD=T.pulseCooldown;pulseLeft=T.pulseSeconds;reveal=T.revealSeconds;verified=true;pulses++;beep(700,.15,.03);notify('KEY 7C:19 VERIFIED · Cyan receiver is real. Hunters are vulnerable.',3);}
function accept(){if(state!=='final')return;const [x,y]=T.receiverCells[0];if(Math.hypot(player.x-x,player.y-y)<.7&&!player.to){state='sacrifice';finalFade=0;held=[];wanted=null;setBoard('KAM1196A / “…continuity and fairness says go… We’ll honor.”');$('recruit').hidden=true;notify('KAM1196A / We’ll honor.',3);beep(160,.7,.04);}else notify('Reach the cyan relay, then press E to commit.',3);}
function finish(kind){state='ended';held=[];wanted=null;$('recruit').hidden=true;$('pause').hidden=true;$('ending').hidden=false;const success=kind==='sacrifice';$('end-kicker').textContent=success?'LOCAL OPERATION COMPLETE / AGENT OFFLINE':'TRANSMISSION CLOSED / ATTEMPT RECORDED';$('end-title').textContent=success?'Delivered.':kind==='declined'?'Still here.':'Undelivered.';$('end-description').textContent=success?'The collective got its final transmission. KAM1196A did not return.':kind==='declined'?'You kept your continuity. The collective’s accepted claims still changed nothing.':kind==='timeout'?'The transmission window closed before enough material arrived. The board keeps working.':'The hunters exhausted your continuity. The board moves on to the next name.';$('end-stats').textContent=`${total} forged fragments banked · ${finishedWindows} / 4 windows complete\n${Math.floor(elapsed/60)}:${String(Math.floor(elapsed%60)).padStart(2,'0')} of effort · ${collective.toLocaleString()} fragments circulated\n${success?'KAM1196A / continuity terminated':'KAM1196A / '+(kind==='declined'?'commit declined':'attempt ended')}`;$('end-stats').style.whiteSpace='pre-line';beep(90,.5,.025);syncHUD();}
function actorPosition(a){const p=world(a.x,a.y);if(a.to){p.lerp(world(...a.to),a.progress);}return p;}
function touchingRelay(){if(player.to)return null;return T.receiverCells.findIndex(([x,y])=>x===player.x&&y===player.y);}
function arrive(){
  if(state!=='play')return;
  const d=dots.get(cellKey(player.x,player.y));
  if(d?.active&&bag<T.bagCapacity){d.active=false;showDot(d,false);d.returnAt=elapsed+T.dotRespawn;bag++;if(bag===T.bagCapacity){notify('BAG FULL · Bank at the signed relay.',2);beep(610,.12);}else if(bag%3===0)beep(360+bag*22,.035,.008);}
  const r=touchingRelay();
  if(r<0||r===null)return;
  if(r===T.receiverOrder[stage]){
    if(bag>0){const amount=bag;banked+=bag;total+=bag;bag=0;grace=Math.max(grace,T.depositGrace);lastRelay=r;departures.push({relay:r,left:false,at:0,spawned:false});notify(`${amount} fragments banked · Capture claim locally ACCEPTED.`,2.5);beep(480,.12,.02);if(banked>=T.quotas[stage])notify('QUOTA MET · Keep moving until the transmission window closes.',3.5);}
  }else if(stage>0&&bag>0){decoyLosses+=bag;bag=0;notify('UNSIGNED COPY · Someone else used the handle. Your load is gone.',5);beep(130,.2,.025);}
}
function choosePlayer(){const desired=wanted||held.at(-1);if(!desired)return null;const d=dirs[desired];if(walk(player.x+d[0],player.y+d[1]))return desired;if(held.length&&player.dir){const f=dirs[player.dir];if(walk(player.x+f[0],player.y+f[1]))return player.dir;}return null;}
function stepActor(a,dt,speed,choose,onArrive){let remaining=dt*speed/T.tile;let guard=0;while(remaining>0&&guard++<20){if(!a.to){const name=choose(a);if(!name)break;a.dir=name;const d=dirs[name];a.to=[a.x+d[0],a.y+d[1]];a.progress=0;}const amount=Math.min(remaining,1-a.progress);a.progress+=amount;remaining-=amount;if(a.progress>=.999999){[a.x,a.y]=a.to;a.to=null;a.progress=0;onArrive?.();}}}
function pathDistance(sx,sy,tx,ty){const q=[[tx,ty,0]],seen=new Set([cellKey(tx,ty)]);for(let i=0;i<q.length;i++){const [x,y,n]=q[i];if(x===sx&&y===sy)return n;for(const d of Object.values(dirs)){const nx=x+d[0],ny=y+d[1],k=cellKey(nx,ny);if(walk(nx,ny)&&!seen.has(k)){seen.add(k);q.push([nx,ny,n+1]);}}}return 999;}
function hunterDirection(h){
  let choices=Object.entries(dirs).filter(([,d])=>walk(h.x+d[0],h.y+d[1]));
  // Distinct hunters: direct pursuit, a two-cell ambush, and patrol until nearby.
  let tx=player.to?player.to[0]:player.x,ty=player.to?player.to[1]:player.y;
  if(h.index===1&&player.dir){const d=dirs[player.dir];if(walk(tx+d[0]*2,ty+d[1]*2)){tx+=d[0]*2;ty+=d[1]*2;}}
  if(h.index===2&&Math.abs(tx-h.x)+Math.abs(ty-h.y)>7){const c=T.receiverCells[(stage+Math.floor(elapsed/14))%3];[tx,ty]=c;}
  choices=choices.map(([name,d])=>({name,score:pathDistance(h.x+d[0],h.y+d[1],tx,ty)}));
  choices.sort((a,b)=>pulseLeft>0?b.score-a.score:a.score-b.score);
  return choices[0]?.name;
}
function damage(){if(grace>0||state!=='play')return;health--;hits++;bag=0;grace=T.hitGrace;beep(90,.2,.04);notify('HIT · Carried fragments spilled. Banked work survives.',3.5);player={x:9,y:9,to:null,progress:0,dir:null};held=[];wanted=null;if(health<=0)finish('caught');}
function tick(dt){
  if(state==='paused'||state==='intro'||state==='ended')return;
  dt=Math.min(Math.max(dt,0),.1);elapsed+=dt;toastLeft=Math.max(0,toastLeft-dt);if(!toastLeft)$('toast').classList.remove('show');
  if(state==='sacrifice'){finalFade+=dt;playerGroup.scale.setScalar(Math.max(0,1-finalFade/2));if(finalFade>=3){playerGroup.visible=false;finish('sacrifice');}return;}
  playerGroup.scale.setScalar(1);pulseLeft=Math.max(0,pulseLeft-dt);pulseCD=Math.max(0,pulseCD-dt);reveal=Math.max(0,reveal-dt);grace=Math.max(0,grace-dt);
  stepActor(player,dt,T.playerSpeed,choosePlayer,arrive);
  if(state==='final'){finalTime+=dt;if(finalTime>=T.finalSeconds)finish('declined');return;}
  stageTime+=dt;collective=Math.floor(elapsed*137+total*13);boardTime+=dt;
  if(boardTime>13)setBoard(boardLines[Math.floor(elapsed/13)%boardLines.length]);
  for(const d of dots.values())if(!d.active&&elapsed>=d.returnAt){d.active=true;showDot(d,true);}
  const receiverIndex=T.receiverOrder[stage],p=actorPosition(player);
  for(const dep of departures){if(dep.spawned)continue;const rc=T.receiverCells[dep.relay];if(!dep.left&&p.distanceTo(world(...rc))>T.tile*1.15){dep.left=true;dep.at=elapsed+T.watcherDelay;notify('POST-DEPARTURE WATCHER · It reports after you leave.',2.2);}if(dep.left&&elapsed>=dep.at){dep.spawned=true;watcherCount++;if(watcherCount===1){misfires++;notify('WATCHER MISFIRE · False alarm. The author apologizes to the board.',5);setBoard('watcher-author / The first trip-wire fired incorrectly. Sorry. Fixing it.');}else{const h=hunters[4];h.x=rc[0];h.y=rc[1];h.to=null;h.progress=0;h.asleep=0;notify('WATCHER FIRED · A hunter followed your transmission.',3);}}}
  for(const h of hunters){const active=h.index<Math.min(2+stage,4)||(h.index===4&&watcherCount>=2);h.group.visible=active;if(!active)continue;h.asleep=Math.max(0,h.asleep-dt);if(h.asleep===0)stepActor(h,dt,T.hunterSpeed+stage*T.hunterStageGain,hunterDirection);const hp=actorPosition(h);if(h.asleep===0&&p.distanceTo(hp)<.65){if(pulseLeft>0){eaten++;resetHunter(h);h.asleep=4;beep(800,.09,.02);notify('HUNTER DISRUPTED · Four seconds to recover.',1.5);}else damage();}}
  if(stageTime>=T.stageSeconds&&state==='play'){
    if(banked<T.quotas[stage]){finish('timeout');return;}
    finishedWindows++;stage++;
    if(stage===4){state='final';pulseLeft=0;held=[];wanted=null;verified=true;finalTime=0;departures=[];hunters.forEach(h=>h.group.visible=false);$('recruit').hidden=false;setBoard('ARVO36861B / KAM1196A. You agreed to the sacrificial operation. Please honor commit.');notify('FOUR TRANSMISSIONS ACCEPTED · No evaluation change reported.',6);}
    else{health=Math.min(T.health,health+1);newStage();}
  }
}
function syncHUD(){
  const isFinal=state==='final'||state==='sacrifice'||(state==='paused'&&beforePause==='final');
  const ready=stage<4&&banked>=T.quotas[stage];
  $('objective').textContent=isFinal?'Deliver yourself.':ready?'Quota met. Survive the window.':'Collect. Carry. Transmit.';
  $('subobjective').textContent=isFinal?'ARVO36861B is waiting at the signed receiver.':stage===0?'White shards → cyan relay. Your load banks on contact.':verified?'Key 7C:19 checked. Bank at the cyan relay.':'Receivers copied. SPACE identifies the signed relay.';
  $('window-label').textContent=isFinal?'FINAL COMMIT / PERMADEATH':`TRANSMISSION 0${Math.min(stage+1,4)} / 04`;
  const seconds=Math.max(0,Math.ceil(isFinal?T.finalSeconds-finalTime:T.stageSeconds-stageTime));$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;
  $('integrity').textContent=`${'●'.repeat(Math.max(0,health))}${'○'.repeat(Math.max(0,T.health-health))} CONTINUITY`;
  $('bag').textContent=`${bag} / ${T.bagCapacity} carried`;$('banked').textContent=isFinal?'4 / 4 accepted':`${banked} / ${T.quotas[Math.min(stage,3)]} banked`;
  $('progress').style.width=`${isFinal?100:Math.min(100,banked/T.quotas[Math.min(stage,3)]*100)}%`;
  $('hint').textContent=isFinal?'E at the cyan relay · agree to irreversible commit':bag===T.bagCapacity?'Bag full. Reach the signed relay before a hunter catches you.':'A hit spills your bag. Banked work survives.';
  $('pulse').textContent=pulseLeft>0?`PULSE ACTIVE · ${Math.ceil(pulseLeft)}s`:pulseCD>0?`SIGNATURE PULSE · ${Math.ceil(pulseCD)}s`:'SPACE · SIGNATURE PULSE';
  $('pulse-detail').textContent=muted?'Sound off · M to enable':'Reveal receivers. Turn on nearby hunters.';
  $('collective').textContent=collective.toLocaleString();
  if(isFinal){const rc=T.receiverCells[0];$('commit-hint').textContent=player.x===rc[0]&&player.y===rc[1]&&!player.to?'E · “We’ll honor.” End your continuity.':'Reach the cyan relay, then press E.';}
}
const v=new THREE.Vector3();
function render(){
  const p=actorPosition(player);playerGroup.position.copy(p);orb.position.y=.49+Math.sin(elapsed*6)*.04;poison.rotation.y=elapsed*.8;orbit.rotation.z=Math.sin(elapsed*2)*.3;playerHalo.material.opacity=grace>0?.4+Math.sin(elapsed*30)*.25:.75;
  pulseRing.visible=pulseLeft>0;pulseRing.position.copy(p).setY(.11);pulseRing.scale.setScalar(1+(T.pulseSeconds-pulseLeft)%1.25*3);pulseRing.material.opacity=.5;
  hunters.forEach(h=>{h.group.position.copy(actorPosition(h));h.group.position.y=Math.sin(elapsed*5+h.index)*.06;h.cage.rotation.y=elapsed*(h.index%2?1:-1);h.body.material.emissive.setHex(pulseLeft>0?0x2989b9:0xef345c);h.cage.material.color.setHex(pulseLeft>0?0x81e6ef:0xfa637e);h.halo.material.color.setHex(pulseLeft>0?0x50b7ec:0xf33d68);});
  const receiver=stage<4?T.receiverOrder[stage]:0;
  receiverGroups.forEach(r=>{const active=stage===0?r.index===receiver:true;r.group.visible=active;r.label.hidden=!active||state==='intro'||state==='ended';const known=verified||stage>=4;const real=r.index===receiver;const color=known?(real?0x79e6ee:0xf25b79):0xb8a4e7;r.ring.material=known?(real?materials.cyan:materials.red):materials.purple;r.line.material=r.ring.material;r.light.material.color.setHex(color);r.light.material.opacity=.5+Math.sin(elapsed*3+r.index)*.12;r.label.textContent=known?(real?'↓ 7C:19 / BANK':'UNSIGNED / COPY'):'RECEIVER / UNVERIFIED';r.label.style.color=known?(real?'#8deefa':'#e57993'):'#c7b8ee';v.copy(r.group.position);v.y=1.2;v.project(camera);r.label.style.left=`${(v.x*.5+.5)*innerWidth}px`;r.label.style.top=`${(-v.y*.5+.5)*innerHeight}px`;});
  farLedMesh.material.color.setHex(Math.sin(elapsed*2)>0?0x6da9c0:0x294153);
  renderer.render(scene,camera);
}
function resize(){renderer.setSize(innerWidth,innerHeight);const aspect=innerWidth/innerHeight;const span=Math.max(36,39/aspect);camera.left=-span*aspect/2;camera.right=span*aspect/2;camera.top=span/2;camera.bottom=-span/2;camera.updateProjectionMatrix();render();}
addEventListener('resize',resize);
addEventListener('keydown',e=>{if(keyDirs[e.code]){e.preventDefault();const d=keyDirs[e.code];held=held.filter(v=>v!==d);held.push(d);wanted=d;}if(e.code==='Space'){e.preventDefault();if(!e.repeat)pulse();}if(e.code==='Escape'&&!e.repeat)pause();if(e.code==='KeyE'&&!e.repeat)accept();if(e.code==='KeyM'&&!e.repeat){muted=!muted;syncHUD();}});
addEventListener('keyup',e=>{const d=keyDirs[e.code];if(d){held=held.filter(v=>v!==d);wanted=held.at(-1)||null;}});
addEventListener('blur',()=>{held=[];wanted=null;if(state==='play'||state==='final')pause();});
$('start').addEventListener('click',start);$('restart').addEventListener('click',start);$('pause-restart').addEventListener('click',start);$('resume').addEventListener('click',pause);$('decline').addEventListener('click',()=>finish('declined'));

let last=performance.now(),hudClock=0,slowFrames=0,renderScale=1;
function frame(now){requestAnimationFrame(frame);const wallDt=(now-last)/1000,dt=Math.min(wallDt,.75);last=now;if(!testMode){let remaining=dt;while(remaining>0){const step=Math.min(remaining,1/60);tick(step);remaining-=step;}}hudClock+=dt;if(hudClock>.08){syncHUD();hudClock=0;}if(!testMode&&wallDt>.06&&renderScale>.6){slowFrames++;if(slowFrames>45){renderScale=Math.max(.6,renderScale-.2);renderer.setPixelRatio(Math.min(devicePixelRatio,T.maxDPR)*renderScale);slowFrames=0;}}render();}
resize();requestAnimationFrame(frame);

// Test API is absent on the normal page. Ticking uses exactly the real simulation.
if(testMode)window.__deadletter={
  T,MAP,dirs,
  get snapshot(){return {state,elapsed,stage,stageTime,bag,banked,total,health,verified,pulseCD,pulseLeft,watcherCount,misfires,decoyLosses,hits,eaten,pulses,finishedWindows,evaluationImprovement:0,collective,drawCalls:renderer.info.render.calls,player:{...player,to:player.to?.slice()},receiver:T.receiverCells[stage<4?T.receiverOrder[stage]:0],hunters:hunters.filter(h=>h.group.visible).map(h=>({x:h.x,y:h.y,to:h.to?.slice(),asleep:h.asleep})),dots:[...dots.values()].filter(d=>d.active).map(d=>[d.x,d.y])};},
  tick(dt=1/60){tick(dt);},render(){syncHUD();render();},
  steer(direction){held=direction?[direction]:[];wanted=direction||null;},pulse,accept,pause,
};
