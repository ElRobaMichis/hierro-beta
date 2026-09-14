/* Transport-independent synchronization. Adapters keep UI, storage and tests apart. */
(function(root,factory){
  if(typeof module==='object'&&module.exports)module.exports=factory(require('./sync-core.js'));
  else root.HierroSyncEngine=factory(root.HierroSyncCore);
})(globalThis,function(C){
  'use strict';
  class SyncError extends Error {constructor(code,message){super(message);this.code=code;}}
  class Engine {
    constructor({url,store,adapter,fetch:request=globalThis.fetch.bind(globalThis)}){
      this.url=url.replace(/\/$/,'');this.store=store;this.adapter=adapter;this.request=request;this.state=null;this.running=false;this.pending=null;this.status='local';this.message='En este dispositivo';
    }
    emit(status,message){this.status=status;this.message=message;this.adapter.notify?.(status,message);}
    async load(){this.state=await this.store.get();if(this.state?.key){this.keys=await C.keys(this.state.key);this.emit('pending','Listo para sincronizar');}return this.state;}
    async persist(){await this.store.set(C.clone(this.state));}
    async checkpoint(doc,label){
      const list=this.state?.checkpoints||[];
      if(list.length&&C.equal(list[0].doc,doc))return;
      this.state.checkpoints=[{at:Date.now(),label,doc:C.clone(doc)},...list].slice(0,3);
      await this.persist();
    }
    async call(method,k=this.keys,{revision,packet,conditional}={}){
      if(!this.url)throw new SyncError('setup','La sincronización todavía no está disponible.');
      const headers={Authorization:'Bearer '+k.auth};
      if(revision!==undefined)headers['If-Match']='"'+revision+'"';
      if(conditional)headers['If-None-Match']='"'+conditional+'"';
      if(packet!==undefined)headers['Content-Type']='application/octet-stream';
      const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),20000);
      try{
        const response=await this.request(this.url+'/v1/vaults/'+k.id,{method,headers,body:packet,cache:'no-store',credentials:'omit',referrerPolicy:'no-referrer',signal:controller.signal});
        if(response.status===409)throw new SyncError('race','La copia cambió en otro dispositivo.');
        if(response.status===404)throw new SyncError('missing','No encontramos este espacio. Revisa la clave o comprueba que se creó con conexión.');
        if(response.status===429||response.status>=500)throw new SyncError('retry','El servicio no está disponible ahora. Tus cambios están guardados y se reintentará más tarde.');
        if(response.status===413)throw new SyncError('size','La copia supera el espacio admitido. Descarga un respaldo; tus datos locales se conservan.');
        if(!response.ok&&response.status!==304)throw new SyncError('response','No se pudo sincronizar. Tus cambios siguen guardados en este dispositivo.');
        const revisionNumber=Number(response.headers.get('ETag')?.replaceAll('"',''));
        if(method!=='DELETE'&&(!Number.isSafeInteger(revisionNumber)||revisionNumber<1))throw new SyncError('protocol','La respuesta del servicio no es válida.');
        return {status:response.status,revision:revisionNumber,packet:method==='GET'&&response.status!==304?await response.text():null};
      }catch(e){if(e.name==='AbortError'||e instanceof TypeError)throw new SyncError('network','Sin conexión al servicio. Tus cambios se enviarán al volver.');throw e;}
      finally{clearTimeout(timeout);}
    }
    async inspect(key){const k=await C.keys(key),r=await this.call('GET',k);return {key:key.trim(),keys:k,remote:await C.open(r.packet,k),revision:r.revision};}
    async create(){
      if(this.state?.key||this.connecting)throw new SyncError('connected','Este dispositivo ya está vinculado o está terminando de vincularse.');
      this.connecting=true;
      try{
      const key=await C.createKey();this.keys=await C.keys(key);
      this.state={key,base:C.empty(),revision:0,created:false,lastSync:null,checkpoints:this.state?.checkpoints||[]};
      // Retain the key BEFORE the request. A lost HTTP response must never strand
      // an account that the server already created.
      await this.persist();await this.sync();return key;
      }finally{this.connecting=false;}
    }
    async link(inspected,mode='merge',choices={}){
      if(this.state?.key)throw new SyncError('connected','Desvincula este dispositivo antes de usar otra clave.');
      const local=this.adapter.read(),result=mode==='replace'?{value:inspected.remote,conflicts:[]}:C.merge(C.empty(),local,inspected.remote,choices);
      if(result.conflicts.length)return result;
      C.validate(result.value);
      const candidate={key:inspected.key,base:inspected.remote,revision:inspected.revision,created:true,lastSync:null,checkpoints:[{at:Date.now(),label:'Antes de vincular',doc:local}]};
      // Stash a recovery copy before changing the local database. This temporary
      // record has no credential until the app has durably accepted the merge.
      this.state={...candidate,key:null};await this.persist();
      if(!C.equal(local,this.adapter.read()))throw new SyncError('changed','Tus datos cambiaron mientras se vinculaba. Vuelve a revisar las dos copias.');
      this.adapter.apply(result.value);
      this.keys=inspected.keys;this.state=candidate;await this.persist();await this.sync();return {conflicts:[]};
    }
    async sync(choices){
      if(this.running||!this.state?.key||this.adapter.enabled?.()===false)return false;
      if(this.pending&&!choices){this.emit('conflict','Hay cambios que revisar');return false;}
      this.running=true;
      try{
        this.emit('working','Sincronizando…');
        for(let attempt=0;attempt<4;attempt++){
          let response,remote;
          try{response=await this.call('GET',this.keys,{conditional:this.state.revision});remote=response.status===304?this.state.base:await C.open(response.packet,this.keys);}
          catch(e){
            if(e.code==='missing'&&!this.state.created){
              const sent=this.adapter.read(),packet=await C.seal(sent,this.keys);
              try{
                const created=await this.call('POST',this.keys,{packet});
                this.state.base=sent;this.state.revision=created.revision;this.state.created=true;this.state.lastSync=Date.now();await this.persist();
                this.emit(C.equal(sent,this.adapter.read())?'synced':'pending',C.equal(sent,this.adapter.read())?'Todo sincronizado':'Cambios pendientes');return true;
              }catch(createError){if(createError.code==='race')continue;throw createError;}
            }throw e;
          }
          const local=this.adapter.read();
          // An explicit choice is valid only for the exact two versions shown.
          // More edits (or a third device) require a fresh review.
          if(choices&&this.pending&&(!C.equal(this.pending.local,local)||!C.equal(this.pending.remote,remote)))choices=undefined;
          const merged=C.merge(this.state.base,local,remote,choices||{});
          if(merged.conflicts.length){
            await this.checkpoint(remote,'Copia del otro dispositivo');
            await this.checkpoint(local,'Antes de resolver cambios');
            this.pending={...merged,local,remote,revision:response.revision};
            this.emit('conflict','Hay cambios que revisar');return false;
          }
          C.validate(merged.value);
          if(!C.equal(merged.value,local)){
            if(this.adapter.busy?.(merged.value,local)){this.emit('waiting','Cambios listos para cuando termines');return false;}
            await this.checkpoint(local,'Antes de recibir cambios');
            // A keystroke can arrive while IndexedDB saves the checkpoint.
            // Recalculate; never install a stale snapshot over that keystroke.
            if(!C.equal(this.adapter.read(),local)){this.emit('pending','Cambios pendientes');return false;}
            if(this.adapter.busy?.(merged.value,local)){this.emit('waiting','Cambios listos para cuando termines');return false;}
            this.adapter.apply(merged.value);
          }
          this.pending=null;
          // Remote data is now present locally. Acknowledge the remote base before
          // sending: edits made during encryption/upload will remain a local delta.
          this.state.base=remote;this.state.revision=response.revision;this.state.created=true;await this.persist();
          const sent=this.adapter.read();
          if(!C.equal(sent,remote)){
            const packet=await C.seal(sent,this.keys);
            try{
              const written=await this.call('PUT',this.keys,{revision:response.revision,packet});
              this.state.base=sent;this.state.revision=written.revision;
            }catch(e){if(e.code==='race'){choices=undefined;continue;}throw e;}
          }
          this.state.lastSync=Date.now();await this.persist();
          const clean=C.equal(this.state.base,this.adapter.read());
          this.emit(clean?'synced':'pending',clean?'Todo sincronizado':'Cambios pendientes');return true;
        }
        this.emit('pending','Llegaron más cambios. Volveremos a intentarlo.');return false;
      }catch(e){this.emit(['network','retry'].includes(e.code)?'offline':'error',e.message||'No se pudo sincronizar. Los datos locales se conservan.');return false;}
      finally{this.running=false;}
    }
    async resolve(choices){return this.sync(choices);}
    async claim(device){
      if(this.running)throw new SyncError('busy','Espera a que termine la sincronización.');
      this.running=true;
      try{
        const r=await this.call('GET'),remote=await C.open(r.packet,this.keys);
        if(!remote.active)throw new SyncError('finished','La sesión ya terminó en el otro dispositivo. Sincroniza para recibirla.');
        const local=this.adapter.read(),merged=C.merge(this.state.base,local,remote);
        if(merged.conflicts.length)throw new SyncError('conflict','Primero revisa los cambios pendientes.');
        const next=C.clone(merged.value);next.active.owner=device;
        await this.checkpoint(this.adapter.read(),'Antes de continuar la sesión');
        const packet=await C.seal(next,this.keys);
        const written=await this.call('PUT',this.keys,{revision:r.revision,packet});
        // A person can edit while the transfer is in flight. The next regular
        // reconciliation will receive ownership without discarding those edits.
        if(!C.equal(local,this.adapter.read())){this.emit('pending','Sesión transferida. Quedan cambios por combinar.');return false;}
        this.adapter.apply(next);this.state.base=next;this.state.revision=written.revision;this.state.lastSync=Date.now();await this.persist();this.emit('synced','Todo sincronizado');return true;
      }finally{this.running=false;}
    }
    async disconnect(){if(this.running||this.connecting)throw new SyncError('busy','Espera a que termine la sincronización.');await this.store.set(null);this.state=null;this.keys=null;this.pending=null;this.emit('local','En este dispositivo');}
  }
  return {Engine,SyncError};
});
