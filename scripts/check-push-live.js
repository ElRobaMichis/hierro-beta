/* Verify real Cloudflare alarms using an intentionally invalid, disposable push
   endpoint. This proves scheduled sending, not reception on a physical phone. */
const assert=require('node:assert/strict'),C=require('../sync-core.js'),P=require('../push-core.js');
const base=process.argv[2];if(!base?.startsWith('https://'))throw Error('Indica la URL HTTPS del Worker.');
(async()=>{
 const keys=await C.keys(await C.createKey()),vault=base+'/v1/vaults/'+keys.id;
 const headers={Origin:'https://elrobamichis.github.io',Authorization:'Bearer '+keys.auth};let created=false;
 try{
  const config=await fetch(base+'/push/config',{headers:{Origin:headers.Origin}});assert.equal(config.status,200);assert.equal((await config.json()).publicKey.length,87);
  const r=await fetch(vault,{method:'POST',headers:{...headers,'Content-Type':'application/octet-stream'},body:await C.seal(C.empty(),keys)});assert.equal(r.status,201);created=true;
  const call=async(action,input={})=>{
   const r=await fetch(vault+'/push/'+action,{method:'POST',headers:{...headers,'Content-Type':'application/json'},body:JSON.stringify({device:'live-qa-phone',...input})});assert.equal(r.status,200);return r.json();
  };
  await call('register',{endpoint:'https://web.push.apple.com/hierro-qa-'+crypto.randomUUID()});
  const pair=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const sub={keys:{p256dh:P.b64(await crypto.subtle.exportKey('raw',pair.publicKey)),auth:P.b64(crypto.getRandomValues(new Uint8Array(16)))}};
  const at=Date.now()+3000,body=await P.encrypt(sub,{v:1,id:'qa',kind:'test',title:'Prueba sintética',body:'Solo verificación',expires:at+90000});
  await call('plan',{seq:1,revision:1,session:'test',now:Date.now(),events:[{id:'qa',at,expires:at+90000,body}]});
  assert.equal((await call('status')).pending.length,1);console.log('OK Cloudflare conserva el aviso programado.');
  let state;for(let i=0;i<30;i++){await new Promise(r=>setTimeout(r,1000));state=await call('status');if(state.last)break;}
  assert.ok(state?.last&&/^4\d\d$/.test(state.last.status),'El proveedor debe rechazar el endpoint ficticio después de ejecutarse la alarma.');
  assert.equal(state.pending.length,0);console.log('OK La alarma se ejecutó y el proveedor respondió al envío cifrado (endpoint de prueba inválido).');
  console.log('La recepción real se comprueba con «Probar con pantalla bloqueada» en el dispositivo.');
 }finally{
  if(created){const r=await fetch(vault,{method:'DELETE',headers:{...headers,'If-Match':'"1"'}});assert.equal(r.status,204);console.log('OK Cuenta de prueba y programador eliminados.');}
 }
})().catch(e=>{console.error(e.message);process.exit(1)});
