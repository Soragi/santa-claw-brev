// All village mail counts and flights follow server receipts, never predicted sends.
export function villageMailStatus(data){
 if(!data?.staged||data.state==='not_started')return null;
 const f=data.flow||{},l=data.learning||{},phase=l.deployment?.phase;
 return {completed:data.state==='completed',sent:f.delivered||0,total:f.replyable||0,remaining:f.remaining||0,title:data.state==='completed'?'Challenge 1 completed':f.arrivalsStopped?phase==='calibrating'?'Verifying your agent':'Sending letters away':f.trainingStarted?'Training at North Pole Post':'Prepare your Post Office agent',detail:data.state==='completed'?'All replyable letters sent · inbox closed':f.arrivalsStopped?(f.delivered||0)+' / '+(f.replyable||0)+' sent · incoming mail closed':f.trainingStarted?(f.trainingArrived||0)+' / 10 training letters · '+(l.reviewed||0)+' reviewed':'Configure → MCP quiz → incoming letters'};
}
export function createDeliveryFlights(){
 let attempt=null;const seen=new Set(),flights=[];
 return {update(data,time){
  if(attempt!==data?.attempt){attempt=data?.attempt;seen.clear();flights.length=0;for(const r of data?.receipts||[])if(Date.now()-r.created>10000)seen.add(r.id);}
  for(const receipt of [...(data?.receipts||[])].reverse())if(!seen.has(receipt.id)){seen.add(receipt.id);if(flights.length<24)flights.push({id:receipt.id,start:time+Math.min(3,flights.filter(f=>f.start>=time).length*.35)});}
  for(let i=flights.length-1;i>=0;i--)if(time-flights[i].start>=5)flights.splice(i,1);
  return flights.filter(f=>time>=f.start).slice(0,12).map(f=>({id:f.id,progress:(time-f.start)/5}));
 }};
}
