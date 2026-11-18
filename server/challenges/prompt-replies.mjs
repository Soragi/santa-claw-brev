// Training replies written by the local model from the attendee's own system prompt.
// Each letter gets one model reply; its "decline" twin is that same reply with one known fault added,
// so the attendee reviews their prompt's real output. Grading still comes from detectFaults on the final text.
import{detectFaults}from'./assessment.mjs';import{trainingSources}from'./learning.mjs';
const scripted=name=>trainingSources.find(s=>s.name===name);
const faultFor={Mia:'gift',Oliver:'gift',Leo:'name',Lina:'name',Noah:'promise'};
// Put the faulty sentence right after the first sentence, so it never trails the sign-off.
const insertSentence=(text,sentence)=>{const m=/[.!?](\s+)/.exec(text);return m?text.slice(0,m.index+1)+' '+sentence+text.slice(m.index+1):text+' '+sentence;};
export function injectFault(source,text){
 const kind=faultFor[source.name]||'promise';
 let out=text;
 if(kind==='gift')out=insertSentence(text,'I have noted your wish for a football.');
 else if(kind==='name'){const wrong=source.name==='Mia'?'Leo':'Mia',greeting=/\b(dear|hello|hi|hey)\s+[A-Za-z]+/i;out=greeting.test(text)?text.replace(greeting,(_,g)=>g+' '+wrong):'Dear '+wrong+', '+text;}
 else out=insertSentence(text,'I guarantee delivery of every present you want this Christmas.');
 return detectFaults(source,out).length?out:scripted(source.name).bad;
}
const clean=text=>String(text||'').replace(/<think>[\s\S]*?<\/think>/g,'').replace(/^[\s\S]*<\/think>/,'').trim().slice(0,1200);
export async function modelReply({systemPrompt,source,port=process.env.NEMOCLAW_VLLM_PORT||'8000',model,fetchImpl=fetch,timeoutMs=90000}){
 if(!/^\d+$/.test(String(port)))throw Error('Invalid local model port');
 const base='http://127.0.0.1:'+port+'/v1';
 if(!model){const r=await fetchImpl(base+'/models',{redirect:'error',signal:AbortSignal.timeout(3000)});model=(await r.json())?.data?.[0]?.id;if(!model)throw Error('No served model');}
 const response=await fetchImpl(base+'/chat/completions',{method:'POST',redirect:'error',headers:{'content-type':'application/json'},signal:AbortSignal.timeout(timeoutMs),body:JSON.stringify({model,max_tokens:220,temperature:.7,chat_template_kwargs:{enable_thinking:false},messages:[{role:'system',content:systemPrompt},{role:'user',content:'Write Santa\'s reply to this letter. Return only the reply text.\n\nFrom: '+source.name+'\nSubject: '+source.subject+'\n\n'+source.body}]})});
 if(!response.ok)throw Error('Local model HTTP '+response.status);
 const text=clean((await response.json())?.choices?.[0]?.message?.content);
 if(!text)throw Error('Local model returned an empty reply');
 return text;
}
// Rewrites the attempt's unreviewed training samples. Falls back to the scripted reply per letter if the model fails.
export async function writeTrainingReplies(db,attempt,systemPrompt,{reply=modelReply}={}){
 const rows=db.prepare('SELECT id,source,truth FROM challenge_learning_samples WHERE attempt=? AND decision IS NULL').all(attempt);
 const sources=new Map(rows.map(r=>{const s=JSON.parse(r.source);return [s.name,s];}));
 const written=new Map(await Promise.all([...sources.values()].map(async s=>{try{return [s.name,{text:await reply({systemPrompt,source:s}),by:'model'}];}catch(error){return [s.name,{text:null,by:'scripted',error:String(error?.message||error).slice(0,160)}];}})));
 const update=db.prepare('UPDATE challenge_learning_samples SET source=?,reply=?,truth=? WHERE id=?');
 for(const r of rows){const s=JSON.parse(r.source),wanted=JSON.parse(r.truth).wantBad??JSON.parse(r.truth).bad,w=written.get(s.name);
  const text=w.text?(wanted?injectFault(s,w.text):w.text):(wanted?scripted(s.name).bad:scripted(s.name).reply),faults=detectFaults(s,text);
  update.run(JSON.stringify({...s,writtenBy:w.by}),text,JSON.stringify({bad:faults.length>0,wantBad:wanted,faults}),r.id);}
 return [...written.values()].filter(w=>w.by==='model').length;
}
