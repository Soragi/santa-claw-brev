import test from'node:test';import assert from'node:assert/strict';import{createRequire}from'node:module';import{readFileSync}from'node:fs';import vm from'node:vm';
import{isNativeNvidiaRule,nativeNvidiaRule}from'../server/native-provider-policy.mjs';
const require=createRequire(import.meta.url),transport=require('../deploy/native-inference-transport.cjs');
const nvidia='openshell:resolve:env:v7_NVIDIA_INFERENCE_API_KEY',local='openshell:resolve:env:s'+'a'.repeat(64)+'_NEMOCLAW_LOCAL_INFERENCE_TOKEN';
test('native NVIDIA uses a fixed endpoint and only supervisor-issued opaque references',()=>{
 const route=transport({provider:'nvidia-prod',endpoint:'https://untrusted.example/v1'},{NVIDIA_INFERENCE_API_KEY:nvidia});assert.equal(route.baseUrl,'https://integrate.api.nvidia.com/v1');assert.equal(route.apiKey,nvidia);
 for(const value of ['', 'NOT_A_REAL_PROVIDER_KEY',nvidia+'\n',nvidia+' extra','openshell:resolve:env:NVIDIA_INFERENCE_API_KEY'])assert.throws(()=>transport({provider:'nvidia-prod'},{NVIDIA_INFERENCE_API_KEY:value}),/supervisor-issued/);
 assert.equal(transport({},{}).baseUrl,'https://inference.local/v1');
});
test('local native routing rejects control-plane URLs, public destinations and raw credentials',()=>{
 const env={NEMOCLAW_LOCAL_INFERENCE_TOKEN:local},p={provider:'vllm-local',endpoint:'http://host.openshell.internal:8000/v1'};assert.equal(transport(p,env).baseUrl,p.endpoint);
 for(const endpoint of ['http://127.0.0.1:4310/v1','http://169.254.169.254:8000/v1','https://untrusted.example/v1','http://user:password@host.openshell.internal:8000/v1','http://host.openshell.internal:8000/v1?key=private'])assert.throws(()=>transport({...p,endpoint},env),/not qualified/);
 assert.throws(()=>transport(p,{NEMOCLAW_LOCAL_INFERENCE_TOKEN:'RAW_LOCAL_TOKEN'}),/supervisor-issued/);
});
test('source, mail and vision inference use the selected native transport rather than cluster defaults',()=>{
 for(const [file,payload,reply]of[
  ['mcp-infer.cjs',{agent:'santa-postmaster',model:'nvidia/model',prompt:'Assess facts',requiredTool:'assess_reply',mcpTools:[{name:'assess_reply',description:'Check',inputSchema:{type:'object',properties:{}}}],observations:[]},{choices:[{message:{tool_calls:[{function:{name:'assess_reply',arguments:'{"decision":"approve"}'}}]}}]}],
  ['source-infer.cjs',{agent:'santa-drafter',model:'nvidia/model',prompt:'BOUNDED_BUILD_MARKUP'},{choices:[{finish_reason:'stop',message:{content:'<main>Gift</main>'}}]}],
  ['vision-infer.cjs',{model:'nvidia/model',request:{messages:[{role:'system',content:'Check crop'},{role:'user',content:[{type:'image_url',image_url:{url:'data:image/png;base64,AAAA'}}]}]}},{choices:[{message:{content:'{"color":"red"}'}}]}]
 ]){
  let used=false;const module={exports:{}};vm.runInNewContext(readFileSync(new URL('../deploy/'+file,import.meta.url),'utf8'),{module,require,nativeInferenceTransport:()=>({baseUrl:'https://integrate.api.nvidia.com/v1',apiKey:nvidia})});
  module.exports(payload,(_binary,args,options)=>{used=true;assert.equal(args.at(-1),'https://integrate.api.nvidia.com/v1/chat/completions');assert.ok(args.includes('Authorization: Bearer '+nvidia));assert.equal(JSON.parse(options.input).model,payload.model);return JSON.stringify(reply);});assert.ok(used);
 }
});
test('GB10 qualification requires a real structured MCP call through the selected provider',async()=>{
 const {checkWorkshopToolCall}=await import('../deploy/check-gb10.mjs');
 const module={exports:{}};
 vm.runInNewContext(readFileSync(new URL('../deploy/mcp-infer.cjs',import.meta.url),'utf8'),{module,require,nativeInferenceTransport:()=>({baseUrl:'http://host.openshell.internal:8000/v1',apiKey:local})});
 const callFor=message=>async(payload)=>module.exports({...payload,model:'nvidia/model'},(_binary,args,options)=>{
  assert.equal(args.at(-1),'http://host.openshell.internal:8000/v1/chat/completions');
  assert.ok(args.includes('Authorization: Bearer '+local));
  assert.equal(JSON.parse(options.input).tool_choice,'auto');
  return JSON.stringify({choices:[{message}]});
 });
 await checkWorkshopToolCall(callFor({tool_calls:[{function:{name:'assess_reply',arguments:'{"decision":"approve"}'}}]}));
 await assert.rejects(checkWorkshopToolCall(callFor({content:'{"decision":"approve"}'})),/no structured tool call/);
 await assert.rejects(checkWorkshopToolCall(callFor({tool_calls:[{function:{name:'assess_reply',arguments:'{"decision":"reject"}'}}]})),/incorrect arguments/);
});
test('only the exact credential-bound NVIDIA model policy survives as native inference',()=>{
 const rule=structuredClone(nativeNvidiaRule);Object.assign(rule.endpoints[0],{ports:[443],graphqlMaxBodyBytes:0,jsonRpcMaxBodyBytes:0,tls:'',allowEncodedSlash:false});
 assert.ok(isNativeNvidiaRule('native_nvidia_inference',rule));assert.ok(isNativeNvidiaRule('_provider_nemoclaw_nvidia_prod_v1',rule));assert.equal(isNativeNvidiaRule('random',rule),false);
 for(const edit of[r=>r.endpoints[0].rules.push({allow:{method:'GET',path:'/**'}}),r=>r.endpoints[0].host='untrusted.example',r=>r.endpoints[0].providerCredentialed=false,r=>r.binaries.push({path:'/bin/sh'}),r=>r.endpoints[0].requestBodyCredentialRewrite=true]){const unsafe=structuredClone(rule);edit(unsafe);assert.equal(isNativeNvidiaRule('native_nvidia_inference',unsafe),false);}
});
