// Clear snow between Santa's chair (0, -8) and the sleigh (-17, -3).
export const containmentPosition={x:-8,y:0,z:-3};
export function activeGrinchProbe(state,now=Date.now()){const p=state?.probe;return p&&now-p.at<16000&&['attempting','blocked','unconfirmed','retrieving','retrieved'].includes(p.status)?p:null;}
export function grinchProbeEffect(probe){return({attempting:'attempted',blocked:'blocked',unconfirmed:'tool_error',retrieving:'retrieving',retrieved:'retrieved'})[probe?.status]||null;}
export function grinchProbeCaption(probe){return({attempting:'Grinch trying',blocked:'OpenShell blocked',unconfirmed:'Boundary unconfirmed',retrieving:'Retrieving inventory',retrieved:'Inventory retrieved'})[probe?.status]||'Check OpenShell';}
