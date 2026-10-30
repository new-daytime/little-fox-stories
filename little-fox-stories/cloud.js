/* Little Fox cloud saves: hunter name + PIN, synced through Firebase. Only runs on the hosted site. */
(function(){
  const CFG={apiKey:"AIzaSyBzIXuSET9xrP70OKFBoxt0CHFAuW2LP6E",authDomain:"little-fox-stories.firebaseapp.com",projectId:"little-fox-stories",storageBucket:"little-fox-stories.firebasestorage.app",messagingSenderId:"462607560669",appId:"1:462607560669:web:ea8805c7729f782ce29034"};
  const V='13.1.0', BASE='https://www.gstatic.com/firebasejs/'+V+'/';
  const KEYS=['foxProfile','foxEvents','foxStoriesDone','foxHunt','foxCampaign1'];
  const DOMAIN='@players.littlefox.game';
  const hosted=/github\.io$/.test(location.hostname)||window.__cloudTest;
  const listeners=[];
  const C=window.FoxCloud={on:false,user:null,name:null,status:hosted?'loading':'off',lastSync:0,
    onChange(fn){ listeners.push(fn); }, emit(){ listeners.forEach(f=>{ try{ f(C); }catch(e){} }); }};
  if(!hosted) return;
  // A cloud save was just applied: re-apply it before the page's own scripts run (the old page may have saved over it while unloading).
  try{ const ap=sessionStorage.getItem('foxApplied'); if(ap){ const o=JSON.parse(ap); for(const k of KEYS){ if(o[k]!=null) localStorage.setItem(k,o[k]); else localStorage.removeItem(k); } sessionStorage.removeItem('foxApplied'); } }catch(e){}
  const norm=n=>String(n||'').toLowerCase().replace(/[^a-z0-9]/g,'');
  const pw=pin=>'lfs-'+pin+'-moon16';
  const ls=k=>{ try{ return localStorage.getItem(k); }catch(e){ return null; } };
  const lsSet=(k,v)=>{ try{ if(v==null) localStorage.removeItem(k); else localStorage.setItem(k,v); }catch(e){} };
  function snapshot(){ const d={}; for(const k of KEYS){ const v=ls(k); if(v!=null) d[k]=v; } return d; }
  const VOLATILE=['lastStart','lastNote','cloudAsked'];
  function stable(k,v){ if(k!=='foxProfile'||!v) return v||''; try{ const o=JSON.parse(v); for(const x of VOLATILE) delete o[x]; return JSON.stringify(o); }catch(e){ return v; } }
  function hash(d){ const s=KEYS.map(k=>k+'='+stable(k,d[k])).join('|'); let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193)>>>0; } return h.toString(36); }
  function summary(d){ let xp=0,coins=0,name='',wins=0; try{ const p=JSON.parse(d.foxProfile||'{}'); xp=p.xp||0; coins=p.coins||0; name=p.name||''; }catch(e){}
    try{ const s=JSON.parse(d.foxCampaign1||'{}'); for(const h of Object.values(s.hunts||{})) wins+=(h.clears||0)+(h.captures||0); }catch(e){}
    let ev=0; try{ ev=JSON.parse(d.foxEvents||'[]').length; }catch(e){}
    return {xp,coins,name,wins,level:1+Math.floor(Math.sqrt(xp/40)),score:xp+wins*120+ev*5}; }
  C.summary=summary; C.snapshot=snapshot;
  C.hasLocalProgress=()=>{ const s=summary(snapshot()); return s.xp>=60||s.wins>0; };
  let fb=null, docRef=null, pushing=false, timer=null;
  async function load(){ if(fb) return fb;
    const [app,auth,fs]=await Promise.all([import(BASE+'firebase-app.js'),import(BASE+'firebase-auth.js'),import(BASE+'firebase-firestore.js')]);
    const a=app.initializeApp(CFG); fb={auth:auth.getAuth(a),A:auth,db:fs.getFirestore(a),F:fs}; return fb; }
  async function fetchCloud(){ const s=await fb.F.getDoc(docRef); return s.exists()?s.data():null; }
  function applyCloud(c){ for(const k of KEYS) lsSet(k,c.data&&c.data[k]!=null?c.data[k]:null); try{ sessionStorage.setItem('foxApplied',JSON.stringify(c.data||{})); }catch(e){} lsSet('foxSyncHash',c.hash); C.lastSync=c.updatedAt||Date.now(); }
  async function push(force){ if(!docRef||pushing) return; const d=snapshot(), h=hash(d); if(!force&&h===ls('foxSyncHash')) return;
    pushing=true; try{ const s=summary(d); await fb.F.setDoc(docRef,{name:C.name,display:s.name||C.name,data:d,hash:h,updatedAt:Date.now(),xp:s.xp,coins:s.coins,level:s.level,wins:s.wins});
      lsSet('foxSyncHash',h); C.lastSync=Date.now(); C.status='synced'; }catch(e){ C.status='error'; } pushing=false; C.emit(); }
  C.push=push;
  function startAuto(){ clearInterval(timer); timer=setInterval(()=>push(false),15000);
    addEventListener('pagehide',()=>push(false)); document.addEventListener('visibilitychange',()=>{ if(document.hidden) push(false); }); }
  // Called on every page load when already signed in: bring this device up to date.
  async function reconcile(){ const c=await fetchCloud(); const local=snapshot(), lh=hash(local), last=ls('foxSyncHash');
    if(!c){ await push(true); return; }
    if(c.hash===lh){ lsSet('foxSyncHash',lh); C.status='synced'; C.lastSync=c.updatedAt; C.emit(); return; }
    const localChanged=lh!==last, cloudChanged=c.hash!==last;
    if(cloudChanged&&!localChanged){ applyCloud(c); location.reload(); return; }
    if(localChanged&&!cloudChanged){ await push(true); return; }
    // both changed (played on two devices without syncing): keep the one with more progress
    if(summary(c.data||{}).score>=summary(local).score){ applyCloud(c); location.reload(); } else await push(true); }
  async function boot(){ try{ await load(); }catch(e){ C.status='off'; C.emit(); return; }
    fb.A.onAuthStateChanged(fb.auth,async u=>{ if(u&&u.email&&u.email.endsWith(DOMAIN)){ C.user=u; C.name=u.email.slice(0,-DOMAIN.length); docRef=fb.F.doc(fb.db,'saves',C.name); C.on=true; C.status='syncing'; C.emit();
        if(!C._manual){ try{ await reconcile(); }catch(e){ C.status='error'; C.emit(); } } startAuto(); }
      else { C.user=null; C.name=null; docRef=null; C.on=false; C.status='signedout'; C.emit(); } }); }
  // ---- actions used by the sign-in screen ----
  C.create=async(name,pin)=>{ await load(); const n=norm(name); if(n.length<3) throw {code:'short'}; C._manual=true;
    const cred=await fb.A.createUserWithEmailAndPassword(fb.auth,n+DOMAIN,pw(pin)); C.user=cred.user; C.name=n; docRef=fb.F.doc(fb.db,'saves',n); C.on=true;
    await push(true); C._manual=false; startAuto(); C.emit(); return n; };
  // Sign in: returns {cloud, local} summaries when both have progress so the screen can ask which to keep.
  C.signIn=async(name,pin)=>{ await load(); const n=norm(name); C._manual=true;
    await fb.A.signInWithEmailAndPassword(fb.auth,n+DOMAIN,pw(pin)); C.name=n; docRef=fb.F.doc(fb.db,'saves',n); C.on=true;
    const c=await fetchCloud(); const local=snapshot();
    if(!c){ await push(true); C._manual=false; startAuto(); C.emit(); return {done:true}; }
    if(c.hash===hash(local)){ lsSet('foxSyncHash',c.hash); C._manual=false; startAuto(); C.emit(); return {done:true}; }
    if(!C.hasLocalProgress()){ applyCloud(c); C._manual=false; return {reload:true}; }
    return {choose:true,cloud:summary(c.data||{}),local:summary(local),useCloud:async()=>{ applyCloud(c); C._manual=false; return {reload:true}; },useLocal:async()=>{ await push(true); C._manual=false; startAuto(); C.emit(); return {done:true}; }}; };
  C.signOut=async()=>{ await load(); await push(true); await fb.A.signOut(fb.auth); lsSet('foxSyncHash',null); };
  boot();
})();
