#!/usr/bin/env node
import os from 'node:os';import {readFile} from 'node:fs/promises';import {execFile} from 'node:child_process';import {promisify} from 'node:util';import {fileURLToPath} from 'node:url';import path from 'node:path';
const exec=promisify(execFile),root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),profile=JSON.parse(await readFile(path.join(root,'config/gb10.json'),'utf8'));
export function versionAtLeast(actual,minimum){const a=String(actual).match(/\d+\.\d+\.\d+/)?.[0].split('.').map(Number),b=minimum.split('.').map(Number);if(!a)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return true;}
export function hostChecks(snapshot){return [
 {name:'Linux ARM64',passed:snapshot.platform==='linux'&&snapshot.arch==='arm64',detail:snapshot.platform+' / '+snapshot.arch},
 {name:'NVIDIA GB10',passed:/\bGB10\b/.test(snapshot.gpu)&&/12\.1/.test(snapshot.gpu),detail:snapshot.gpu||'No GB10 found'},
 {name:'Node.js 22.19+',passed:versionAtLeast(snapshot.node,'22.19.0'),detail:snapshot.node},
 {name:'Docker access',passed:snapshot.docker===true,detail:snapshot.docker?'Available':'Install/configure Docker using the NVIDIA Spark prerequisites'}];}
