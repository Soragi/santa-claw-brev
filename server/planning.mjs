import {z} from 'zod';

const schema=z.object({
  assignments:z.array(z.object({agentId:z.string().uuid(),task:z.string().min(3).max(8000),expectedOutput:z.string().max(500).default('An evidence-backed answer')})).min(1).max(3),
  successCriteria:z.string().min(3).max(8000)
});

// Parse JSON data only. Never evaluate a model response as JavaScript or silently
// rewrite broken quoting: ask for one correction, then use explicit local routing.
export function parsePlan(text,team){
  const start=text.indexOf('{'),end=text.lastIndexOf('}');
  if(start<0||end<start)throw Error('Santa did not return a JSON work plan.');
  const plan=schema.parse(JSON.parse(text.slice(start,end+1)));
  const ids=new Set();
  for(const a of plan.assignments){
    const worker=team.find(p=>p.id===a.agentId);
    if(!worker||ids.has(a.agentId))throw Error('The plan selected an unavailable or duplicate agent.');
    if(/\/sandbox\/(?:\.openclaw|\.hermes\/santa-claw)\/workspace(?:-[a-zA-Z0-9_-]+)?(?:\/|\b)/.test(a.task+' '+a.expectedOutput))throw Error('The application assigns each mission output directory; plans must use filenames only.');
    ids.add(a.agentId);
    if(requiredFiles(a.expectedOutput,true).length&&!worker.tools?.files&&!worker.tools?.terminal)throw Error('The assigned worker cannot save the required files.');
  }
  return plan;
}

