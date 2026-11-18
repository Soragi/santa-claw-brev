// Executed only inside OpenShell. Real provider keys are never accepted or returned.
const fs=require('node:fs'),cp=require('node:child_process'),net=require('node:net');
const scoped=key=>new RegExp('^openshell:resolve:env:(?:v[0-9]{1,20}|s[a-f0-9]{64})_'+key+'$');
const managed=()=>({baseUrl:'https://inference.local/v1',apiKey:'openshell'});
function localEndpoint(value){try{const u=new URL(value),h=u.hostname,privateIp=net.isIP(h)===4&&(/^(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(h));if(u.protocol!=='http:'||!['host.openshell.internal','host.docker.internal'].includes(h)&&!privateIp||!u.port||Number(u.port)<1024||u.username||u.password||u.search||u.hash||!/^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_-]+\/?$/.test(u.pathname))throw Error();return u.origin+u.pathname.replace(/\/$/,'');}catch{throw Error('Native local inference endpoint is not qualified.');}}
function nativeEndpoint(p){
 if(p.endpoint)return p.endpoint;
 if(p.agentRuntime==='hermes'){
  const code='import json,pathlib,yaml; p=pathlib.Path("/sandbox/.hermes/config.yaml"); assert p.stat().st_size<1000000; m=yaml.safe_load(p.read_text())["model"]; print(json.dumps({"model":m.get("default"),"baseUrl":m.get("base_url")}))';
  const v=JSON.parse(cp.execFileSync('/opt/hermes/.venv/bin/python',['-c',code],{encoding:'utf8',timeout:10000,maxBuffer:100000}));if(v.model!==p.model)throw Error('Native model metadata changed.');return v.baseUrl;
 }
 const file='/sandbox/.openclaw/openclaw.json';if(fs.statSync(file).size>1000000)throw Error('Native model metadata is too large.');const v=JSON.parse(fs.readFileSync(file,'utf8')),primary=v.agents?.defaults?.model?.primary||'',at=primary.indexOf('/');if(primary.slice(at+1)!==p.model)throw Error('Native model metadata changed.');return v.models?.providers?.[primary.slice(0,at)]?.baseUrl;
}
function transport(p,env=process.env){
 if(p.provider==='nvidia-prod'){
  const reference=env.NVIDIA_INFERENCE_API_KEY||'';if(!scoped('NVIDIA_INFERENCE_API_KEY').test(reference))throw Error('A fresh supervisor-issued NVIDIA reference is required.');
  return{baseUrl:'https://integrate.api.nvidia.com/v1',apiKey:reference};
 }
 if(['vllm-local','ollama-local','llama-cpp-local','compatible-endpoint'].includes(p.provider)){
  const reference=env.NEMOCLAW_LOCAL_INFERENCE_TOKEN||'';if(!scoped('NEMOCLAW_LOCAL_INFERENCE_TOKEN').test(reference))throw Error('A fresh supervisor-issued local inference reference is required.');
  return{baseUrl:localEndpoint(nativeEndpoint(p)),apiKey:reference};
 }
 return managed();
}
transport.headers=t=>t.apiKey.startsWith('openshell:resolve:env:')?['-H','Authorization: Bearer '+t.apiKey]:[];
transport.catalog=(p,exec=cp.execFileSync)=>{const t=transport(p),raw=exec('curl',['--fail','--silent','--show-error','--max-time','10',...transport.headers(t),t.baseUrl+'/models'],{encoding:'utf8',timeout:12000,maxBuffer:1000000,stdio:['ignore','pipe','pipe']}),v=JSON.parse(raw);return{models:(v.data||[]).map(m=>m.id).filter(id=>typeof id==='string'&&/^[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}$/.test(id)).slice(0,2000)};};
module.exports=transport;
