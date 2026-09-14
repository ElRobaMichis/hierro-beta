/* Smoke test against our published service, using a NEW disposable encrypted
   space only. It never accepts an existing user's key or touches their data. */
'use strict';
const assert=require('node:assert/strict'),C=require('../sync-core.js'),{Engine}=require('../sync-engine.js');
const url=process.argv[2];
if(!url||new URL(url).protocol!=='https:'||!new URL(url).hostname.endsWith('.workers.dev'))throw new Error('Indica la URL HTTPS del Worker publicado.');
let checks=0,account;
function device(doc){
 let value=C.clone(doc),stored,online=true;
 const engine=new Engine({url,store:{get:async()=>stored,set:async v=>stored=C.clone(v)},adapter:{read:()=>C.clone(value),apply:d=>value=C.clone(d)},fetch:(...a)=>{if(!online)throw new TypeError('simulated offline');return fetch(...a);}});
 return {engine,get data(){return value;},setOnline:v=>online=v};
}
function ok(v,message){assert.ok(v,message);checks++;console.log('OK '+message);}
(async()=>{
 try{
  const health=await fetch(url+'/health');ok(health.ok&&(await health.json()).protocol===1,'servicio publicado responde con el protocolo correcto');
  const doc=C.empty();doc.settings={goal:'ambas'};doc.exmeta.press={notes:'Prueba aislada'};
  const a=device(doc),key=await a.engine.create();account=a.engine;
  ok(a.engine.status==='synced'&&a.engine.state.created,'crea una copia cifrada en la nube');
  const b=device(C.empty());await b.engine.link(await b.engine.inspect(key),'replace');
  ok(C.equal(a.data,b.data),'el segundo cliente recibe la misma información');
  a.data.exmeta.press.notes='Desde el teléfono';await a.engine.sync();await b.engine.sync();
  ok(b.data.exmeta.press.notes==='Desde el teléfono','cambio de teléfono a web a través de Cloudflare');
  b.data.exmeta.press.hi=10;await b.engine.sync();await a.engine.sync();
  ok(a.data.exmeta.press.hi===10,'cambio de web a teléfono a través de Cloudflare');
  a.setOnline(false);a.data.exmeta.press.lo=6;await a.engine.sync();b.data.settings.rest='120';await b.engine.sync();a.setOnline(true);await a.engine.sync();await b.engine.sync();
  ok(a.engine.status==='synced'&&b.data.exmeta.press.lo===6&&a.data.settings.rest==='120','combina cambios pendientes al reconectar');
  a.data.exmeta.press.notes='Elección A';b.data.exmeta.press.notes='Elección B';await a.engine.sync();await b.engine.sync();
  ok(b.engine.status==='conflict'&&b.data.exmeta.press.notes==='Elección B','preserva la edición local cuando coincide con otra');
  await b.engine.resolve({'/exmeta/press/notes':'local'});await a.engine.sync();ok(a.data.exmeta.press.notes==='Elección B','propaga la resolución del conflicto');
  const response=await fetch(url+'/v1/vaults/'+a.engine.keys.id,{headers:{Authorization:'Bearer '+a.engine.keys.auth,Origin:'https://elrobamichis.github.io'}}),cipher=await response.text();
  ok(response.headers.get('access-control-allow-origin')==='https://elrobamichis.github.io'&&!cipher.includes('Elección')&&!cipher.includes(key),'Pages puede acceder y el servidor entrega únicamente ciphertext');
  const other=await C.keys(await C.createKey());
  const rejected=await fetch(url+'/v1/vaults/'+a.engine.keys.id,{headers:{Authorization:'Bearer '+other.auth}});ok(rejected.status===404,'otra clave no puede acceder al espacio de prueba');
  const origin=await fetch(url+'/v1/vaults/'+a.engine.keys.id,{headers:{Authorization:'Bearer '+a.engine.keys.auth,Origin:'https://not-hierro.example'}});ok(origin.status===403,'rechaza un origen web ajeno');
 }finally{
  if(account?.state?.created){
   const r=await account.call('GET');await account.call('DELETE',account.keys,{revision:r.revision});
   console.log('OK espacio de prueba eliminado; no se modificaron datos de usuarios');
  }
 }
 console.log(`PRUEBA EN LA NUBE OK (${checks})`);
})().catch(error=>{console.error(error.message);process.exitCode=1;});
