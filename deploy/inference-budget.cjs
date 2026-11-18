// Preserve native model capacity and the supervisor-issued local credential reference.
// This handles opaque references only; never read or invent provider secret material.
module.exports=function inferenceBudget(config,env=process.env){
 const primary=config.agents?.defaults?.model?.primary||'',slash=primary.indexOf('/');
 const provider=primary.slice(0,slash),id=primary.slice(slash+1),models=config.models?.providers?.[provider]?.models;
 const model=Array.isArray(models)?models.find(m=>m.id===id):null;
 const context=Number(model?.contextWindow)||0,existing=Number(model?.maxTokens)||4096;
 const reference=['nvidia/Qwen3.6-35B-A3B-NVFP4','santa-qwen'].includes(id);
 const ceiling=reference&&context>=32768?Math.max(existing,Math.min(12288,Math.floor(context/2))):existing;
 const workerTokens=Math.min(10000,ceiling,context?Math.max(256,Math.floor(context/3)):4096);
 const patch=model&&ceiling!==existing?{models:models.map(m=>m.id===id?{...m,maxTokens:ceiling}:m)}:{};
 const runtime=config.models?.providers?.[provider],unscoped='openshell:resolve:env:NEMOCLAW_LOCAL_INFERENCE_TOKEN',scoped=/^openshell:resolve:env:(v[0-9]{1,20}|s[a-f0-9]{64})_NEMOCLAW_LOCAL_INFERENCE_TOKEN$/;
 let local=false;try{const u=new URL(runtime?.baseUrl);local=u.protocol==='http:'&&['host.openshell.internal','host.docker.internal'].includes(u.hostname)&&!!u.port&&!u.username&&!u.password&&!u.search&&!u.hash;}catch{}
 if(local&&(runtime.apiKey===unscoped||scoped.test(runtime.apiKey||''))){const reference=env.NEMOCLAW_LOCAL_INFERENCE_TOKEN;if(!scoped.test(reference||''))throw Error('Native local credential reference unavailable. Reconnect the selected sandbox runtime before testing.');if(reference!==runtime.apiKey)patch.apiKey=reference;}
 return {workerTokens,modelMaxTokens:ceiling,providerPatch:Object.keys(patch).length?{models:{providers:{[provider]:patch}}}:{}};
};
