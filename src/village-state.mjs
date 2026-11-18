const active=new Set(['planning','working','reviewing','synthesizing','waiting_approval','stopping']);
const managerNames=new Set(['Santa','Santa · Manager','santa-manager']);
export function villageActivity(projects=[],missions=[]){
 const mission=missions.find(m=>active.has(m.state));
 const actors=projects.map(p=>({id:p.id,name:p.spec.name,role:p.spec.role,avatar:p.spec.avatar,mine:true,state:'deployed',atDesk:false,detail:'Ready for Santa’s next assignment'}));
 const links=[],events=mission?.events||[],byName=new Map(actors.map(a=>[a.name,a]));
 const resolve=name=>managerNames.has(name)?'santa':name==='Snow Inspector'||name==='Snow Inspector · Reviewer'?'snow-inspector':(byName.get(name)||byName.get(name?.replace(/ · (?:code drafter|MCP)$/,'')))?.id;
 const assigned=new Set(),completed=new Set(),failed=new Set(),saved=new Set();let current=null,reviewer=false;
 for(const e of events){
  const from=resolve(e.agent),to=resolve(e.target);
  if(e.type==='task.assigned'&&to&&to!=='santa'){assigned.add(to);if(to==='snow-inspector')reviewer=true;}
  if(e.type==='file.saved'&&from)saved.add(from);
  if(e.type==='mcp.tool'&&from)current=from;
  if(e.type==='agent.started'){current=from||null;if(from==='snow-inspector')reviewer=true;}
  if(e.type==='agent.failed'&&from)failed.add(from);
  if(['agent.completed','agent.failed'].includes(e.type)){if(from&&!/(?: · code drafter| · MCP)$/.test(e.agent))completed.add(from);if(current===from)current=null;}
  if(e.type==='files.handoff'&&to&&to!=='santa')for(const id of saved)if(id!==to&&!links.some(l=>l.from===id&&l.to===to))links.push({from:id,to,kind:'files',label:'Saved files handed over'});
 }
 if(mission?.state==='waiting_approval'){const waiting=[...events].reverse().find(e=>e.type==='network.waiting');if(waiting)current=resolve(waiting.agent)||current;}
 if(reviewer||projects.length)actors.push({id:'snow-inspector',name:'Snow Inspector',avatar:{body:'robot',color:'#e8eef4',accent:'#d4ad60',hat:'santa',outfit:'jacket',accessory:'glasses'},role:'reviewer',mine:false,state:'deployed',atDesk:true,detail:'Independent review desk'});
 for(const a of actors){a.atDesk=assigned.has(a.id)||a.id==='snow-inspector';if(a.id===current&&mission?.kind==='chat'&&!assigned.has(a.id)){a.state='talking';a.detail='Replying in a direct chat with you';}else if(a.id===current){a.state=mission?.state==='waiting_approval'?'waiting_approval':'working';a.detail=mission?.state==='waiting_approval'?'At desk · waiting for OpenShell approval':a.id==='snow-inspector'?'Checking the actual saved work':[...events].reverse().find(e=>e.agent===a.name&&e.type.startsWith('build.'))?.message||'Working at the Christmas desk';}else if(a.atDesk){a.state=failed.has(a.id)?'failed':completed.has(a.id)?'returned':'assigned';a.detail=failed.has(a.id)?'Turn stopped · Santa is reviewing saved work':completed.has(a.id)?'Contribution returned to Santa':'Assignment received · heading to desk';}}
 for(const id of assigned)links.push({from:'santa',to:id,kind:'assignment',label:failed.has(id)?'Partial contribution':completed.has(id)?'Assignment delivered':'Santa’s assignment',active:id===current});
 if(current==='santa'&&mission?.state==='synthesizing'){const returned=[...events].reverse().find(e=>e.type==='handoff'&&resolve(e.target)==='santa'&&resolve(e.agent)&&resolve(e.agent)!=='santa');if(returned)links.push({from:resolve(returned.agent),to:'santa',kind:'return',label:'Findings returned to Santa',active:true});}
 for(const l of links)if(l.kind==='files')l.active=l.to===current;
 const santa={id:'santa',name:'Santa · Manager',role:'orchestrator',mine:true,state:current==='santa'?'working':mission?'coordinating':'deployed',atDesk:true,detail:mission?({planning:'Planning the team’s assignments',reviewing:'Overseeing independent review',synthesizing:'Preparing the team’s final answer',waiting_approval:'Waiting for your OpenShell decision',stopping:'Bringing the team to a stop'}[mission.state]||'Orchestrating from Santa’s chair'):'Orchestrator · ready in Santa’s chair'};
 const names=new Map([[santa.id,'Santa'],...actors.map(a=>[a.id,a.name])]);
 return {actors:[santa,...actors],links:links.map(l=>({...l,fromName:names.get(l.from),toName:names.get(l.to)})),mission:mission?{id:mission.id,state:mission.state,input:mission.input}:null,currentName:names.get(current)||null,summary:mission?(current==='santa'?'Santa is coordinating the team.':current?names.get(current)+' is working with Santa.':mission.state==='waiting_approval'?'The team is waiting for your OpenShell decision.':'Santa is preparing the next handoff.'):'Santa is ready. Give him a task to bring the village to work.'};
}
export function deskLayout(ids){return ids.map((id,i)=>{const row=Math.floor(i/4),count=Math.min(4,ids.length-row*4);return {id,x:(i%4-(count-1)/2)*7,z:2+row*7,homeX:(i%4-(count-1)/2)*7,homeZ:5.1+row*7};});}

// Prefer the running job over newer queued requests; keep its drawer accessible after completion.
export function currentJobActivity(missions=[]){
 const mission=missions.find(m=>active.has(m.state))||[...missions].reverse().find(m=>m.state==='queued')||missions[0];
 if(!mission)return null;
 const live=active.has(mission.state)||mission.state==='queued';let speaker=null;
 for(const e of mission.events||[]){if(e.type==='agent.started')speaker=e.agent;if(['agent.completed','agent.failed'].includes(e.type)&&speaker===e.agent)speaker=null;if(e.type==='network.waiting')speaker=e.agent;}
 const fallback=mission.state==='reviewing'?'Snow Inspector':'Santa';
 const name=(speaker||fallback).replace(/ · (?:Manager|Reviewer|code drafter|MCP)$/,'');
 const label=!live?'Last job':mission.state==='queued'?'Queued':mission.state==='waiting_approval'?'Needs approval':mission.state==='stopping'?'Stopping':mission.state==='planning'?'Planning':mission.state==='reviewing'?'Reviewing':mission.state==='synthesizing'?'Replying':mission.kind==='chat'&&!(mission.events||[]).some(e=>e.type==='task.assigned')?'Talking':'Working';
 return {id:mission.id,name,label,live,input:mission.input||''};
}

export function visibleVillageProjects(projects=[],missions=[],network={},now=Date.now()){
 return projects.filter(p=>!p.hidden&&!p.departedAt&&(p.stage==='village'||missions.some(m=>active.has(m.state)&&m.crew?.includes(p.id))||(network.events||[]).some(e=>e.project===p.id&&now-e.at<20000)));
}
