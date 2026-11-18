import {execFile} from 'node:child_process';import {promisify} from 'node:util';const exec=promisify(execFile);
export const localOnly=()=>process.env.SANTA_ALLOW_CLOUD_INFERENCE!=='1';
export function isLocalRoute(route){
 const provider=String(route?.provider||'');let endpoint=null;
 if(route?.endpoint)try{endpoint=new URL(route.endpoint);}catch{return false;}
 const localHost=endpoint&&['127.0.0.1','localhost','[::1]','host.openshell.internal','host.docker.internal','inference.local'].includes(endpoint.hostname)&&['http:','https:'].includes(endpoint.protocol)&&!endpoint.username&&!endpoint.password&&!endpoint.search&&!endpoint.hash;
 const localProvider=['vllm-local','ollama-local','llama-cpp-local'].includes(provider);
 return !!((localProvider&&(!endpoint||localHost))||(provider==='compatible-endpoint'&&localHost));
}
export function assertLocalRoute(route){
 if(localOnly()&&!isLocalRoute(route))throw Object.assign(Error('Local-only mode requires a verified local NemoClaw route. Configure local vLLM/Ollama; cloud inference is disabled.'),{status:409});
 return route;
}
export async function readSandboxRoute(sandbox=process.env.SANTA_SANDBOX){
 if(!/^[a-z][a-z0-9-]{1,40}$/.test(sandbox||''))throw Object.assign(Error('Select the workshop’s NemoClaw sandbox with SANTA_SANDBOX.'),{status:409});
 const {stdout}=await exec('nemoclaw',['list','--json'],{timeout:20000,maxBuffer:1000000});let rows;try{rows=JSON.parse(stdout.slice(stdout.indexOf('{'))).sandboxes;}catch{throw Object.assign(Error('This NemoClaw installation lacks the supported JSON inventory. Run the host preflight and update the native runtime using NVIDIA’s guide.'),{status:503});}
 const row=rows?.find(r=>(r.name||r.sandboxName)===sandbox);if(!row)throw Object.assign(Error('The configured workshop sandbox is not registered.'),{status:409});
 return {provider:String(row.provider||''),model:String(row.model||''),endpoint:row.endpointUrl||row.nativeLocalProviderAttachment?.endpointUrl||null,sandbox};
}
export async function assertNativeLocalRoute(){if(!localOnly())return null;return assertLocalRoute(await readSandboxRoute());}
