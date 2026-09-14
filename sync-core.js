/* Hierro Sync v1. Pure reconciliation and client-side cryptography.
   No clocks decide whose training data wins. No recovery key goes to a server. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.HierroSyncCore=api;
})(globalThis,function(){
  'use strict';
  const VERSION=1,MAX_PLAIN=6*1024*1024;
  const LOCAL_SETTINGS=['gymId','unit','theme','motion','sound','vibration','notify','screenOn','health','lastBackup'];
  const MACHINE_FIELDS=['equip','points','base','bar','step','cap','stack'];
  const forbidden=new Set(['__proto__','prototype','constructor']);
  const clone=v=>v===undefined?undefined:JSON.parse(JSON.stringify(v));
  const object=v=>v!==null&&typeof v==='object'&&!Array.isArray(v);
  function stable(v){
    if(v===undefined)return 'undefined';
    if(Array.isArray(v))return '['+v.map(stable).join(',')+']';
    if(object(v))return '{'+Object.keys(v).sort().map(k=>JSON.stringify(k)+':'+stable(v[k])).join(',')+'}';
    return JSON.stringify(v);
  }
  const equal=(a,b)=>stable(a)===stable(b);
  function guard(value,depth=0,budget={n:0}){
    if(depth>40||++budget.n>500000)throw new Error('La copia tiene una estructura demasiado grande.');
    if(typeof value==='number'&&!Number.isFinite(value))throw new Error('Número no válido.');
    if(value&&typeof value==='object')for(const [k,v] of Object.entries(value)){
      if(forbidden.has(k))throw new Error('La copia contiene una propiedad no permitida.');
      guard(v,depth+1,budget);
    }
  }
  function idList(v){return Array.isArray(v)&&v.every(x=>object(x)&&typeof x.id==='string'&&x.id.length>0)&&new Set(v.map(x=>x.id)).size===v.length;}
  function validate(doc){
    guard(doc);
    if(!object(doc)||doc.schema!==VERSION)throw new Error('Esta copia necesita otra versión de Hierro. Actualiza la app.');
    if(!object(doc.settings)||!object(doc.exmeta)||!['gyms','routines','splits','history'].every(k=>idList(doc[k])))throw new Error('La copia no tiene un formato válido de Hierro.');
    for(const r of doc.routines)if(typeof r.name!=='string'||!idList(r.exercises)||r.exercises.some(e=>typeof e.name!=='string'||typeof e.key!=='string'))throw new Error('Día no válido.');
    for(const s of doc.splits)if(typeof s.name!=='string'||(s.exconf!==undefined&&!object(s.exconf)))throw new Error('Plan no válido.');
    for(const g of doc.gyms)if(typeof g.name!=='string'||!['kg','lb'].includes(g.unit)||!['plates','bars','dumbbells'].every(k=>Array.isArray(g[k]))||!object(g.machines))throw new Error('Gimnasio no válido.');
    for(const h of doc.history){
      if(typeof h.date!=='string'||!Number.isFinite(Date.parse(h.date))||typeof h.routineName!=='string'||!Array.isArray(h.entries))throw new Error('Sesión no válida.');
      for(const e of h.entries)if(typeof e.key!=='string'||typeof e.name!=='string'||!Array.isArray(e.sets)||e.sets.some(s=>!object(s)||!Number.isFinite(s.w)||!Number.isFinite(s.r)||s.w<0||s.r<0))throw new Error('Serie no válida.');
    }
    for(const m of Object.values(doc.exmeta))if(!object(m))throw new Error('Ejercicio no válido.');
    if(doc.active!==null){
      const a=doc.active,s=a?.session;
      if(!object(a)||typeof a.owner!=='string'||!object(s)||typeof s.id!=='string'||typeof s.routineName!=='string'||!Number.isFinite(s.start)||!Array.isArray(s.exercises)||s.exercises.some(e=>typeof e.key!=='string'||typeof e.name!=='string'||!Array.isArray(e.sets)))throw new Error('Sesión en curso no válida.');
    }
    return doc;
  }
  function empty(){return {schema:1,settings:{},gyms:[],splits:[],routines:[],exmeta:{},history:[],active:null};}
  function project(db,device,foreign=null){
    const d=clone(db),settings=d.settings||{};
    const gym=d.gyms.find(g=>g.id===settings.gymId);
    if(gym){
      gym.unit=settings.unit||gym.unit;gym.machines={};
      for(const [key,m] of Object.entries(d.exmeta||{})){
        const machine={};for(const f of MACHINE_FIELDS)if(m[f]!=null)machine[f]=m[f];
        if(Object.keys(machine).length)gym.machines[key]=machine;
      }
    }
    for(const k of LOCAL_SETTINGS)delete settings[k];
    for(const m of Object.values(d.exmeta||{}))for(const k of MACHINE_FIELDS)delete m[k];
    for(const h of d.history)delete h.prs;
    return validate({schema:1,settings,gyms:d.gyms,splits:d.splits,routines:d.routines,exmeta:d.exmeta,history:d.history,active:d.active?{owner:device,gymId:db.settings.gymId,session:d.active}:clone(foreign)});
  }
  const ptr=k=>String(k).replace(/~/g,'~0').replace(/\//g,'~1');
  // Stable IDs merge independent additions/removals. Arrays without IDs (sets,
  // inventory weights) remain atomic; joining their indices would invent data.
  function merge(base,local,remote,choices={}){
    const conflicts=[];
    function conflict(path,b,l,r){
      if(choices[path]==='local')return clone(l);
      if(choices[path]==='remote')return clone(r);
      conflicts.push({path,base:clone(b),local:clone(l),remote:clone(r)});
      return clone(l);
    }
    function walk(b,l,r,path){
      if(equal(l,r))return clone(l);
      if(equal(l,b))return clone(r);
      if(equal(r,b))return clone(l);
      if(path==='/active')return conflict(path,b,l,r);
      if(object(l)&&object(r)&&(object(b)||b===undefined)){
        const out={};
        for(const k of [...new Set([...Object.keys(b||{}),...Object.keys(l),...Object.keys(r)])].sort()){
          if(forbidden.has(k))throw new Error('Propiedad no permitida.');
          const v=walk(b?.[k],l[k],r[k],path+'/'+ptr(k));if(v!==undefined)out[k]=v;
        }
        return out;
      }
      if(idList(l)&&idList(r)&&(idList(b)||b===undefined)){
        b=b||[];const maps=[b,l,r].map(a=>new Map(a.map(v=>[v.id,v]))),out=new Map();
        const ids=[...new Set([...maps[0].keys(),...maps[1].keys(),...maps[2].keys()])];
        for(const id of ids){const v=walk(...maps.map(m=>m.get(id)),path+'/'+ptr(id));if(v!==undefined)out.set(id,v);}
        const common=b.map(x=>x.id).filter(id=>out.has(id)&&maps[1].has(id)&&maps[2].has(id));
        const order=a=>a.map(x=>x.id).filter(id=>common.includes(id));
        const bo=order(b),lo=order(l),ro=order(r);let skeleton;
        if(equal(lo,ro)||equal(ro,bo))skeleton=lo;
        else if(equal(lo,bo))skeleton=ro;
        else skeleton=conflict(path+'/$order',bo,lo,ro);
        // Anchor new entities before their next common neighbour. Sort additions
        // deterministically so replicas also converge after simultaneous inserts.
        const buckets=new Map([...skeleton,'$end'].map(id=>[id,[]]));
        for(const id of [...out.keys()].filter(id=>!common.includes(id)).sort()){
          const candidates=[l,r].filter(a=>a.some(x=>x.id===id)).map(a=>{
            const i=a.findIndex(x=>x.id===id);return a.slice(i+1).find(x=>common.includes(x.id))?.id||'$end';
          }).sort();
          buckets.get(candidates[0]||'$end').push(id);
        }
        return [...skeleton.flatMap(id=>[...buckets.get(id),id]),...buckets.get('$end')].map(id=>out.get(id));
      }
      return conflict(path,b,l,r);
    }
    const value=walk(base,local,remote,'');
    if(value?.schema===1&&Array.isArray(value.routines)&&Array.isArray(value.splits)){
      // Parent deletion vs a new day is a conflict too. Normalizing an orphan
      // independently on two devices would create two random replacement plans.
      for(const routine of [...value.routines]){
        if(!routine.split||value.splits.some(s=>s.id===routine.split))continue;
        const pair=doc=>{const r=doc.routines.find(r=>r.id===routine.id),s=doc.splits.find(s=>s.id===routine.split);return r&&s?{routine:r,split:s}:undefined;};
        const chosen=conflict('/routines/'+ptr(routine.id)+'/$plan',pair(base),pair(local),pair(remote));
        if(!chosen)value.routines=value.routines.filter(r=>r.id!==routine.id);
        else{value.routines=value.routines.map(r=>r.id===routine.id?clone(chosen.routine):r);value.splits.push(clone(chosen.split));}
      }
      const selected=doc=>doc.splits.find(s=>s.active)?.id||null;
      if(value.splits.filter(s=>s.active).length>1){
        const chosen=conflict('/splits/$active',selected(base),selected(local),selected(remote));
        for(const s of value.splits)s.active=s.id===chosen;
      }
      // The app always has one active plan when plans exist. Choose the first
      // surviving plan deterministically if the previously selected one was removed.
      if(value.splits.length&&!value.splits.some(s=>s.active))value.splits[0].active=true;
      if(value.active&&!value.gyms.some(g=>g.id===value.active.gymId)){
        const pair=doc=>doc.active&&doc.gyms.some(g=>g.id===doc.active.gymId)?{active:doc.active,gym:doc.gyms.find(g=>g.id===doc.active.gymId)}:undefined;
        const chosen=conflict('/active/$gym',pair(base),pair(local),pair(remote));
        value.active=chosen?clone(chosen.active):null;if(chosen)value.gyms.push(clone(chosen.gym));
      }
    }
    return {value,conflicts};
  }
  function b64(bytes){let s='';for(let i=0;i<bytes.length;i+=8192)s+=String.fromCharCode(...bytes.subarray(i,i+8192));return btoa(s).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');}
  function unb64(s){if(!/^[A-Za-z0-9_-]+$/.test(s))throw new Error('Clave o copia no válida.');const v=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));if(b64(v)!==s)throw new Error('Codificación no válida.');return v;}
  const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
  async function hash(v){return new Uint8Array(await crypto.subtle.digest('SHA-256',v));}
  async function createKey(){const bytes=crypto.getRandomValues(new Uint8Array(32));return 'hr1.'+b64(bytes)+'.'+b64((await hash(bytes)).slice(0,4));}
  async function keys(text){
    const parts=String(text).trim().split('.');
    if(parts.length!==3||parts[0]!=='hr1'||parts[1].length!==43||parts[2].length!==6)throw new Error('Revisa la clave: debe empezar por hr1. y estar completa.');
    const raw=unb64(parts[1]);if(b64((await hash(raw)).slice(0,4))!==parts[2])throw new Error('La clave tiene un error al copiarla.');
    const material=await crypto.subtle.importKey('raw',raw,'HKDF',false,['deriveBits','deriveKey']);
    const params=info=>({name:'HKDF',hash:'SHA-256',salt:enc.encode('hierro.sync.v1'),info:enc.encode(info)});
    return {id:b64(new Uint8Array(await crypto.subtle.deriveBits(params('vault-id'),material,256))),auth:b64(new Uint8Array(await crypto.subtle.deriveBits(params('server-auth'),material,256))),encryption:await crypto.subtle.deriveKey(params('client-encryption'),material,{name:'AES-GCM',length:256},false,['encrypt','decrypt'])};
  }
  async function bounded(stream,max){
    const reader=stream.getReader(),parts=[];let n=0;
    try{for(;;){const {value,done}=await reader.read();if(done)break;n+=value.length;if(n>max)throw new Error('La copia supera el tamaño admitido.');parts.push(value);}}
    catch(e){await reader.cancel().catch(()=>{});throw e;}
    const out=new Uint8Array(n);let pos=0;for(const part of parts){out.set(part,pos);pos+=part.length;}return out;
  }
  async function seal(doc,k){
    validate(doc);let bytes=enc.encode(JSON.stringify(doc));if(bytes.length>MAX_PLAIN)throw new Error('Tu copia supera los 6 MB disponibles por cuenta. Los datos siguen guardados en este dispositivo.');
    let format='j';
    if(typeof CompressionStream!=='undefined'){const zipped=await bounded(new Blob([bytes]).stream().pipeThrough(new CompressionStream('gzip')),MAX_PLAIN);if(zipped.length<bytes.length){bytes=zipped;format='z';}}
    const iv=crypto.getRandomValues(new Uint8Array(12));
    const data=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:enc.encode('hierro.v1.'+k.id+'.'+format)},k.encryption,bytes);
    return 'h1.'+format+'.'+b64(iv)+'.'+b64(new Uint8Array(data));
  }
  async function open(packet,k){
    if(typeof packet!=='string'||packet.length>9*1024*1024)throw new Error('Copia demasiado grande.');
    const p=packet.split('.');if(p.length!==4||p[0]!=='h1'||!['j','z'].includes(p[1])||p[2].length!==16)throw new Error('La copia cifrada no es válida.');
    let bytes;
    try{bytes=new Uint8Array(await crypto.subtle.decrypt({name:'AES-GCM',iv:unb64(p[2]),additionalData:enc.encode('hierro.v1.'+k.id+'.'+p[1])},k.encryption,unb64(p[3])));}
    catch{throw new Error('No se pudo verificar la copia cifrada. Tus datos locales se conservan.');}
    if(p[1]==='z'){
      if(typeof DecompressionStream==='undefined')throw new Error('Actualiza este navegador para abrir la copia comprimida.');
      bytes=await bounded(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip')),MAX_PLAIN);
    }
    if(bytes.length>MAX_PLAIN)throw new Error('Copia demasiado grande.');
    return validate(JSON.parse(dec.decode(bytes)));
  }
  return {VERSION,MAX_PLAIN,LOCAL_SETTINGS,MACHINE_FIELDS,clone,equal,stable,validate,empty,project,merge,createKey,keys,seal,open,b64,hash};
});
