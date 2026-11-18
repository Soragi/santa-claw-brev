import{missingFiles,requiredFiles}from'./planning.mjs';
const canonical=host=>host.toLowerCase().replace(/^www\./,'');
// A finished native reply plus actual requested files and fresh successful HTTP
// receipts can finish the task without replaying the worker after an approval.
// This does not grant access, fabricate retrieval, or recover a failed turn.
export function completedNetworkAnswer({input,reply,required,files,retrievals}){
 if(!reply?.text?.trim()||missingFiles(required,files).length)return false;
 const retrieved=new Set(retrievals.filter(r=>r.httpStatus>=200&&r.httpStatus<300).map(r=>canonical(r.host)));
 if(!retrieved.size)return false;
 const fileNames=new Set(requiredFiles(input,false,false).flatMap(n=>[n.toLowerCase(),n.split('/').at(-1).toLowerCase()]));
 const urlPattern=/https?:\/\/[^\s<>"'`]+/gi,hosts=[];
 for(const match of input.matchAll(urlPattern))try{hosts.push(new URL(match[0]).hostname);}catch{return false;}
 const bare=input.replace(urlPattern,' ');
 for(const match of bare.matchAll(/(?<![a-z0-9_/.-])(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,63}/gi))if(!fileNames.has(match[0].toLowerCase()))hosts.push(match[0]);
 return hosts.every(host=>retrieved.has(canonical(host)));
}
