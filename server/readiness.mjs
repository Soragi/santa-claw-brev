// Read-only dependency probes for operators. /health stays shallow; /ready says which local dependency is down.
const timed=async(name,probe)=>{const started=Date.now();try{const detail=await probe();return {name,ok:true,ms:Date.now()-started,...detail};}catch(error){return {name,ok:false,ms:Date.now()-started,error:String(error?.message||error).slice(0,200)};}};
// Readiness is observational. Share native probes so impatient clients cannot
// multiply expensive CLI/model-catalog processes while a prior check is running.
export function readinessCache(probe,{ttlMs=5000,now=Date.now}={}){
 let pending=null,saved=null,expires=0;
 return()=>{if(pending)return pending;if(saved&&now()<expires)return Promise.resolve(saved);pending=Promise.resolve().then(probe).then(value=>{saved=value;expires=now()+ttlMs;return value;}).finally(()=>pending=null);return pending;};
}
export async function localModelProbe({port=process.env.NEMOCLAW_VLLM_PORT||'8000',expected=process.env.SANTA_LOCAL_MODEL,fetchImpl=fetch}={}){if(!/^\d+$/.test(String(port)))throw Error('Invalid local model port');const response=await fetchImpl('http://127.0.0.1:'+port+'/v1/models',{redirect:'error',signal:AbortSignal.timeout(3000)});if(!response.ok)throw Error('HTTP '+response.status);const models=(await response.json())?.data||[];const model=expected?models.find(m=>m.id===expected):models[0];if(!model)throw Error(expected?'Served model '+expected+' not found':'No served model');return {model:model.id,maxModelLength:model.max_model_len??null};}
export async function readiness({db,network,model=localModelProbe,nativeModel=null,version}={}){
 const checks=await Promise.all([
  timed('database',async()=>{db.prepare('SELECT 1').get();return {};}),
  timed('localModel',async()=>{try{return await model();}catch(error){if(!nativeModel)throw error;return nativeModel();}}),
  timed('openshell',async()=>{const state=network?.state||{};if(!state.ready)throw Error(state.message||'OpenShell gate not ready');return {sandbox:state.sandbox,version:state.version||null};})]);
 const active=db.prepare("SELECT COUNT(*) n FROM missions WHERE state IN ('queued','planning','working','reviewing','synthesizing','waiting_approval','stopping')").get().n;
 return {ok:checks.every(c=>c.ok),version,activeJobs:active,checks,checkedAt:new Date().toISOString()};}
