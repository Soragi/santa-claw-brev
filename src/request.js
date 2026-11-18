let serial=0;
export const mutationVersion=()=>serial;
export const recordMutation=()=>++serial;
export async function requestJSON(url,method='GET',body,headers={}){
 const timeout=method==='GET'?15000:120000;let response;
 try{response=await fetch(url,{method,headers:{...(body!==undefined?{'Content-Type':'application/json'}:{}),...headers},body:body!==undefined?JSON.stringify(body):undefined,signal:AbortSignal.timeout(timeout),cache:'no-store'});}catch(error){throw Error(error.name==='TimeoutError'||error.name==='AbortError'?(method==='GET'?'The workshop took too long to respond. Check your connection.':'The request timed out. Check mission history before resubmitting; the workshop may have received it.'):'Cannot reach the workshop. Check your connection and retry.');}
 let value;try{value=await response.json();}catch{throw Error('The workshop returned an unreadable response. Refresh the workshop to reconnect.');}if(!response.ok)throw Object.assign(Error(value.error||'The request failed. Please retry.'),{status:response.status});if(!['GET','HEAD'].includes(method))recordMutation();return value;
}
export function clawBusy(missions,id){return missions.some(m=>['queued','planning','working','waiting_approval','reviewing','synthesizing','stopping'].includes(m.state)&&(m.project===id||m.crew.includes(id)));}
