/* LUCID backbone */
(() => {
  const STORAGE = "lucid.dreams.v1";
  const canvas = document.getElementById("view");
  const state = {
    started: false, paused: false, designOpen: false,
    yaw: 0, pitch: -0.08,
    move: { x: 0, y: 0 }, look: { x: 0, y: 0 },
    keys: {}, objects: [],
    fogColor: new THREE.Color(0x8a93a0),
    generating: false, currentName: "untitled dream",
  };
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: "high-performance" });
  renderer.setClearColor(0x8a93a0, 1);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  const scene = new THREE.Scene();
  scene.background = state.fogColor.clone();
  scene.fog = new THREE.Fog(state.fogColor.getHex(), 8, 42);
  const camera = new THREE.PerspectiveCamera(58, 16 / 9, 0.08, 80);
  camera.position.set(0, 1.55, 6);
  const hemi = new THREE.HemisphereLight(0xb8c0cc, 0x2a2e36, 0.95); scene.add(hemi);
  const dir = new THREE.DirectionalLight(0xe8d5a3, 0.55); dir.position.set(-8, 14, 6); scene.add(dir);
  function makeGridTex() {
    const c = document.createElement("canvas"); c.width = 128; c.height = 128;
    const g = c.getContext("2d"); g.fillStyle = "#3d4452"; g.fillRect(0,0,128,128);
    g.fillStyle = "#454c5c"; g.fillRect(0,0,64,64); g.fillRect(64,64,64,64);
    const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(80,80); return t;
  }
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(400,400), new THREE.MeshLambertMaterial({ map: makeGridTex(), color: 0x9aa3b0 }));
  floor.rotation.x = -Math.PI/2; scene.add(floor);
  const moon = new THREE.Mesh(new THREE.IcosahedronGeometry(3.2,0), new THREE.MeshLambertMaterial({ color: 0xe6d8b8, emissive: 0x3a3428, emissiveIntensity: 0.4 }));
  moon.position.set(-12,16,-28); scene.add(moon);
  const blockMat = new THREE.MeshLambertMaterial({ color: 0x5a6270 });
  for (let i=0;i<18;i++){ const h=1+Math.random()*6; const m=new THREE.Mesh(new THREE.BoxGeometry(2+Math.random()*4,h,2+Math.random()*3), blockMat);
    const a=Math.random()*Math.PI*2,r=28+Math.random()*40; m.position.set(Math.cos(a)*r,h/2,Math.sin(a)*r); scene.add(m); }
  const worldRoot = new THREE.Group(); scene.add(worldRoot);
  function lamb(color){ return new THREE.MeshLambertMaterial({ color }); }
  function dummyPerson(color){
    const g=new THREE.Group();
    const torso=new THREE.Mesh(new THREE.BoxGeometry(0.46,0.72,0.26), lamb(color||0x6a7380)); torso.position.y=1.08;
    const head=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.32,0.28), lamb(0xc9b7a6)); head.position.y=1.58;
    const legs=new THREE.Mesh(new THREE.BoxGeometry(0.4,0.72,0.22), lamb(0x2a3038)); legs.position.y=0.36;
    g.add(torso,head,legs); return g;
  }
  function parsePrompt(text){
    const t=(text||"").toLowerCase();
    const colorMap=[["red",0x8a3030],["blue",0x2c4a7a],["yellow",0xc4a22a],["gold",0xc4a22a],["green",0x3a6a3e],["white",0xd8d2c8],["black",0x1c1c20],["purple",0x5a3a6a],["orange",0xb86428],["teal",0x2a6a68],["gray",0x6a7080],["grey",0x6a7080],["burgundy",0x6a2838]];
    let color=null; for (const [k,v] of colorMap) if (t.includes(k)) { color=v; break; }
    if (/(sky|dusk|dawn|night|fog|weather|make it)/.test(t) && !/(person|man|woman|car|taxi|tree|lamp|stair)/.test(t)) return {kind:"sky",color,raw:t};
    if (/(taxi|cab)/.test(t)) return {kind:"taxi",color:color||0xc4a22a,raw:t};
    if (/(car|sedan|vehicle|truck)/.test(t)) return {kind:"car",color:color||0x6a2838,raw:t};
    if (/(woman|girl)/.test(t)) return {kind:"woman",color,raw:t};
    if (/(raincoat|stranger)/.test(t)) return {kind:"raincoat",color,raw:t};
    if (/(suit|man|person|people|figure|someone)/.test(t)) return {kind:"suit",color,raw:t};
    if (/(lamp|light)/.test(t)) return {kind:"lamp",color,raw:t};
    if (/(stair|steps)/.test(t)) return {kind:"stairs",color,raw:t};
    if (/(tree|forest)/.test(t)) return {kind:"tree",color,raw:t};
    if (/(bench|seat)/.test(t)) return {kind:"bench",color:color||0x4a4034,raw:t};
    if (/(door|portal)/.test(t)) return {kind:"door",color:color||0x3a2a22,raw:t};
    if (/(house|building|wall|tower)/.test(t)) return {kind:"building",color:color||0x5a6270,raw:t};
    if (/(cube|box)/.test(t)) return {kind:"cube",color:color||0x6a7080,raw:t};
    if (/(fountain|pool|water)/.test(t)) return {kind:"fountain",color:color||0x6a8088,raw:t};
    return {kind:"mystery",color:color||0xb8a878,raw:t};
  }
  function spawnFromSpec(spec,pos,rotY){
    const g=new THREE.Group(); g.position.copy(pos); g.rotation.y=rotY||0; g.userData.spec=spec;
    const addShadow=(w=1.2)=>{ const sh=new THREE.Mesh(new THREE.CircleGeometry(w,10), new THREE.MeshBasicMaterial({color:0x000000,transparent:true,opacity:0.28})); sh.rotation.x=-Math.PI/2; sh.position.y=0.02; g.add(sh); };
    if (spec.kind==="raincoat") { g.add(dummyPerson(0x6a7380)); addShadow(0.55); }
    else if (spec.kind==="suit") { g.add(dummyPerson(0x1c1c20)); addShadow(0.55); }
    else if (spec.kind==="woman") { g.add(dummyPerson(0xd8d2c8)); addShadow(0.5); }
    else if (spec.kind==="car"||spec.kind==="taxi") {
      const body=new THREE.Mesh(new THREE.BoxGeometry(2.6,0.7,1.2), lamb(spec.color||0x6a2838)); body.position.y=0.45;
      const cabin=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.5,1.1), lamb(0x222830)); cabin.position.set(-0.2,0.95,0);
      g.add(body,cabin); addShadow(1.6);
    } else if (spec.kind==="lamp") {
      const pole=new THREE.Mesh(new THREE.CylinderGeometry(0.05,0.08,2.4,6), lamb(0x3a4048)); pole.position.y=1.2;
      const head=new THREE.Mesh(new THREE.BoxGeometry(0.28,0.18,0.28), lamb(0xe8d5a3)); head.position.set(0.15,2.3,0);
      const light=new THREE.PointLight(0xffd9a0,1.1,10,2); light.position.set(0.15,2.2,0);
      g.add(pole,head,light); addShadow(0.4);
    } else if (spec.kind==="stairs") {
      for (let i=0;i<8;i++){ const st=new THREE.Mesh(new THREE.BoxGeometry(1.4,0.22,0.45), lamb(0x6a7080)); st.position.set(0,0.11+i*0.22,-i*0.4); g.add(st); }
      addShadow(1.1);
    } else if (spec.kind==="tree") {
      const trunk=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.18,1.4,5), lamb(0x5a4030)); trunk.position.y=0.7;
      const leaves=new THREE.Mesh(new THREE.IcosahedronGeometry(0.7,0), lamb(0x3a5a38)); leaves.position.y=1.7;
      g.add(trunk,leaves); addShadow(0.9);
    } else if (spec.kind==="bench") {
      const seat=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.12,0.5), lamb(spec.color)); seat.position.y=0.45;
      const leg1=new THREE.Mesh(new THREE.BoxGeometry(0.1,0.45,0.5), lamb(0x2a2a28)); const leg2=leg1.clone();
      leg1.position.set(-0.65,0.22,0); leg2.position.set(0.65,0.22,0);
      const back=new THREE.Mesh(new THREE.BoxGeometry(1.6,0.5,0.08), lamb(spec.color)); back.position.set(0,0.74,-0.22);
      g.add(seat,leg1,leg2,back); addShadow(0.9);
    } else if (spec.kind==="door") {
      const frame=new THREE.Mesh(new THREE.BoxGeometry(1.4,2.4,0.16), lamb(spec.color)); frame.position.y=1.2;
      const inner=new THREE.Mesh(new THREE.BoxGeometry(1.0,2.0,0.08), new THREE.MeshLambertMaterial({color:0x10141c,emissive:0x1a2436,emissiveIntensity:0.6})); inner.position.set(0,1.15,0.04);
      g.add(frame,inner); addShadow(0.7);
    } else if (spec.kind==="building") {
      const h=3+Math.random()*4; const b=new THREE.Mesh(new THREE.BoxGeometry(3.2,h,2.4), lamb(spec.color)); b.position.y=h/2; g.add(b); addShadow(1.8);
    } else if (spec.kind==="cube") {
      const b=new THREE.Mesh(new THREE.BoxGeometry(1.2,1.2,1.2), lamb(spec.color)); b.position.y=0.6; g.add(b); addShadow(0.8);
    } else if (spec.kind==="fountain") {
      const base=new THREE.Mesh(new THREE.CylinderGeometry(1.2,1.4,0.35,8), lamb(0x6a7080)); base.position.y=0.18;
      const water=new THREE.Mesh(new THREE.CylinderGeometry(0.9,0.9,0.08,10), new THREE.MeshLambertMaterial({color:0x6a90a0,emissive:0x123040,emissiveIntensity:0.4})); water.position.y=0.38;
      const stem=new THREE.Mesh(new THREE.CylinderGeometry(0.12,0.16,0.8,6), lamb(0x7a8088)); stem.position.y=0.75;
      g.add(base,water,stem); addShadow(1.3);
    } else {
      const core=new THREE.Mesh(new THREE.IcosahedronGeometry(0.55,0), new THREE.MeshLambertMaterial({color:spec.color,emissive:spec.color,emissiveIntensity:0.18})); core.position.y=1.15;
      const plinth=new THREE.Mesh(new THREE.CylinderGeometry(0.35,0.45,0.2,6), lamb(0x4a5060)); plinth.position.y=0.1;
      g.add(core,plinth); addShadow(0.6); g.userData.spin=0.4;
    }
    worldRoot.add(g); state.objects.push(g); return g;
  }
  function applySky(spec){
    const t=spec.raw||""; let fog=0x8a93a0, hemiSky=0xb8c0cc, hemiG=0x2a2e36, dirC=0xe8d5a3, intensity=0.55;
    if (/red|dusk|sunset/.test(t)) { fog=0xa07060; hemiSky=0xc88870; hemiG=0x2a1814; dirC=0xffb080; intensity=0.7; }
    else if (/night|dark|black/.test(t)) { fog=0x1c2430; hemiSky=0x3a4860; hemiG=0x0a0c10; dirC=0x88a0c0; intensity=0.25; }
    else if (/dawn|morning|gold/.test(t)) { fog=0xc0b090; hemiSky=0xe8d0a8; hemiG=0x3a3020; dirC=0xffe0a0; intensity=0.8; }
    else if (/blue|cold/.test(t)) { fog=0x6a88a8; hemiSky=0xa8c0d8; hemiG=0x1a2430; dirC=0xd0e4ff; intensity=0.5; }
    state.fogColor.setHex(fog); scene.background=state.fogColor.clone(); scene.fog.color.copy(state.fogColor);
    renderer.setClearColor(fog,1); hemi.color.setHex(hemiSky); hemi.groundColor.setHex(hemiG); dir.color.setHex(dirC); dir.intensity=intensity;
  }
  function frontSpawnPos(dist){ const dirv=new THREE.Vector3(); camera.getWorldDirection(dirv); dirv.y=0; dirv.normalize(); return new THREE.Vector3(camera.position.x+dirv.x*dist,0,camera.position.z+dirv.z*dist); }
  function weave(text){
    if (state.generating) return;
    const raw=(text||document.getElementById("prompt").value||"").trim(); if (!raw) return;
    const spec=parsePrompt(raw); spec.prompt=raw; state.generating=true;
    document.getElementById("weave").classList.add("show");
    document.getElementById("weave-line").textContent=raw.toUpperCase();
    setTimeout(()=>{
      if (spec.kind==="sky") applySky(spec);
      else { const obj=spawnFromSpec(spec, frontSpawnPos(6.2), state.yaw); obj.scale.setScalar(0.01);
        const start=performance.now(); const grow=()=>{ const k=Math.min(1,(performance.now()-start)/420); obj.scale.setScalar(1-Math.pow(1-k,3)); if (k<1) requestAnimationFrame(grow); }; grow(); }
      document.getElementById("weave").classList.remove("show"); state.generating=false; setStatus("WOVE · "+raw.toUpperCase().slice(0,28));
    },700);
  }
  function clearVoid(keepSky){ while(worldRoot.children.length) worldRoot.remove(worldRoot.children[0]); state.objects=[]; if(!keepSky) applySky({raw:"gray fog void"}); }
  function serialize(){ return {name:state.currentName,savedAt:Date.now(),fog:state.fogColor.getHex(),yaw:state.yaw,pitch:state.pitch,pos:{x:camera.position.x,y:camera.position.y,z:camera.position.z},objects:state.objects.map(o=>({spec:o.userData.spec,x:o.position.x,z:o.position.z,rot:o.rotation.y}))}; }
  function loadDream(data){ clearVoid(true); state.currentName=data.name||"untitled dream"; applySky({raw: data.fog<0x303840?"night dark":"gray fog"}); if(data.pos) camera.position.set(data.pos.x,data.pos.y,data.pos.z); state.yaw=data.yaw||0; state.pitch=data.pitch||-0.08; (data.objects||[]).forEach(o=>spawnFromSpec(o.spec,new THREE.Vector3(o.x,0,o.z),o.rot)); setStatus("RETURNED · "+state.currentName.toUpperCase()); }
  function allDreams(){ try{return JSON.parse(localStorage.getItem(STORAGE)||"[]");}catch(e){return[];} }
  function persist(list){ localStorage.setItem(STORAGE, JSON.stringify(list)); }
  function saveDream(){ const name=(document.getElementById("dream-name").value||state.currentName||"untitled").trim(); state.currentName=name; const list=allDreams().filter(d=>d.name!==name); list.unshift(serialize()); persist(list.slice(0,24)); renderDreamList(); setStatus("SAVED · "+name.toUpperCase()); }
  function renderDreamList(){ const el=document.getElementById("dream-list"); const list=allDreams(); if(!list.length){el.innerHTML='<p class="sub">No saved dreams yet.</p>';return;} el.innerHTML=list.map((d,i)=>`<div class="dream-item"><div><b>${escapeHtml(d.name)}</b><br><span>${new Date(d.savedAt).toLocaleString()} · ${d.objects.length} forms</span></div><div class="row" style="margin:0"><button class="btn" data-load="${i}">ENTER</button><button class="btn ghost" data-del="${i}">×</button></div></div>`).join(""); el.querySelectorAll("[data-load]").forEach(b=>b.onclick=()=>{loadDream(allDreams()[+b.dataset.load]);toggleDesign(false);}); el.querySelectorAll("[data-del]").forEach(b=>b.onclick=()=>{const l=allDreams();l.splice(+b.dataset.del,1);persist(l);renderDreamList();}); }
  function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&","<":"<",">":">",'"':""","'":"&#39;"}[c]));}
  function setStatus(t){ document.getElementById("status").textContent=t; }
  function toggleDesign(force){ state.designOpen=force==null?!state.designOpen:force; document.getElementById("design-panel").classList.toggle("open", state.designOpen); }
  function startGame(){ document.getElementById("title-screen").style.display="none"; state.started=true; state.paused=false; document.getElementById("pause").classList.remove("open"); setStatus("BACKBONE · WALK"); }
  function wake(){ state.started=false; state.paused=false; document.getElementById("title-screen").style.display=""; document.getElementById("pause").classList.remove("open"); toggleDesign(false); }
  function togglePause(){ if(!state.started){startGame();return;} if(state.designOpen){toggleDesign(false);return;} state.paused=!state.paused; document.getElementById("pause").classList.toggle("open", state.paused); }
  window.addEventListener("keydown",e=>{ state.keys[e.code]=true; if(e.code==="Tab"||e.code==="KeyE"){e.preventDefault();toggleDesign();} if(e.code==="Escape")togglePause(); if(e.code==="Enter"&&state.designOpen)weave(); if(e.code==="Space"&&!state.started)startGame(); });
  window.addEventListener("keyup",e=>{ state.keys[e.code]=false; });
  function bindStick(el,knob,target){ let pid=null; const go=(x,y)=>{ const r=el.getBoundingClientRect(); let dx=x-(r.left+r.width/2), dy=y-(r.top+r.height/2); const max=r.width*0.38, mag=Math.hypot(dx,dy)||1; if(mag>max){dx*=max/mag;dy*=max/mag;} knob.style.transform="translate(calc(-50% + "+dx+"px), calc(-50% + "+dy+"px))"; target.x=dx/max; target.y=dy/max; }; const end=()=>{pid=null;knob.style.transform="translate(-50%,-50%)";target.x=0;target.y=0;}; el.addEventListener("pointerdown",e=>{pid=e.pointerId;el.setPointerCapture(pid);go(e.clientX,e.clientY);}); el.addEventListener("pointermove",e=>{if(e.pointerId===pid)go(e.clientX,e.clientY);}); el.addEventListener("pointerup",end); el.addEventListener("pointercancel",end); }
  bindStick(document.getElementById("stick-move"), document.getElementById("knob-move"), state.move);
  bindStick(document.getElementById("stick-look"), document.getElementById("knob-look"), state.look);
  function btn(gp,i){ const b=gp.buttons&&gp.buttons[i]; if(!b) return 0; return typeof b==="object" ? (b.value|| (b.pressed?1:0)) : (b?1:0); }
  function ax(gp,i){ const v=(gp.axes&&gp.axes[i])||0; return Math.abs(v)<0.14?0:v; }
  function pickPad(){ const list=navigator.getGamepads?navigator.getGamepads():[]; for(let i=0;i<list.length;i++){ if(list[i]&&list[i].connected) return list[i]; } return null; }
  const padPrev={}; let padLive=false;
  function readPad(){
    const gp=pickPad(); if(!gp) return;
    if(!padLive){ padLive=true; document.body.classList.add("backbone"); setStatus("BACKBONE LIVE"); }
    let mx=ax(gp,0), my=ax(gp,1), lx=ax(gp,2), ly=ax(gp,3);
    if (gp.axes && gp.axes.length>=6 && Math.abs(lx)+Math.abs(ly)<0.02){ lx=ax(gp,3); ly=ax(gp,4); }
    if (btn(gp,14)>0.4) mx-=1; if (btn(gp,15)>0.4) mx+=1; if (btn(gp,12)>0.4) my-=1; if (btn(gp,13)>0.4) my+=1;
    if(!state.designOpen){ state.move.x=mx; state.move.y=my; state.look.x=lx; state.look.y=ly; }
    const down=i=>btn(gp,i)>0.45; const edge=i=>{ const p=down(i), was=padPrev[i]; padPrev[i]=p; return p&&!was; };
    if (edge(9)||edge(8)||edge(16)) togglePause();
    if (edge(5)||edge(4)||edge(7)||edge(6)||edge(3)) toggleDesign();
    if ((edge(0)||edge(2)) && !state.started) startGame();
    if (edge(0) && state.designOpen) weave();
    if (edge(1) && state.designOpen) toggleDesign(false);
  }
  window.addEventListener("gamepadconnected", ()=>{ document.body.classList.add("backbone"); setStatus("BACKBONE CONNECTED"); });
  ["touchstart","pointerdown","keydown","click"].forEach(ev=>window.addEventListener(ev, ()=>{ try{ navigator.getGamepads(); }catch(e){} }, {passive:true}));
  document.getElementById("btn-start").onclick=startGame;
  document.getElementById("design-tab").onclick=()=>toggleDesign();
  document.getElementById("btn-close").onclick=()=>toggleDesign(false);
  document.getElementById("btn-weave").onclick=()=>weave();
  document.getElementById("btn-clear").onclick=()=>{ clearVoid(); setStatus("THE VOID AGAIN"); };
  document.getElementById("btn-save").onclick=saveDream;
  document.getElementById("btn-resume").onclick=()=>togglePause();
  document.getElementById("btn-to-title").onclick=wake;
  document.getElementById("chips").onclick=e=>{ const b=e.target.closest(".chip"); if(!b) return; document.getElementById("prompt").value=b.dataset.fill; };
  renderDreamList();
  function resize(){ const w=window.innerWidth,h=window.innerHeight; const iw=640, ih=Math.max(280,Math.round(640*(h/w))); renderer.setSize(iw,ih,false); canvas.style.width=w+"px"; canvas.style.height=h+"px"; camera.aspect=iw/ih; camera.updateProjectionMatrix(); }
  window.addEventListener("resize", resize); resize();
  const clock=new THREE.Clock();
  function tick(){
    requestAnimationFrame(tick);
    const dt=Math.min(0.05, clock.getDelta());
    readPad();
    moon.rotation.y+=dt*0.04;
    for (const o of state.objects) if (o.userData.spin) o.children[0].rotation.y+=dt*o.userData.spin;
    if (!state.started||state.paused||state.designOpen){ renderer.render(scene,camera); return; }
    let mx=state.move.x, my=state.move.y;
    if (state.keys.KeyA||state.keys.ArrowLeft) mx-=1;
    if (state.keys.KeyD||state.keys.ArrowRight) mx+=1;
    if (state.keys.KeyW||state.keys.ArrowUp) my-=1;
    if (state.keys.KeyS||state.keys.ArrowDown) my+=1;
    state.yaw-=state.look.x*1.8*dt; state.pitch-=state.look.y*1.4*dt; state.pitch=Math.max(-1.2,Math.min(0.6,state.pitch));
    camera.rotation.order="YXZ"; camera.rotation.y=state.yaw; camera.rotation.x=state.pitch;
    const forward=new THREE.Vector3(0,0,-1).applyAxisAngle(new THREE.Vector3(0,1,0), state.yaw);
    const right=new THREE.Vector3(1,0,0).applyAxisAngle(new THREE.Vector3(0,1,0), state.yaw);
    const speed=state.keys.ShiftLeft?7.2:4.0;
    camera.position.addScaledVector(forward, -my*speed*dt);
    camera.position.addScaledVector(right, mx*speed*dt);
    camera.position.y=1.55+Math.sin(performance.now()*0.006)*Math.min(0.035, Math.hypot(mx,my)*0.04);
    renderer.render(scene,camera);
  }
  tick();
})();
