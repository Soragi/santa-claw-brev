const aliases={santa:['Santa','Santa · Manager','santa-manager'], 'snow-inspector':['Snow Inspector','Snow Inspector · Reviewer','santa-reviewer']};
export function networkForActor(network,id,missions=[],now=Date.now()){
 if(!network)return null;
 const belongs=e=>e.project===id||!e.project&&aliases[id]?.includes(e.agent);
 const waiting=network.requests?.find(r=>belongs(r)&&['queued','pending'].includes(r.status));
 if(waiting)return {status:'blocked',url:waiting.url,host:waiting.host,path:waiting.path,pending:true};
 const approved=network.requests?.find(r=>belongs(r)&&r.status==='approved'&&missions.some(m=>m.id===r.mission&&['planning','working','reviewing','synthesizing','waiting_approval'].includes(m.state)));
 if(approved)return {status:'approved',url:approved.url,host:approved.host,path:approved.path};
 const events=(network.events||[]).filter(e=>belongs(e)&&now-e.at<20000&&['attempted','blocked','allowed','retrieved','approved','rejected','upstream_error','tool_error'].includes(e.decision)&&(e.decision!=='allowed'||e.details?.layer==='http')).sort((a,b)=>b.at-a.at);
 const event=events.find(e=>e.decision!=='tool_error'||!events.some(b=>b.decision==='blocked'&&b.mission===e.mission&&b.host===e.host))||events[0];
 if(!event)return null;return {status:event.decision==='allowed'?'retrieving':event.decision,host:event.host,path:event.path,url:event.host+(event.path||''),at:event.at};
}
