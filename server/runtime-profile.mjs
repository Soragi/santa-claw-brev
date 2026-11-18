export function runtimeName(value=process.env.SANTA_AGENT_RUNTIME||'openclaw'){if(!['openclaw','hermes'].includes(value))throw Error('Choose openclaw or hermes.');return value;}
export const runtimeRoot=()=>runtimeName()==='hermes'?'/sandbox/.hermes/santa-claw':'/sandbox/.openclaw';
export const workspacePrefix=()=>runtimeRoot()+'/workspace-';
export const runtimeConfig=()=>runtimeRoot()+'/'+(runtimeName()==='hermes'?'team.json':'openclaw.json');
export const retailRoot=()=>runtimeName()==='hermes'?runtimeRoot()+'/retail':'/sandbox/.santa-retail';
export function nativeAccess(sandbox,runtime=runtimeName()){
 runtimeName(runtime);
 if(!/^[a-z][a-z0-9-]{1,40}$/.test(sandbox||''))throw Error('Select a valid native sandbox.');
 const label=runtime==='hermes'?'Hermes':'OpenClaw';
 return {runtime,label,canImport:runtime==='openclaw',commands:['nemoclaw '+sandbox+' dashboard-url','nemoclaw '+sandbox+' connect'],message:'Run dashboard-url in your private instance terminal to discover the allocated '+label+' dashboard port and authentication link. Keep authentication links out of chats and exports.'+(runtime==='hermes'?' Santa Claw manages the workshop workers; their sessions are separate from the default Hermes dashboard. Build and deploy sprint Claws through Santa Claw.':' Use the new Claws created for this sprint; their MCP connectors work from native chats too.')};
}

export const factoryRoot=()=>runtimeName()==='hermes'?runtimeRoot()+'/factory':'/sandbox/.santa-factory';