export function profileDrift(model,reference=profile.model){if(!model)return [];const out=[];if(![reference.servedName,reference.repository].includes(model.id))out.push('Served model '+model.id+' differs from the reference profile ('+reference.servedName+'). Validate tool calling and output budgets for it.');const length=model.max_model_len;if(length&&length!==reference.maxModelLength)out.push('Served context '+length+' differs from the reference '+reference.maxModelLength+'. Larger contexts reduce KV-cache headroom; re-check memory and the documented budgets.');return out;}
async function capture(command,args,timeout=15000){try{return (await exec(command,args,{timeout,maxBuffer:1000000})).stdout.trim();}catch{return null;}}
async function request(url,body){const response=await fetch(url,{method:body?'POST':'GET',headers:body?{'Content-Type':'application/json'}:{},body:body?JSON.stringify(body):undefined,redirect:'error',signal:AbortSignal.timeout(body?60000:5000)});if(!response.ok)throw Error('HTTP '+response.status);const chunks=[];let n=0;for await(const part of response.body){n+=part.length;if(n>1000000)throw Error('Response too large');chunks.push(part);}return JSON.parse(Buffer.concat(chunks).toString('utf8'));}
export async function checkWorkshopToolCall(nativeCall){
 const result=await nativeCall({
  op:'mcp-infer',agent:'santa-postmaster',requiredTool:'assess_reply',requireStructured:true,observations:[],
  prompt:'Use assess_reply with decision approve. The letter asks for a book for Alex, and the reply confirms the same gift and recipient.',
  mcpTools:[{name:'assess_reply',description:'Assess whether a reply matches the source letter.',inputSchema:{type:'object',properties:{decision:{type:'string',enum:['approve','reject']}},required:['decision'],additionalProperties:false}}]
 },65);
 const reply=JSON.parse(result.text);
 if(reply.name!=='assess_reply'||reply.arguments?.decision!=='approve')throw Error('The structured tool call was missing or had incorrect arguments.');
}
export async function checkGb10({stage='runtime',smoke=false}={}){
 const snapshot={platform:os.platform(),arch:os.arch(),node:process.versions.node,gpu:await capture('nvidia-smi',['--query-gpu=name,compute_cap','--format=csv,noheader']),docker:!!await capture('docker',['info','--format','{{.Architecture}}'])},checks=hostChecks(snapshot);snapshot.totalMemoryGiB=Math.round(os.totalmem()/2**30);const warnings=[];if(snapshot.totalMemoryGiB<100)warnings.push('Smaller-memory Spark: choose a qualified serving profile and validate memory headroom; this reference targets 128 GB-class hardware and does not guarantee model fit.');
 let inventory=null,route=null,model=null;
 if(stage!=='host'){
 const cli=await capture('nemoclaw',['--version']);checks.push({name:'NemoClaw 0.0.137+ native CLI',passed:versionAtLeast(cli,'0.0.137'),detail:cli&&versionAtLeast(cli,'0.0.137')?cli:'Older/missing CLI. Requires JSON inventory, sandbox exec and inference set. Do not replace a shared runtime during active work.'});
 const openshell=await capture('openshell',['--version']);checks.push({name:'OpenShell 0.0.116+',passed:versionAtLeast(openshell,'0.0.116'),detail:openshell||'Missing'});
 const listed=await capture('nemoclaw',['list','--json']);try{inventory=JSON.parse(listed.slice(listed.indexOf('{'))).sandboxes;}catch{}checks.push({name:'Native JSON inventory',passed:Array.isArray(inventory),detail:Array.isArray(inventory)?'Supported':'Legacy CLI output is unsupported'});
 if(stage==='runtime')route=inventory?.find(r=>(r.name||r.sandboxName)===process.env.SANTA_SANDBOX);
 const backend=route?.provider==='ollama-local'?'ollama':'vllm',port=backend==='ollama'?(process.env.NEMOCLAW_OLLAMA_PORT||'11434'):(process.env.NEMOCLAW_VLLM_PORT||String(profile.model.port));if(!/^\d+$/.test(port)||Number(port)<1024||Number(port)>65535)throw Error('Invalid operator vLLM port');
 const {isLocalRoute}=await import('../server/inference-policy.mjs');const nativeProbe=!!route&&/^[a-z][a-z0-9-]{1,40}$/.test(process.env.SANTA_SANDBOX||'')&&isLocalRoute({provider:route.provider,endpoint:route.endpointUrl||route.nativeLocalProviderAttachment?.endpointUrl||null})&&versionAtLeast(cli,'0.0.137')&&versionAtLeast(openshell,'0.0.116');
 // Use the workshop's native transport so the sandbox-scoped provider and its
 // supervisor-issued reference are resolved exactly as in a real challenge.
 const nativeCall=nativeProbe?(await import('../server/private-runtime.mjs')).call:null;
 const expected=(stage==='runtime'?route?.model:null)||process.env.SANTA_LOCAL_MODEL;const choose=catalog=>{const candidates=Array.isArray(catalog?.data)?catalog.data:[];return expected?candidates.find(m=>m.id===expected):candidates.find(m=>m.id===profile.model.servedName||m.id===profile.model.repository||m.root===profile.model.repository);};
 try{model=choose(await request('http://127.0.0.1:'+port+'/v1/models'));}catch{}
 if(!model&&nativeCall)try{const {models}=await nativeCall({op:'model-catalog'},25);model=choose({data:models.map(id=>({id}))});}catch{}
 warnings.push(...profileDrift(model));checks.push({name:'Local '+backend+' model',passed:!!model,detail:model?.id||'No matching local catalog. Configure the host model or repair its native authenticated local route.'});
 if(stage==='runtime'){
 const name=process.env.SANTA_SANDBOX;route=inventory?.find(r=>(r.name||r.sandboxName)===name);let valid=false;if(route){const {isLocalRoute}=await import('../server/inference-policy.mjs');try{if(!isLocalRoute({provider:route.provider,endpoint:route.endpointUrl||route.nativeLocalProviderAttachment?.endpointUrl||null}))throw Error('Not local');valid=['vllm-local','ollama-local','llama-cpp-local','compatible-endpoint'].includes(route.provider);if(model&&route.model!==model.id)valid=false;}catch{}}
 checks.push({name:'Selected sandbox local route',passed:valid,detail:valid?'Registered local provider/model match':'Set SANTA_SANDBOX to a local sandbox and verify its route/model; cloud and unverified routes are not a GB10 qualification.'});
 }
 if(smoke&&model&&hostChecks(snapshot).every(c=>c.passed))try{
  if(nativeCall)await checkWorkshopToolCall(nativeCall);
  else{
   if(stage==='runtime')throw Error('No verified sandbox route');
   const result=await request('http://127.0.0.1:'+port+'/v1/chat/completions',{model:model.id,messages:[{role:'user',content:'Call santa_status_probe once. Do not answer in prose.'}],tools:[{type:'function',function:{name:'santa_status_probe',description:'Check readiness',parameters:{type:'object',properties:{},additionalProperties:false}}}],tool_choice:'auto',max_tokens:256,temperature:0,chat_template_kwargs:{enable_thinking:false}});
   const call=result.choices?.[0]?.message?.tool_calls?.find(c=>c.function?.name==='santa_status_probe');
   if(!call)throw Error('No structured tool call');
   JSON.parse(call.function.arguments);
  }
  checks.push({name:'Live local structured tool call',passed:true,detail:(nativeCall?'The selected OpenShell local inference route':'The host local model')+' returned a structured function call.'});
 }catch{checks.push({name:'Live local structured tool call',passed:false,detail:'The model could not return the expected function through the selected inference route. Check native model access and the serving tool parser.'});}
 }
 return {target:profile.target,stage,passed:checks.every(c=>c.passed),snapshot,model:model?{id:model.id,maxModelLength:model.max_model_len||null}:null,checks,warnings,scope:'Read-only host/native/model probes; no package installation, weight download, sandbox mutation or certification of the full agent workflow.'};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const at=process.argv.indexOf('--stage'),stage=at>=0?process.argv[at+1]:'runtime';if(!['host','server','runtime'].includes(stage))throw Error('Use --stage host, server or runtime');try{const report=await checkGb10({stage,smoke:process.argv.includes('--smoke')});console.log(JSON.stringify(report,null,2));if(!report.passed)process.exitCode=1;}catch(error){console.error(error.message);process.exitCode=1;}}
