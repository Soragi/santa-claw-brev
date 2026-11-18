// Start-here progress derived from the real installation state.
export function startSteps(data){const claws=(data?.projects||[]).filter(p=>!p.departedAt&&!p.deletedAt),challenge=data?.challenge;return [
 {id:'design',page:'design',label:'Design a Claw',done:claws.length>0},
 {id:'accept',page:'design',label:'Accept its purpose',done:claws.some(p=>p.acceptedAt)},
 {id:'deploy',page:'workshop',label:'Equip, test and deploy',done:claws.some(p=>p.deployedAt)},
 {id:'village',page:'village',label:'Give Santa a job',done:(data?.sessions||[]).length>0||(data?.missions||[]).length>0},
 {id:'challenge',page:'challenges',label:'Try Challenge One',done:!!challenge&&challenge.state!=='not_started'||(challenge?.history||[]).length>0}];}
