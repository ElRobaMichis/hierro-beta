import {DurableObject} from 'cloudflare:workers';
import {bytes,vapid,endpointOK,validatePlan} from './push-delivery.mjs';
const response=(status,data)=>new Response(data?JSON.stringify(data):null,{status,headers:{'Content-Type':'application/json'}});
export class PushScheduler extends DurableObject {
  constructor(ctx,env){super(ctx,env);this.ctx=ctx;this.env=env;}
  async fetch(request){
    // Only the authenticated Worker routes here. No public Durable Object URL.
    return this.ctx.blockConcurrencyWhile(async()=>{
      const path=new URL(request.url).pathname,store=this.ctx.storage;
      if(path==='/purge'){await store.deleteAlarm();await store.deleteAll();return response(204);}
      const input=await request.json(),device=input.device;
      if(typeof device!=='string'||!/^[a-zA-Z0-9_-]{8,100}$/.test(device)||['__proto__','constructor','prototype'].includes(device))return response(400);
      const state=await store.get('state')||{devices:{},owner:null,revision:0,session:null,events:[],delivered:[],last:null};
      state.vault=input.vault;
      if(path==='/status')return response(200,{registered:!!state.devices[device],owner:state.owner===device,pending:state.owner===device?state.events.map(e=>({id:e.id,at:e.at})):[],last:state.last?.device===device?{at:state.last.at,status:state.last.status}:null});
      if(path==='/register'){
        if(!endpointOK(input.endpoint))return response(400);
        if(!state.devices[device]&&Object.keys(state.devices).length>=8)return response(409);
        const old=state.devices[device];
        if(old?.endpoint!==input.endpoint&&state.owner===device)state.events=[];
        state.devices[device]={endpoint:input.endpoint,seq:old?.seq||0,updated:Date.now()};
      }else if(path==='/remove'){
        delete state.devices[device];if(state.owner===device){state.events=[];state.session=null;}
      }else if(path==='/plan'){
        const sub=state.devices[device];if(!sub)return response(410);
        let plan;try{plan=validatePlan(input);}catch{return response(400);}
        if(plan.seq<=sub.seq)return response(200,{accepted:false,seq:sub.seq});
        if(plan.session&&state.session&&state.owner&&state.owner!==device&&plan.revision<=state.revision)return response(409);
        sub.seq=plan.seq;sub.updated=Date.now();
        if(plan.session||state.owner===device){
          state.owner=device;state.revision=Math.max(state.revision,plan.revision);state.session=plan.session;
          state.events=plan.events.filter(e=>!state.delivered.includes(e.id));
        }
      }else return response(404);
      await store.put('state',state);await this.rearm(state);return response(200,{accepted:true,seq:state.devices[device]?.seq||0});
    });
  }
  async rearm(state){
    const times=state.events.map(e=>e.at);
    if(times.length)await this.ctx.storage.setAlarm(Math.max(Date.now()+1,Math.min(...times)));
    else await this.ctx.storage.deleteAlarm();
  }
  async alarm(){
    await this.ctx.blockConcurrencyWhile(async()=>{
      const store=this.ctx.storage,state=await store.get('state');if(!state)return;
      const now=Date.now(),sub=state.devices[state.owner];
      // Deletion/revocation of an account cancels jobs even after Worker crashes.
      const exists=state.vault?await this.env.DB.prepare('SELECT id FROM vaults WHERE id=?').bind(state.vault).first():true;
      if(!exists){await store.deleteAll();return;}
      for(const event of [...state.events]){
        if(event.at>now)continue;
        let status='expired';
        if(sub&&event.expires>now){
          try{
            const endpoint=sub.endpoint,auth=await vapid(JSON.parse(this.env.VAPID_JWK),endpoint);
            const r=await fetch(endpoint,{method:'POST',redirect:'manual',headers:{Authorization:auth,'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream',TTL:String(Math.max(0,Math.floor((event.expires-now)/1000))),Urgency:'high',Topic:'hierro-workout'},body:bytes(event.body),signal:AbortSignal.timeout(8000)});
            status=String(r.status);
            if([404,410].includes(r.status)){delete state.devices[state.owner];state.events=[];}
            else if((r.status===429||r.status>=500)&&event.at+10000<event.expires&&event.attempts<3){event.at=Date.now()+10000;event.attempts++;continue;}
          }catch{
            status='network';if(event.attempts<3&&Date.now()+10000<event.expires){event.at=Date.now()+10000;event.attempts++;continue;}
          }
        }
        state.last={device:state.owner,at:Date.now(),status};state.delivered=[...state.delivered,event.id].slice(-100);
        state.events=state.events.filter(e=>e.id!==event.id);
        await store.put('state',state);
      }
      if(!state.events.length&&state.session==='test')state.session=null;
      await store.put('state',state);await this.rearm(state);
    });
  }
}
