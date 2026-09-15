'use strict';
const assert=require('node:assert/strict'),C=require('../sync-core.js'),{Engine}=require('../sync-engine.js');
let tests=0;
const ok=(value,message)=>{assert.ok(value,message);tests++;console.log('OK '+message);};
const clone=C.clone;
function data(){return {schema:1,settings:{goal:'ambas',rest:'auto'},gyms:[{id:'g1',name:'Mi gimnasio',unit:'kg',plates:[],bars:[],dumbbells:[],machines:{}}],splits:[{id:'p1',name:'Mi plan',active:true,exconf:{}}],routines:[{id:'d1',name:'Torso',split:'p1',exercises:[{id:'e1',name:'Press',key:'press'}]}],exmeta:{press:{notes:'Asiento 4',lo:6,hi:10}},history:[],active:null};}
function session(id){return {id,routineId:'d1',routineName:'Torso',date:'2026-09-14T12:00:00.000Z',duration:1800,entries:[{key:'press',name:'Press',sets:[{w:40,r:10,rir:2}]}]};}
function memory(){let value;return {get:async()=>clone(value),set:async v=>{value=clone(v);},peek:()=>clone(value)};}
function server(){
  const records=new Map();let online=true,hook=null;
  async function fetch(url,options){
    if(!online)throw new TypeError('offline');
    const id=url.split('/').pop(),auth=options.headers.Authorization,entry=records.get(id);
    const tag=n=>({ETag:'"'+n+'"'});
    let response;
    if(options.method==='GET')response=!entry||entry.auth!==auth?new Response('',{status:404}):options.headers['If-None-Match']==='"'+entry.revision+'"'?new Response(null,{status:304,headers:tag(entry.revision)}):new Response(entry.packet,{headers:tag(entry.revision)});
    if(options.method==='POST'){
      if(entry)response=new Response('',{status:409});else{records.set(id,{packet:options.body,auth,revision:1});response=new Response('',{status:201,headers:tag(1)});}
    }
    if(options.method==='PUT'){
      if(!entry||entry.auth!==auth)response=new Response('',{status:404});
      else if(options.headers['If-Match']!=='"'+entry.revision+'"')response=new Response('',{status:409});
      else{entry.packet=options.body;entry.revision++;response=new Response(null,{status:204,headers:tag(entry.revision)});}
    }
    if(hook){const once=hook;hook=null;await once(options,response,records);}
    return response;
  }
  return {fetch,records,setOnline:v=>online=v,once:f=>hook=f};
}
function device(s,doc=data()){
  let local=clone(doc),busy=false;const store=memory();
  const adapter={read:()=>clone(local),apply:d=>{local=clone(d);},busy:()=>busy};
  const engine=new Engine({url:'https://test.invalid',store,adapter,fetch:s.fetch});
  return {engine,adapter,store,get data(){return local;},set data(v){local=v;},setBusy:v=>busy=v};
}
async function pair(s){const a=device(s);const key=await a.engine.create();const b=device(s,C.empty());await b.engine.link(await b.engine.inspect(key),'replace');return {a,b,key};}
(async()=>{
  let base=data(),a=clone(base),b=clone(base);
  a.routines[0].name='Torso A';b.exmeta.press.notes='Asiento 5';
  let merged=C.merge(base,a,b);
  ok(!merged.conflicts.length&&merged.value.routines[0].name==='Torso A'&&merged.value.exmeta.press.notes==='Asiento 5','combina cambios independientes sin usar relojes');
  a=clone(base);b=clone(base);a.history.push(session('phone'));b.history.push(session('web'));
  merged=C.merge(base,a,b);ok(merged.value.history.length===2&&!merged.conflicts.length,'conserva sesiones distintas de ambos dispositivos');
  ok(C.equal(C.merge(base,a,b).value,C.merge(base,b,a).value),'las altas simultáneas convergen en el mismo orden');
  base.history=[session('one')];a=clone(base);b=clone(base);a.history=[];b.history[0].entries[0].sets[0].w=45;
  merged=C.merge(base,a,b);ok(merged.conflicts.length===1,'eliminar contra editar una sesión requiere revisión');
  ok(C.merge(base,a,b,{[merged.conflicts[0].path]:'remote'}).value.history[0].entries[0].sets[0].w===45,'resolver permite conservar la sesión editada');
  a=clone(base);b=clone(base);a.exmeta.press.notes='Polea 2';b.exmeta.press.notes='Polea 3';
  merged=C.merge(base,a,b);ok(merged.conflicts[0].path==='/exmeta/press/notes','identifica el campo concreto en conflicto');
  base.routines.push({id:'d2',name:'Pierna',exercises:[]},{id:'d3',name:'Brazos',exercises:[]});a=clone(base);b=clone(base);a.routines.reverse();b.routines[1].name='Pierna A';
  merged=C.merge(base,a,b);ok(merged.value.routines[0].id==='d3'&&merged.value.routines[1].name==='Pierna A','reordenar no descarta una edición del otro dispositivo');
  a=clone(base);b=clone(base);a.routines=[a.routines[1],a.routines[0],a.routines[2]];b.routines.reverse();
  ok(C.merge(base,a,b).conflicts.some(c=>c.path.endsWith('/$order')),'dos órdenes incompatibles requieren una elección');
  base=data();a=clone(base);b=clone(base);a.history.push(session('shared'));b.history.push(session('shared'));
  ok(C.merge(base,a,b).value.history.length===1,'una sesión con el mismo ID no se duplica');
  base=data();a=clone(base);b=clone(base);a.routines.push({id:'new-day',split:'p1',name:'Pierna',exercises:[]});b.routines=[];b.splits=[];
  merged=C.merge(base,a,b);ok(merged.conflicts.some(c=>c.path.endsWith('/$plan')),'borrar un plan y añadirle un día requiere revisar la relación');
  merged=C.merge(base,a,b,{'/routines/new-day/$plan':'local'});ok(merged.value.splits[0].id==='p1'&&merged.value.routines[0].id==='new-day','conservar el nuevo día también conserva su plan');
  base=data();base.splits.push({id:'p2',name:'Segundo',active:false},{id:'p3',name:'Tercero',active:false});a=clone(base);b=clone(base);a.splits.forEach(s=>s.active=s.id==='p2');b.splits.forEach(s=>s.active=s.id==='p3');
  merged=C.merge(base,a,b);ok(merged.conflicts.some(c=>c.path==='/splits/$active'),'dos cambios de plan activo no dejan dos planes activos');
  merged=C.merge(base,a,b,{'/splits/$active':'remote'});ok(merged.value.splits.filter(s=>s.active).length===1&&merged.value.splits.find(s=>s.active).id==='p3','resolver el plan activo mantiene una sola selección');
  assert.throws(()=>C.validate(JSON.parse('{"schema":1,"__proto__":{"polluted":true}}')));ok(!{}.polluted,'rechaza contaminación de prototipos');
  a=data();a.schema=99;assert.throws(()=>C.validate(a));ok(true,'no abre un protocolo futuro como si fuera compatible');
  a=data();a.history=[session('x')];a.history[0].entries[0].sets[0].w='40';assert.throws(()=>C.validate(a));ok(true,'valida la estructura y los pesos antes de aplicar');
  const key=await C.createKey(),k=await C.keys(key),other=await C.keys(await C.createKey());
  ok(key.length===54&&k.id!==k.auth&&!key.includes(k.auth),'clave aleatoria con claves derivadas distintas para identidad, acceso y cifrado');
  await assert.rejects(C.keys(key.slice(0,-1)+(key.endsWith('A')?'B':'A')));ok(true,'detecta errores al copiar la clave');
  const packet=await C.seal(data(),k),packet2=await C.seal(data(),k);
  ok(packet!==packet2&&!packet.includes('Asiento')&&!packet.includes(key),'cada copia usa un nonce nuevo y no contiene datos ni clave en texto');
  ok(C.equal(await C.open(packet,k),data()),'el cifrado conserva exactamente la información');
  await assert.rejects(C.open(packet,other));ok(true,'otra clave no puede descifrar la copia');
  const parts=packet.split('.');parts[3]=(parts[3][0]==='A'?'B':'A')+parts[3].slice(1);
  await assert.rejects(C.open(parts.join('.'),k));ok(true,'AES-GCM detecta una copia manipulada');
  parts[1]=parts[1]==='z'?'j':'z';await assert.rejects(C.open(parts.join('.'),k));ok(true,'la versión del formato también está autenticada');
  const source={...data(),settings:{...data().settings,gymId:'g1',unit:'lb',theme:'dark',sound:'off'},active:null,progress:{press:{inc:99}},exmeta:{press:{notes:'Asiento 4',equip:'placas',cap:113.3980925,stack:{unit:'lb',start:2.5,step:5,extra:1.5,extraMax:3}}}};
  source.gyms.push({id:'g2',name:'Casa',unit:'kg',plates:[],bars:[],dumbbells:[],machines:{press:{equip:'barra',bar:'bar-a'}}});
  const projected=C.project(source,'device');
  ok(projected.gyms[0].machines.press.cap===source.exmeta.press.cap&&projected.gyms[0].machines.press.stack.extraMax===3,'conserva por separado capacidad de máquina y ajuste fino');
  ok(projected.gyms[1].machines.press.bar==='bar-a'&&!('cap' in projected.exmeta.press)&&projected.gyms[0].unit==='lb','cada gimnasio viaja con su equipo y unidad correctos');
  ok(!projected.settings.theme&&!projected.progress&&source.exmeta.press.cap===113.3980925,'la proyección no muta datos ni sincroniza cachés o preferencias locales');
  source.exmeta.press.gymNotes='Asiento 4';
  const withNotes=C.project(source,'device');
  ok(withNotes.gyms[0].machines.press.gymNotes==='Asiento 4'&&!('gymNotes' in withNotes.exmeta.press),'el ajuste del asiento se sincroniza con su gimnasio, sin duplicarlo como nota general');
  source.active={id:'independent',localOnly:true,exercises:[]};
  const foreign={owner:'phone',gymId:'g1',session:{id:'remote',routineName:'Torso',start:1,exercises:[]}};
  ok(C.equal(C.project(source,'device',foreign).active,foreign),'una sesión independiente no reemplaza la sesión del otro dispositivo');
  ok(C.project(source,'device').active===null,'una sesión independiente no se publica como sesión en curso');
  let s=server(),pairing=await pair(s);({a,b}=pairing);
  ok(C.equal(a.data,b.data)&&a.engine.status==='synced','dos dispositivos pueden crear y vincular un mismo espacio');
  a.data.exmeta.press.notes='Polea 4';await a.engine.sync();await b.engine.sync();ok(b.data.exmeta.press.notes==='Polea 4','teléfono a web');
  b.data.routines[0].name='Torso B';await b.engine.sync();await a.engine.sync();ok(a.data.routines[0].name==='Torso B','web a teléfono');
  s.setOnline(false);a.data.history.push(session('offline-phone'));b.data.history.push(session('offline-web'));await a.engine.sync();
  ok(a.engine.status==='offline'&&a.data.history.length===1,'un corte de conexión conserva los registros y muestra pendiente');
  s.setOnline(true);await b.engine.sync();await a.engine.sync();await b.engine.sync();ok(a.data.history.length===2&&C.equal(a.data,b.data),'reconecta y suma las sesiones de ambos dispositivos');
  a.data.exmeta.press.notes='A';b.data.exmeta.press.notes='B';await a.engine.sync();await b.engine.sync();
  ok(b.engine.status==='conflict'&&b.data.exmeta.press.notes==='B','un conflicto nunca sobrescribe silenciosamente la nota local');
  ok(b.store.peek().checkpoints.some(c=>c.doc.exmeta.press.notes==='A')&&b.store.peek().checkpoints.some(c=>c.doc.exmeta.press.notes==='B'),'guarda ambas versiones antes de resolver');
  await b.engine.resolve({'/exmeta/press/notes':'local'});await a.engine.sync();ok(a.data.exmeta.press.notes==='B'&&!b.engine.pending,'resolver una nota propaga la elección');
  // Simultaneous write: B updates after A fetched, so A must retry its CAS.
  a.data.settings.rest='120';b.data.exmeta.press.lo=7;s.once(async options=>{if(options.method==='GET')await b.engine.sync();});await a.engine.sync();await b.engine.sync();
  ok(a.data.settings.rest==='120'&&a.data.exmeta.press.lo===7&&C.equal(a.data,b.data),'un 409 vuelve a leer y combinar, sin perder cambios');
  // Keystrokes during PUT stay as a delta against the exact acknowledged copy.
  a.data.exmeta.press.notes='Primer texto';const orig=s.fetch;
  a.engine.request=async(url,opt)=>{const r=await orig(url,opt);if(opt.method==='PUT')a.data.exmeta.press.notes='Texto mientras enviaba';return r;};
  await a.engine.sync();ok(a.engine.status==='pending'&&a.data.exmeta.press.notes==='Texto mientras enviaba','no pierde una edición hecha durante el envío');
  a.engine.request=orig;await a.engine.sync();await b.engine.sync();ok(b.data.exmeta.press.notes==='Texto mientras enviaba','el siguiente envío incluye la edición que seguía pendiente');
  a.data.routines[0].name='Cambio remoto';await a.engine.sync();b.setBusy(true);const previous=clone(b.data);await b.engine.sync();
  ok(b.engine.status==='waiting'&&C.equal(b.data,previous),'no mueve formularios ni configuración mientras la persona está ocupada');
  b.data.exmeta.press.hi=12;b.setBusy(false);await b.engine.sync();await a.engine.sync();ok(a.data.exmeta.press.hi===12&&b.data.routines[0].name==='Cambio remoto','recibir después no convierte datos antiguos en reversiones');
  a.data.history=a.data.history.filter(h=>h.id!=='offline-phone');await a.engine.sync();await b.engine.sync();ok(!b.data.history.some(h=>h.id==='offline-phone'),'una eliminación se propaga y no resucita al reconectar');
  // Restart from the durable base with pending offline edits.
  const reopened=new Engine({url:'https://test.invalid',store:a.store,adapter:a.adapter,fetch:s.fetch});await reopened.load();a.data.exmeta.press.notes='Tras cerrar';await reopened.sync();await b.engine.sync();ok(b.data.exmeta.press.notes==='Tras cerrar','reanuda desde el estado persistido después de cerrar la app');
  a.data.active={owner:'phone',gymId:'g1',session:{id:'work',routineName:'Torso',start:1,exercises:[{key:'press',name:'Press',sets:[{w:'40',r:'8',done:true}]}]}};await reopened.sync();await b.engine.sync();await b.engine.claim('web');await reopened.sync();
  ok(a.data.active.owner==='web'&&a.data.active.session.exercises[0].sets[0].done,'la continuación cambia dueño conservando las series');
  // Corrupt authenticated remote bytes, without touching any local data.
  const current=clone(b.data),record=s.records.values().next().value;record.revision++;record.packet='h1.z.aaaaaaaaaaaaaaaa.'+'a'.repeat(50);await b.engine.sync();
  ok(b.engine.status==='error'&&C.equal(current,b.data),'una copia dañada deja intactos los datos locales');
  // A response can be lost after a create actually committed.
  s=server();a=device(s);s.once(async()=>{});const f=s.fetch;let interrupted=false;
  a.engine.request=async(u,o)=>{const r=await f(u,o);if(o.method==='POST'&&!interrupted){interrupted=true;throw new TypeError('lost response');}return r;};
  const recovery=await a.engine.create();ok(a.store.peek().key===recovery&&s.records.size===1,'guarda la clave antes de crear aunque se pierda la respuesta');
  await a.engine.sync();ok(a.engine.status==='synced'&&s.records.size===1,'recupera la creación incierta sin duplicar cuentas');
  await a.engine.disconnect();ok(!a.store.peek()&&a.data.routines.length===1,'desvincular conserva el entrenamiento local');
  console.log(`\nTODAS LAS PRUEBAS DE SYNC OK (${tests})`);
})().catch(e=>{console.error(e);process.exitCode=1;});
