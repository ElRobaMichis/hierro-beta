/* Web Push, RFC 8291. Encryption happens here, before Cloudflare receives a job.
   The browser's subscription secrets and readable training never leave the app. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;else root.HierroPushCore=api;
})(globalThis,function(){
  'use strict';
  const utf8=new TextEncoder();
  const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
  const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
  function concat(...arrays){const out=new Uint8Array(arrays.reduce((n,a)=>n+a.length,0));let p=0;for(const a of arrays){out.set(a,p);p+=a.length;}return out;}
  async function hkdf(input,salt,info,length){
    const key=await crypto.subtle.importKey('raw',input,'HKDF',false,['deriveBits']);
    return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,length*8));
  }
  async function encrypt(subscription,message,fixture={}){
    const ua=bytes(subscription.keys.p256dh),auth=bytes(subscription.keys.auth),plain=utf8.encode(JSON.stringify(message));
    if(ua.length!==65||ua[0]!==4||auth.length!==16||plain.length>3000)throw new Error('Aviso o suscripción no válido.');
    const sender=fixture.sender||await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
    const pub=new Uint8Array(await crypto.subtle.exportKey('raw',sender.publicKey));
    const receiver=await crypto.subtle.importKey('raw',ua,{name:'ECDH',namedCurve:'P-256'},false,[]);
    const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:receiver},sender.privateKey,256));
    const ikm=await hkdf(shared,auth,concat(utf8.encode('WebPush: info\0'),ua,pub),32);
    const salt=fixture.salt||crypto.getRandomValues(new Uint8Array(16));
    const cek=await hkdf(ikm,salt,utf8.encode('Content-Encoding: aes128gcm\0'),16);
    const nonce=await hkdf(ikm,salt,utf8.encode('Content-Encoding: nonce\0'),12);
    const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
    const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv:nonce},key,concat(plain,new Uint8Array([2]))));
    const header=new Uint8Array(21);header.set(salt);new DataView(header.buffer).setUint32(16,4096);header[20]=65;
    return b64(concat(header,pub,encrypted));
  }
  function schedule(snapshot,prefs,now=Date.now()){
    if(!snapshot?.id)return [];
    const out=[],rest=snapshot.rest;
    const add=(kind,at,copy)=>{
      if(!Number.isFinite(at)||at<=now||at>now+24*60*60*1000)return;
      const id=snapshot.id+':'+kind+':'+at;
      out.push({id,at,expires:at+90000,message:{v:1,id,kind,session:snapshot.id,target:copy?.target||'',expires:at+90000,
        title:kind==='idle'?'Tu sesión sigue aquí':kind==='warmup'?'Preparación · descanso listo':'Descanso listo',
        body:prefs.details?copy?.body||'Abre Hierro para ver tu siguiente paso.':kind==='idle'?'Llevas un rato sin registrar. Continúa cuando estés listo.':'Tu siguiente paso está listo en Hierro.'}});
    };
    if(prefs.rest&&rest)add(rest.kind,rest.at,rest.next);
    if(prefs.idle){
      // A five-minute prescribed rest must never trigger an inactivity warning.
      const at=Math.max(snapshot.lastSetAt+300000,(rest?.at||0)+60000);
      add('idle',at,{target:snapshot.next?.target,body:'Han pasado 5 min sin registrar una serie. '+(snapshot.next?.body||'Si terminaste, guarda la sesión.')});
    }
    return out;
  }
  return {bytes,b64,encrypt,schedule};
});
