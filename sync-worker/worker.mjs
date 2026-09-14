/* Stores opaque AES-GCM ciphertext. Root keys and training data never arrive here. */
import {publicKey} from './push-delivery.mjs';
export {PushScheduler} from './push-scheduler.mjs';
const MAX_BODY=9*1024*1024,CHUNK=400000,MAX_ACCOUNTS=32;
const token=/^[A-Za-z0-9_-]{43}$/;
const encoder=new TextEncoder();
async function digest(value){return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(value))),b=>b.toString(16).padStart(2,'0')).join('');}
async function limitedBody(request){
  if(Number(request.headers.get('content-length')||0)>MAX_BODY)throw Object.assign(new Error(),{status:413});
  if(!request.body)throw Object.assign(new Error(),{status:400});
  const reader=request.body.getReader(),parts=[];let size=0;
  for(;;){const {value,done}=await reader.read();if(done)break;size+=value.length;if(size>MAX_BODY){await reader.cancel();throw Object.assign(new Error(),{status:413});}parts.push(value);}
  const bytes=new Uint8Array(size);let p=0;for(const part of parts){bytes.set(part,p);p+=part.length;}
  const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);
  if(!/^h1\.[jz]\.[A-Za-z0-9_-]{16}\./.test(text)||text.length<50)throw Object.assign(new Error(),{status:400});
  return text;
}
export default {
  async fetch(request,env){
    const origin=request.headers.get('Origin'),allowed=(env.ALLOWED_ORIGINS||'https://elrobamichis.github.io').split(',').map(s=>s.trim());
    const headers={'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Vary':'Origin','Content-Security-Policy':"default-src 'none'"};
    if(origin&&allowed.includes(origin))Object.assign(headers,{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, PUT, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, If-Match, If-None-Match','Access-Control-Expose-Headers':'ETag, Retry-After','Access-Control-Max-Age':'600'});
    const reply=(status,body=null,extra={})=>new Response(body,{status,headers:{...headers,...extra}});
    if(origin&&!allowed.includes(origin))return reply(403);
    if(request.method==='OPTIONS')return reply(204);
    const url=new URL(request.url);
    if(url.pathname==='/health'&&request.method==='GET')return reply(200,JSON.stringify({service:'hierro-sync',protocol:1}),{'Content-Type':'application/json'});
    if(url.pathname==='/push/config'&&request.method==='GET'){
      if(!env.VAPID_JWK||!env.PUSH)return reply(503);
      return reply(200,JSON.stringify({protocol:1,publicKey:publicKey(JSON.parse(env.VAPID_JWK))}),{'Content-Type':'application/json'});
    }
    const match=url.pathname.match(/^\/v1\/vaults\/([A-Za-z0-9_-]{43})(?:\/push\/(register|remove|plan|status))?$/);
    if(!match)return reply(404);
    const id=match[1],auth=request.headers.get('Authorization')?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
    if(!auth||!token.test(auth))return reply(401);
    if(!['GET','POST','PUT','DELETE'].includes(request.method))return reply(405);
    try{
      // Limits are deliberately fixed, with no paid fallback. The database also
      // caps registrations so anonymous signups cannot fill 500 MB on Free.
      const ip=await digest(request.headers.get('CF-Connecting-IP')||'local');
      if(env.REQUEST_LIMIT&&!(await env.REQUEST_LIMIT.limit({key:ip})).success)return reply(429,'',{'Retry-After':'60'});
      if(request.method==='POST'&&env.CREATE_LIMIT&&!(await env.CREATE_LIMIT.limit({key:ip})).success)return reply(429,'',{'Retry-After':'60'});
      const authHash=await digest(auth),D=env.DB;
      if(match[2]){
        if(!env.PUSH||!env.VAPID_JWK)return reply(503);
        if(request.method!=='POST'||request.headers.get('Content-Type')!=='application/json')return reply(405);
        const account=await D.prepare('SELECT revision FROM vaults WHERE id=? AND auth_hash=?').bind(id,authHash).first();
        if(!account)return reply(404);
        if(Number(request.headers.get('Content-Length')||0)>22000)return reply(413);
        const reader=request.body?.getReader();if(!reader)return reply(400);
        let raw='',size=0;const decoder=new TextDecoder();
        for(;;){const part=await reader.read();if(part.done)break;size+=part.value.length;if(size>22000){await reader.cancel();return reply(413);}raw+=decoder.decode(part.value,{stream:true});}
        raw+=decoder.decode();let input;try{input=JSON.parse(raw);}catch{return reply(400);}
        if(!input||Array.isArray(input)||typeof input!=='object')return reply(400);
        if(match[2]==='plan'&&(!Number.isSafeInteger(input.revision)||input.revision>account.revision))return reply(409);
        const r=await env.PUSH.getByName(id).fetch(new Request('https://scheduler/'+match[2],{method:'POST',body:JSON.stringify({...input,vault:id})}));
        return reply(r.status,await r.text(),{'Content-Type':'application/json'});
      }
      if(request.method==='GET'){
        const meta=await D.prepare('SELECT revision FROM vaults WHERE id=? AND auth_hash=?').bind(id,authHash).first();
        if(!meta)return reply(404);
        if(request.headers.get('If-None-Match')===`"${meta.revision}"`)return reply(304,null,{ETag:`"${meta.revision}"`});
        // One statement observes a single committed revision, including all its
        // chunks, even when another device uploads between these two SELECTs.
        const rows=await D.prepare('SELECT v.revision, c.part, c.body FROM vaults v JOIN chunks c ON c.vault_id=v.id AND c.upload_id=v.upload_id WHERE v.id=? AND v.auth_hash=? ORDER BY c.part').bind(id,authHash).all();
        if(!rows.results.length)return reply(404);
        return reply(200,rows.results.map(r=>r.body).join(''),{ETag:`"${rows.results[0].revision}"`,'Content-Type':'application/octet-stream'});
      }
      const expected=request.headers.get('If-Match')?.match(/^"(\d+)"$/)?.[1];
      if(request.method!=='POST'&&(!expected||!Number.isSafeInteger(Number(expected))))return reply(428);
      if(request.method==='DELETE'){
        const result=await D.prepare('DELETE FROM vaults WHERE id=? AND auth_hash=? AND revision=?').bind(id,authHash,Number(expected)).run();
        if(result.meta.changes&&env.PUSH)await env.PUSH.getByName(id).fetch(new Request('https://scheduler/purge',{method:'POST'}));
        return reply(result.meta.changes?204:409);
      }
      if(request.headers.get('Content-Type')!=='application/octet-stream')return reply(415);
      // Check authorization before reading a large body on existing accounts.
      if(request.method==='PUT'){
        const meta=await D.prepare('SELECT revision FROM vaults WHERE id=? AND auth_hash=?').bind(id,authHash).first();
        if(!meta)return reply(404);if(meta.revision!==Number(expected))return reply(409);
      }
      const body=await limitedBody(request),upload=crypto.randomUUID(),chunks=[];
      for(let p=0;p<body.length;p+=CHUNK)chunks.push(body.slice(p,p+CHUNK));
      const revision=request.method==='POST'?1:Number(expected)+1;
      const mutation=request.method==='POST'
        ?D.prepare('INSERT INTO vaults(id,auth_hash,revision,upload_id,updated_at,bytes) SELECT ?,?,1,?,?,? WHERE (SELECT COUNT(*) FROM vaults)<? ON CONFLICT(id) DO NOTHING').bind(id,authHash,upload,Date.now(),body.length,MAX_ACCOUNTS)
        :D.prepare('UPDATE vaults SET revision=revision+1,upload_id=?,updated_at=?,bytes=? WHERE id=? AND auth_hash=? AND revision=?').bind(upload,Date.now(),body.length,id,authHash,Number(expected));
      const statements=[mutation,D.prepare('DELETE FROM chunks WHERE vault_id=? AND EXISTS(SELECT 1 FROM vaults WHERE id=? AND upload_id=?)').bind(id,id,upload)];
      for(let i=0;i<chunks.length;i++)statements.push(D.prepare('INSERT INTO chunks(vault_id,upload_id,part,body) SELECT ?,?,?,? WHERE EXISTS(SELECT 1 FROM vaults WHERE id=? AND upload_id=?)').bind(id,upload,i,chunks[i],id,upload));
      // D1 batch is a transaction. A failed compare-and-swap performs no chunk
      // deletion/insertion; an interrupted upload cannot publish half a copy.
      const results=await D.batch(statements);
      if(!results[0].meta.changes){
        if(request.method==='POST'&&!(await D.prepare('SELECT id FROM vaults WHERE id=?').bind(id).first()))return reply(503,'',{'Retry-After':'3600'});
        return reply(409);
      }
      return reply(request.method==='POST'?201:204,request.method==='POST'?'':null,{ETag:`"${revision}"`});
    }catch(error){
      // Never log request bodies, Authorization headers or exception contents.
      return reply(error.status||503,'',{'Retry-After':'60'});
    }
  }
};
