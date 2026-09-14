/* Optional device notifications. Saving a workout never waits for a push request. */
let pushPrefs={enabled:false,rest:true,idle:true,details:true,seq:0},pushReady=false,pushRegistered=false,pushSub=null,pushReg=null,pushConfig=null;
let pushTimer=null,pushRunning=false,pushDirty=false,pushFingerprint='',pushMessage='',pushRetry=0,pushEnabling=false,pushCanceling=false;
function pushSupported(){return typeof Notification!=='undefined'&&typeof PushManager!=='undefined'&&!!navigator.serviceWorker&&!!crypto?.subtle;}
function pushSavePrefs(){localStorage.setItem(LS_KEY+'.push',JSON.stringify(pushPrefs));}
function pushActive(){return pushPrefs.enabled&&pushRegistered&&typeof Notification!=='undefined'&&Notification.permission==='granted'&&pushPrefs.vault===hierroSync?.keys?.id;}
function pushStatus(text){pushMessage=text;document.querySelectorAll('[data-push-status]').forEach(e=>e.textContent=text);}
function pushSettings(){
  const linked=!!hierroSync?.state?.created,enabled=pushPrefs.enabled;
  return `<div class="n-detail-grid n-push-grid"><section class="n-panel n-push-intro"><span class="n-eyebrow">Entrena. Nosotros llevamos el reloj.</span><h2>Tu siguiente serie,<br>sin mirar el teléfono.</h2><p>Recibe el fin del descanso aunque bloquees la pantalla o cambies de app.</p><div class="n-push-preview" aria-label="Ejemplo de notificación"><span>${uiIcon('bell')}HIERRO <small>ahora</small></span><b>Descanso listo</b><p>${pushPrefs.details?'Jalón al pecho · 65 lb × 6 reps. Placa 13 + ajuste fino 2.5 lb.':'Tu siguiente paso está listo en Hierro.'}</p><small>Ejemplo · tus avisos usarán el equipo de tu gimnasio</small></div><p data-push-status class="n-push-status" role="status">${esc(pushMessage||'Se activan solo en este dispositivo.')}</p><div class="n-sync-actions">${enabled?uiButton('Desactivar en este dispositivo','uiPushDisable()','bell','secondary'):!linked?uiButton('Vincular mi espacio',uiGo({name:'settings',section:'sync'}),'shield'):uiButton(pushEnabling?'Preparando…':'Activar notificaciones','uiPushEnable()','bell')}${enabled?uiButton('Probar con pantalla bloqueada','uiPushTest()','phone','text'):''}</div>${!linked?'<p class="hint">Primero crea o vincula tu espacio de sincronización. Así podemos programar los avisos sin una computadora encendida.</p>':''}</section><aside class="n-preference-panels"><section class="n-panel"><h2>Elige tus avisos.</h2>${uiToggle('Descanso terminado','Incluye los descansos de calentamiento.',pushPrefs.rest,"uiPushPreference('rest')")}${uiToggle('Cinco minutos sin registrar','Un recordatorio por pausa. Espera si tu descanso aún no termina.',pushPrefs.idle,"uiPushPreference('idle')")}${uiToggle('Carga y montaje en el aviso','Muestra ejercicio, peso, placa y ajuste fino en la pantalla bloqueada.',pushPrefs.details,"uiPushPreference('details')")}</section><section class="n-panel n-push-guide"><h2>En tu iPhone</h2><ol><li>Abre Hierro en Safari o en un navegador que permita añadirla al inicio.</li><li>Compartir → Añadir a pantalla de inicio.</li><li>Ábrela desde su icono, vincula tu espacio y activa los avisos aquí.</li></ol><p>Requiere iOS 16.4 o posterior. Si ya lo permitiste, revisa Ajustes → Notificaciones → Hierro Beta.</p><p>Para programar y recibir avisos hace falta internet. El sistema puede retrasarlos por conexión o concentración. Los pitidos de los últimos 3 segundos funcionan con la app abierta; el sonido del aviso lo decide el teléfono.</p></section></aside></div>`;
}
function pushLoadText(key,weight){
  if(!Number.isFinite(weight))return '';
  const plan=loadPlan(key,weight);if(!plan)return '';
  if(plan.kind==='placas')return 'Placa '+plan.stack.index+(plan.stack.extra>0?' + ajuste fino '+fmtStackNum(plan.stack.extra)+' '+plan.stack.unit:' · sin ajuste fino')+'.';
  if(plan.kind==='mancuerna')return fmtW(plan.dumbbell)+' '+uLabel()+(plan.points===2?' en cada mano.':' en una mano.');
  const disks=plan.perPoint.map(w=>fmtW(w)).join(' + ');
  return (plan.kind==='barra'?'Barra de '+fmtW(plan.base)+' '+uLabel()+'. ':'')+(disks?(plan.points===1?'Un lado: ':'Por lado: ')+disks+' '+uLabel()+'.':'Sin discos añadidos.');
}
function pushExerciseCopy(s,xi,warmStep){
  const ex=s.exercises[xi];if(!ex)return {target:'',body:'Ya completaste tus ejercicios. Abre Hierro para terminar y guardar.'};
  const key=ex.key,m=exMeta(key),st=ex.sets.find(st=>!st.done),last=ex.sets.slice().reverse().find(st=>st.done);
  const written=st&&st.w!==''&&st.w!=null&&Number.isFinite(Number(st.w))&&Number(st.w)>=0?recordedSetKg(key,st):null;
  let weight=warmStep?.w??written??targetWeight(ex),reps=warmStep?.seconds??warmStep?.reps??(st?.r!==''&&st?.r!=null?st.r:ex.sugg?.reps||last?.r||effRange(key).lo);
  const timed=m.type==='tiempo',corp=m.type==='corporal'||timed;
  const plan=Number.isFinite(weight)?loadPlan(key,weight):null;if(plan)weight=plan.total;
  let dose=Number.isFinite(weight)&&weight>=0&&!corp?fmtWEx(key,weight)+' '+uLabelEx(key)+(m.type==='asistido'?' de ayuda':' total')+' × '+reps+' reps':reps+(timed?' segundos':' reps');
  if(corp&&Number.isFinite(weight)&&weight>0)dose+=' + '+fmtWEx(key,weight)+' '+uLabelEx(key)+' de lastre';
  const prefix=warmStep?'Calentamiento · ':'';
  return {target:key,body:(prefix+exBaseName(ex.name)+' · '+dose+'. '+pushLoadText(key,weight)).slice(0,430)};
}
function pushNextCopy(s,xi){
  const ex=s.exercises[xi];if(!ex)return pushExerciseCopy(s,xi);
  const w=ex.warmup,setup={target:ex.key,body:exBaseName(ex.name)+' · abre Hierro para elegir tu carga y preparar el calentamiento.'};
  if(w?.phase==='setup')return setup;
  if(w?.phase==='rest')return pushExerciseCopy(s,xi,w.plan?.steps[w.completed]);
  if(w?.phase==='set')return w.plan?.steps[w.completed]?pushExerciseCopy(s,xi,w.plan.steps[w.completed]):setup;
  if(!ex.warmupDone&&!ex.sets.some(st=>st.done)){
    const plan=warmupPlan(xi);if(!plan)return setup;
    if(plan.steps.length)return pushExerciseCopy(s,xi,plan.steps[0]);
  }
  return pushExerciseCopy(s,xi);
}
function pushSnapshot(){
  const s=db.active;if(!s?.exercises.length||syncForeign||['conflict','waiting'].includes(hierroSync?.status))return null;
  const xi=sessionOpenIdx(),ex=s.exercises[xi],w=ex.warmup;
  const nextIdx=ex.sets.some(st=>!st.done)?xi:s.exercises.findIndex((x,i)=>i!==xi&&x.sets.some(st=>!st.done));
  let next=pushNextCopy(s,nextIdx),rest=null;
  if(w?.phase==='rest'&&Number.isFinite(w.restUntil))rest={kind:'warmup',at:w.restUntil,next:pushNextCopy(s,xi)};
  else if(s.restUntil)rest={kind:'rest',at:s.restUntil,next};
  const lastSetAt=Math.max(s.start,s.lastSeriesAt||0,...s.exercises.flatMap(x=>[x.lastWorkAt||0,x.warmup?.restStarted||0]));
  return {id:s.id,lastSetAt,rest,next};
}
async function pushFetch(url,options={}){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12000);
  try{return await fetch(url,{...options,signal:controller.signal});}finally{clearTimeout(timer);}
}
async function pushAPI(action,input,keepalive=false){
  const keys=hierroSync?.keys;if(!keys)throw new Error('Vincula tu espacio de sincronización para activar los avisos.');
  const r=await pushFetch(HIERRO_SYNC_URL+'/v1/vaults/'+keys.id+'/push/'+action,{method:'POST',headers:{Authorization:'Bearer '+keys.auth,'Content-Type':'application/json'},body:JSON.stringify({device:syncDevice,...input}),credentials:'omit',referrerPolicy:'no-referrer',cache:'no-store',keepalive});
  if(r.status===410){pushRegistered=false;throw new Error('El permiso de este dispositivo cambió. Desactiva y vuelve a activar los avisos.');}
  if(r.status===409)throw new Error('Actualiza la sincronización. Puede haber una sesión en otro dispositivo.');
  if(!r.ok)throw new Error('No pudimos programar el aviso. Tu entrenamiento sigue guardado. Reintentaremos con conexión.');
  return r.json();
}
async function pushRegistration(){
  if(!pushReg)pushReg=await Promise.race([navigator.serviceWorker.ready,new Promise((_,reject)=>setTimeout(()=>reject(new Error('Abre de nuevo Hierro cuando termine de instalar su actualización.')),8000))]);
  return pushReg;
}
async function pushGetConfig(){
  if(!pushConfig){const r=await pushFetch(HIERRO_SYNC_URL+'/push/config',{cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer'});if(!r.ok)throw new Error('El servicio de avisos no está disponible ahora.');pushConfig=await r.json();}
  return pushConfig;
}
function pushWorkerState(events=[]){
  const state={enabled:pushActive(),session:db.active?.id||null,ids:events.map(e=>e.id)};
  (pushReg?.active||navigator.serviceWorker?.controller)?.postMessage({tipo:'hierro-push-state',state});
}
function pushChanged(immediate=false){
  if(!pushReady)return;
  pushDirty=true;clearTimeout(pushTimer);
  if(immediate)void pushFlush();else pushTimer=setTimeout(pushFlush,180);
}
async function pushFlush(){
  if(pushRunning||!pushReady||!syncTabOwner)return;
  if(!pushPrefs.enabled){pushWorkerState();if(pushPrefs.pendingRemoval)void pushCancelPending();return;}
  if(!pushActive()||!hierroSync?.state?.created){pushWorkerState();return;}
  pushRunning=true;
  try{
    while(pushDirty){
      pushDirty=false;
      if(!pushActive()){pushWorkerState();break;}
      if(navigator.onLine===false){pushStatus('Sin conexión: el reloj sigue aquí. No podemos programar avisos nuevos.');pushRetry=Date.now()+10000;break;}
      if(JSON.stringify(db)!==localStorage.getItem(LS_KEY))break;
      const snapshot=pushSnapshot(),events=HierroPushCore.schedule(snapshot,pushPrefs),fingerprint=JSON.stringify({session:snapshot?.id||null,events});
      pushWorkerState(events);
      if(fingerprint===pushFingerprint)break;
      const seq=++pushPrefs.seq;pushSavePrefs();
      const encrypted=await Promise.all(events.map(async e=>({id:e.id,at:e.at,expires:e.expires,body:await HierroPushCore.encrypt(pushSub.toJSON(),e.message)})));
      if(pushDirty)continue;
      const result=await pushAPI('plan',{seq,revision:hierroSync.state.revision,session:snapshot?.id||null,now:Date.now(),events:encrypted},true);
      if(!pushActive()){pushWorkerState();break;}
      if(result.accepted===false&&result.seq>=seq){pushPrefs.seq=result.seq;pushSavePrefs();pushDirty=true;continue;}
      pushFingerprint=fingerprint;pushRetry=0;
      pushStatus(events.length?'Avisos programados. Puedes bloquear la pantalla.':'Avisos activos · se programan durante tu sesión.');
    }
  }catch(e){pushStatus(e.message);pushRetry=Date.now()+15000;}
  finally{pushRunning=false;if(pushDirty)pushChanged();}
}
async function uiPushEnable(){
  if(pushEnabling||pushCanceling)return;
  if(!pushSupported()){pushStatus('En iPhone, añade Hierro a la pantalla de inicio y ábrela desde su icono.');return;}
  if(!hierroSync?.state?.created){go({name:'settings',section:'sync'});return;}
  // Called directly by a tap, before any awaits: WebKit requires user activation.
  const permission=Notification.requestPermission();pushEnabling=true;pushStatus('Preparando los avisos de este dispositivo…');
  try{
    if(await permission!=='granted')throw new Error('Permite las notificaciones en los ajustes del teléfono o navegador y vuelve a intentarlo.');
    const reg=await pushRegistration(),config=await pushGetConfig();
    pushSub=await reg.pushManager.getSubscription()||await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:HierroPushCore.bytes(config.publicKey)});
    const result=await pushAPI('register',{endpoint:pushSub.endpoint});pushPrefs.seq=Math.max(pushPrefs.seq||0,result.seq||0);
    pushPrefs.enabled=true;pushPrefs.pendingRemoval=false;pushPrefs.vault=hierroSync.keys.id;pushRegistered=true;pushSavePrefs();
    db.settings.notify='on';save();pushFingerprint='';pushStatus('Activadas en este dispositivo. Prueba un aviso y bloquea la pantalla.');pushWorkerState();render();pushChanged();
  }catch(e){pushStatus(e.message);}
  finally{pushEnabling=false;}
}
async function uiPushDisable(){
  pushPrefs.enabled=false;pushSavePrefs();pushWorkerState();pushFingerprint='';db.settings.notify='off';save();
  let remote=true;
  try{if(hierroSync?.keys&&pushPrefs.vault===hierroSync.keys.id)await pushAPI('remove',{});}catch{remote=false;}
  try{await pushSub?.unsubscribe();}catch{remote=false;}
  pushSub=null;pushRegistered=false;
  pushPrefs.pendingRemoval=!remote;pushSavePrefs();pushRetry=remote?0:Date.now()+60000;
  pushStatus(remote?'Desactivadas en este dispositivo.':'Desactivadas aquí. Un aviso ya enviado puede llegar antes de completar la cancelación.');render();
}
async function pushCancelPending(){
  if(pushCanceling||pushEnabling||pushPrefs.enabled||!pushPrefs.pendingRemoval||navigator.onLine===false||pushPrefs.vault!==hierroSync?.keys?.id)return;
  pushCanceling=true;
  try{
    await pushAPI('remove',{});
    const sub=await pushReg?.pushManager?.getSubscription();if(sub)await sub.unsubscribe();
    pushPrefs.pendingRemoval=false;pushSavePrefs();pushRetry=0;pushStatus('Desactivadas en este dispositivo.');
  }catch{pushRetry=Date.now()+60000;}
  finally{pushCanceling=false;}
}
function uiPushPreference(key){if(!['rest','idle','details'].includes(key))return;pushPrefs[key]=!pushPrefs[key];if(pushReady)pushSavePrefs();pushFingerprint='';render();pushChanged();}
async function uiPushTest(){
  if(db.active||syncForeign){pushStatus('La prueba se hace sin una sesión en curso, para conservar los avisos de tu entrenamiento.');return;}
  if(!pushActive()||pushRunning)return;
  try{
    const at=Date.now()+10000,id='test:'+at,expires=at+90000,message={v:1,id,kind:'test',session:'test',target:'',expires,title:'Hierro está contigo',body:'Este aviso llegó desde Cloudflare. También recibirás el fin del descanso con la pantalla bloqueada.'};
    const body=await HierroPushCore.encrypt(pushSub.toJSON(),message);const seq=++pushPrefs.seq;pushSavePrefs();
    await pushAPI('plan',{seq,revision:hierroSync.state.revision,session:'test',now:Date.now(),events:[{id,at,expires,body}]});
    pushStatus('Prueba programada para dentro de 10 segundos. Bloquea la pantalla.');
  }catch(e){pushStatus(e.message);}
}
async function pushDisconnect(){if(pushReady&&(pushPrefs.enabled||pushRegistered))await uiPushDisable();}
function pushOpen(data){
  if(!data||data.kind==='test'){go({name:'settings',section:'notifications'});return;}
  if(db.active?.id!==data.session){go({name:'home'});return;}
  const xi=db.active.exercises.findIndex(ex=>ex.key===data.target&&!exDone(ex));
  if(xi>=0&&exDone(db.active.exercises[sessionOpenIdx()])&&(!db.active.restUntil||db.active.restUntil<Date.now())){db.active.open=xi;uiResetRest();save();}
  go({name:'session'});
}
async function pushInit(){
  try{
    const saved=JSON.parse(localStorage.getItem(LS_KEY+'.push')||'null');if(saved)pushPrefs={...pushPrefs,...saved};
    pushReady=true;
    navigator.serviceWorker?.addEventListener('message',e=>{if(e.data?.tipo==='hierro-push-open')pushOpen(e.data.data);});
    const hash=location.hash.match(/^#aviso=(.+)$/);if(hash){history.replaceState(null,'',location.pathname+location.search);try{pushOpen(JSON.parse(decodeURIComponent(hash[1])));}catch{}}
    if(pushSupported()){
      pushReg=await pushRegistration();pushSub=await pushReg.pushManager.getSubscription();
      if(pushPrefs.enabled&&Notification.permission==='granted'&&pushSub&&hierroSync?.keys&&pushPrefs.vault===hierroSync.keys.id){const result=await pushAPI('register',{endpoint:pushSub.endpoint});pushPrefs.seq=Math.max(pushPrefs.seq||0,result.seq||0);pushSavePrefs();pushRegistered=true;pushStatus('Avisos activos en este dispositivo.');}
      else if(pushPrefs.enabled)pushStatus('Revisa el permiso y vuelve a activar los avisos en este dispositivo.');
      void pushGetConfig().catch(()=>{});
    }
    window.addEventListener('online',()=>{pushFingerprint='';pushChanged(true);});
    document.addEventListener('visibilitychange',()=>pushChanged(true));
    setInterval(()=>{if(pushRetry&&Date.now()>=pushRetry)pushChanged(true);},15000);
    pushChanged();
  }catch(e){pushStatus(e.message);}
}
