import{reviewedRuleFingerprint}from'./network-policy.mjs';
// Contract: NVIDIA/NemoClaw f00fb1d, nemoclaw-nvidia-inference-v1.
// Preserve only credential-bound model APIs; this is not a general web grant.
export const nativeNvidiaRule={endpoints:[{host:'integrate.api.nvidia.com',port:443,protocol:'rest',enforcement:'enforce',providerCredentialed:true,rules:[{allow:{method:'GET',path:'/v1/models'}},{allow:{method:'POST',path:'/v1/chat/completions'}}]}],binaries:['/usr/local/bin/node','/usr/bin/node','/opt/hermes/.venv/bin/python','/opt/hermes/.venv/bin/python3','/opt/venv/bin/python3','/usr/local/bin/curl','/usr/bin/curl'].map(path=>({path}))};
export function isNativeNvidiaRule(key,rule){
 if(!['native_nvidia_inference','_provider_nemoclaw_nvidia_prod_v1'].includes(key)||rule?.endpoints?.length!==1)return false;
 const r=structuredClone(rule),e=r.endpoints[0];if(e.ports?.length&&JSON.stringify(e.ports)!=='[443]')return false;delete e.ports;
 for(const field of ['graphqlMaxBodyBytes','jsonRpcMaxBodyBytes'])if(e[field]===0)delete e[field];
 return reviewedRuleFingerprint(r)===reviewedRuleFingerprint(nativeNvidiaRule);
}
