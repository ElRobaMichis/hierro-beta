const utf8=new TextEncoder();
export const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
export function endpointOK(value){
  try{
    const u=new URL(value),h=u.hostname;
    return value.length<=2048&&u.protocol==='https:'&&!u.port&&!u.username&&!u.password&&!u.hash&&u.pathname.length>1&&
      (h==='fcm.googleapis.com'||h==='updates.push.services.mozilla.com'||h.endsWith('.push.services.mozilla.com')||h==='web.push.apple.com'||h.endsWith('.push.apple.com')||h.endsWith('.notify.windows.com'));
  }catch{return false;}
}
export function publicKey(jwk){return b64(new Uint8Array([4,...bytes(jwk.x),...bytes(jwk.y)]));}
export async function vapid(jwk,endpoint,now=Date.now()){
  const head=b64(utf8.encode(JSON.stringify({typ:'JWT',alg:'ES256'})));
  const claims=b64(utf8.encode(JSON.stringify({aud:new URL(endpoint).origin,exp:Math.floor(now/1000)+3600,sub:'https://elrobamichis.github.io/hierro-beta/'})));
  const key=await crypto.subtle.importKey('jwk',jwk,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,utf8.encode(head+'.'+claims));
  return 'vapid t='+head+'.'+claims+'.'+b64(signature)+', k='+publicKey(jwk);
}
export function validatePlan(input,now=Date.now()){
  if(!input||!Number.isSafeInteger(input.seq)||input.seq<1||!Number.isSafeInteger(input.revision)||input.revision<1||!Number.isFinite(input.now)||Math.abs(input.now-now)>86400000||!Array.isArray(input.events)||input.events.length>2)throw new Error('plan');
  if(input.session!==null&&(typeof input.session!=='string'||!/^[a-zA-Z0-9_-]{1,100}$/.test(input.session)))throw new Error('session');
  if(!input.session&&input.events.length)throw new Error('events without session');
  const seen=new Set();
  return {seq:input.seq,revision:input.revision,session:input.session,events:input.events.map(e=>{
    if(!e||typeof e.id!=='string'||e.id.length>180||seen.has(e.id)||!Number.isFinite(e.at)||!Number.isFinite(e.expires)||e.at<input.now-1000||e.at>input.now+86400000||e.expires<=e.at||e.expires-e.at>120000||typeof e.body!=='string'||!/^[-_A-Za-z0-9]{140,5500}$/.test(e.body))throw new Error('event');
    seen.add(e.id);const body=bytes(e.body);
    if(body.length>4096||body[20]!==65||body[21]!==4||new DataView(body.buffer).getUint32(16)!==4096)throw new Error('ciphertext');
    // Deadlines use the client countdown duration, never a guessed device clock.
    return {id:e.id,body:e.body,at:now+Math.max(0,e.at-input.now),expires:now+e.expires-input.now,attempts:0};
  })};
}