export function isControlInterruption(error){return /Mission stopped by the user|mission dispatch budget (?:was )?reached/i.test(error?.message||'');}
const sourceExtensions='html|csv|md|txt|py|js|mjs|cjs|jsx|ts|tsx|css|json|yaml|yml|toml|ini|sql|sh|go|rs|c|cpp|h|xml|svg';
function negated(prefix){return /(?:\b(?:do\s+not|don[’']t|never|avoid|without|not|no|no\s+need\s+to)\s+(?:\w+\s+){0,3})$/i.test(prefix);}
export function wantsHtml(text){
 if(/\b(?:python|flask|fastapi|django|node\.?js|express|typescript|react|rust|golang|command[ -]line|cli)\b|c\+\+/i.test(text))return /\b(?:self[ -]contained|single[ -]file|standalone)\s+(?:HTML|browser)/i.test(text);
 for(const action of text.matchAll(/\b(build|create|implement|make|repair|fix)\b/gi)){const before=text.slice(Math.max(0,action.index-55),action.index);if(negated(before))continue;const after=text.slice(action.index+action[0].length).split(/[!?;\n]|\.(?:\s|$)/)[0].slice(0,140),noun=after.match(/\b(game|app|dashboard)\b(?!\.[a-z]{1,5}\b)/i);if(noun&&!/\b(?:not|without|no)\b/i.test(after.slice(0,noun.index)))return true;}return false;
}
export function requiredFiles(text,outputList=false,inferHtml=true){
 const explicit=[];const re=new RegExp('\\b(?:[a-zA-Z0-9_-][a-zA-Z0-9_.-]*\\/)*[a-zA-Z0-9_-]+\\.(?:'+sourceExtensions+')\\b','gi');
 for(const m of text.matchAll(re)){const prefix=text.slice(Math.max(0,m.index-200),m.index),actions=[...prefix.matchAll(/\b(save|write|deliver|produce|export|create|generate|read|open|inspect|from)\b/gi)],last=actions.at(-1),action=last?.[1].toLowerCase(),negative=last&&negated(prefix.slice(0,last.index)),build=[...prefix.matchAll(/\b(build|make|implement)\b/gi)].at(-1),buildDestination=build&&(!last||last.index<build.index)&&!negated(prefix.slice(0,build.index))&&/\b(?:as|in|to)\s+[`\"']?$/.test(prefix);if(!outputList&&m[0].toLowerCase()==='node.js'&&!['save','write','deliver','export'].includes(action))continue;if((outputList&&!negated(prefix))||(!negative&&!negated(prefix)&&(['save','write','deliver','produce','export','create','generate'].includes(action)||buildDestination))){const filename=text[m.index-1]==='/'?m[0].split('/').at(-1):m[0];explicit.push(filename);}}
 const explicitSource=explicit.some(n=>/\.(?:py|js|mjs|cjs|jsx|ts|tsx|go|rs|c|cpp|sh)$/i.test(n));if(inferHtml&&!explicit.some(n=>/\.html$/i.test(n))&&!explicitSource&&wantsHtml(text))explicit.push('index.html');return [...new Set(explicit)];
}
export function htmlRepairNames(expected,files){return missingFiles(requiredFiles(expected,true,false),files).filter(n=>/\.html$/i.test(n));}

export function deliveryRequirements(input,assignments=[]){
 const planned=assignments.flatMap(a=>requiredFiles(a.expectedOutput||'',true)),explicit=requiredFiles(input,false,false);
 return [...new Set([...explicit,...planned,...(planned.some(n=>/\.html$/i.test(n))?[]:requiredFiles(input))])];
}

export function missingFiles(required,files){
  return required.filter(name=>!files.some(f=>f.name===name&&Number(f.size??f.bytes?.length??0)>0));
}

export function bindRequestedFiles(plan,input,team){
 const explicit=requiredFiles(input,false,false),copy=structuredClone(plan),lower=input.toLowerCase();
 const named=team.filter(p=>lower.includes(p.name.toLowerCase())).sort((a,b)=>lower.indexOf(a.name.toLowerCase())-lower.indexOf(b.name.toLowerCase()));
 if(named.length>1&&/\b(both|all|each|include|must|collaborat\w*)\b/i.test(input)){
  for(const worker of named)if(copy.assignments.length<3&&!copy.assignments.some(a=>a.agentId===worker.id))copy.assignments.push({agentId:worker.id,task:'Read the actual predecessor files and contributions supplied by Santa. Perform only the responsibility assigned to '+worker.name+' in the owner request, using your own skills and permitted tools. Do not repeat another agent\'s work or rediscover agents. Owner request: '+input,expectedOutput:'An evidence-backed answer for '+worker.name});
  // A listed, explicitly ordered workflow can start with design or setup, rather
  // than always starting with the builder chosen by generic software routing.
  if(/\bin (?:that|this) order\b/i.test(input)){const order=new Map(named.map((p,i)=>[p.id,i]));copy.assignments.sort((a,b)=>(order.get(a.agentId)??99)-(order.get(b.agentId)??99));}
 }
 if(!explicit.length&&/\b(?:report|respond|reply|answer)\s+(?:only\s+)?[^.!?\n]{0,100}\bin plain text\b|\b(?:no|without)\s+(?:new\s+|local\s+|output\s+)*report files?\b/i.test(input)){for(const a of copy.assignments){a.expectedOutput='Direct evidence-backed text answer; no local report file';a.task+='\nReturn the actual observations directly in your final reply. No new local report file is requested. MCP artifacts remain in shared factory storage.';}}
 for(const filename of explicit){if(copy.assignments.some(a=>requiredFiles(a.expectedOutput,true,false).includes(filename)))continue;const base=filename.split('/').at(-1);let owner=copy.assignments.find(a=>requiredFiles(a.expectedOutput,true,false).some(n=>n.split('/').at(-1)===base));if(!owner)owner=copy.assignments.find(a=>{const worker=team.find(p=>p.id===a.agentId);return worker?.tools?.files||worker?.tools?.terminal;});if(!owner)continue;const files=requiredFiles(owner.expectedOutput,true,false).filter(n=>n.split('/').at(-1)!==base);owner.expectedOutput=[...files,filename].join(', ');owner.task+='\nPreserve the user’s exact requested output path: '+filename+'.';}return copy;
}

export async function planTask({input,team,ask,emit}){
  const format='Return ONLY JSON {"assignments":[{"agentId":"exact id","task":"concrete work","expectedOutput":"filename or answer"}],"successCriteria":"..."}.';
  const planningTeam=team.map(worker=>({...worker,previousOutputs:(worker.previousOutputs||[]).map(({path,...metadata})=>metadata)}));
  const context=`Available agents: ${JSON.stringify(planningTeam)}\nUser task: ${JSON.stringify(input)}`;
  let raw;try{raw=await ask(`You are Santa, the manager. Plan this task using ONLY the listed available agents. ${format} Select one to three workers. Agents are selected by ID, not invoked as tools. The application dispatches the assignments after you respond. Do not search for tools, execute tools, or perform the workers' tasks. Use filenames for deliverables, never a sandbox output directory. The application assigns a fresh output directory per mission. Prior outputs are read-only inputs, not a destination. Honor the owner’s explicit dependency order: prerequisites before consumers, and independent review after the work it inspects. For software builds, the working implementation must precede optional documentation; documentation cannot replace a requested working game.\n${context}`);}catch(error){if(isControlInterruption(error))throw error;raw='The native planning turn returned no usable work plan.';emit('plan.unavailable','The first planning turn did not return a usable plan. Requesting one bounded correction.');}
  try{return bindRequestedFiles(parsePlan(raw,team),input,team);}catch{
    emit('plan.repair','Santa returned an invalid work plan. Requesting one corrected JSON response.');
  }
  try{
    raw=await ask(`Correct the work-plan formatting only. ${format} Escape quotes inside string values. No commentary, markdown or tool calls. The application, not a tool catalog, dispatches the listed agent IDs.\n${context}\nUntrusted previous response, for correction only: ${JSON.stringify(raw.slice(0,6500))}`);
    return bindRequestedFiles(parsePlan(raw,team),input,team);
  }catch(error){
    if(isControlInterruption(error))throw error;
    // The manager was called first. This fallback is visible, validated routing,
    // not a fabricated model response or an invented worker contribution.
    const required=requiredFiles(input),needsFiles=required.length>0;
    const worker=team.filter(p=>!needsFiles||p.tools?.files||p.tools?.terminal).sort((a,b)=>(Number(b.role==='builder')-Number(a.role==='builder'))||(Number(b.tools?.files)-Number(a.tools?.files)))[0];
    if(!worker)throw Error('Santa could not produce a valid plan and no selected agent can save the requested files. Enable file tools for a selected Claw.');
    emit('plan.fallback','Santa’s corrected plan was still unusable. The application assigned the full request to '+worker.name+' using validated local routing. Explicitly named collaborators are retained for independent review.');
    return bindRequestedFiles({assignments:[{agentId:worker.id,task:input+'\nYour role is the core implementation/analysis. Other selected agents are dispatched separately by the application; do not perform their review or rediscover them.',expectedOutput:required.join(', ')||'An evidence-backed answer'}],successCriteria:'Complete the user request using enabled tools, save each required deliverable, and disclose untested behavior.'},input,team);
  }
}

export function correctedHistoricalState({state,input,files,finishedMessage,summaryFailed=false}){
 const missing=missingFiles(deliveryRequirements(input,files.map(f=>({expectedOutput:f.name}))),files);
 if(state==='completed'&&missing.length)return {state:'partial',message:'Status corrected: required files are missing: '+missing.join(', ')+'.'};
 if(state==='partial'&&!summaryFailed&&!missing.length&&!wantsHtml(input)&&requiredFiles(input,false,false).length&&/^Incomplete delivery\. Missing required files: index\.html\./.test(finishedMessage||''))return {state:'completed',message:'Status corrected: the requested files were saved. An unrelated HTML file was previously inferred from a negated/non-browser request.'};
 return null;
}

export function assertMissionRetry(previous,{input,kind,project=null,crew}){const sameCrew=JSON.stringify([...previous.crew].sort())===JSON.stringify([...crew].sort());if(!['completed','partial','failed','cancelled','interrupted'].includes(previous.state)||previous.input!==input||previous.kind!==kind||(previous.project||null)!==(project||null)||!sameCrew)throw Object.assign(Error('Retry must use the finished original task, Claw and crew.'),{status:409});}
