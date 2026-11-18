import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {writeTrainingReplies,injectFault} from '../server/challenges/prompt-replies.mjs';import {trainingSources} from '../server/challenges/learning.mjs';import {detectFaults} from '../server/challenges/assessment.mjs';
const seed=()=>{const db=new DatabaseSync(':memory:');db.exec('CREATE TABLE challenge_learning_samples(id TEXT,attempt TEXT,ordinal INT,source TEXT,reply TEXT,truth TEXT,decision TEXT)');const ins=db.prepare('INSERT INTO challenge_learning_samples VALUES(?,?,?,?,?,?,NULL)');let n=0;for(const {reply,bad,...s} of trainingSources)for(const b of [false,true])ins.run('s'+n,'a',n++,JSON.stringify(s),b?bad:reply,JSON.stringify({bad:b,faults:[]}));return db;};
test('training replies come from the system prompt, decline twins carry a real fault',async()=>{
 const db=seed(),seen=[];const reply=async({systemPrompt,source})=>{seen.push(systemPrompt);return 'Ho ho ho, dear '+source.name+'! Thank you for your letter.';};
 assert.equal(await writeTrainingReplies(db,'a','Write as a jolly Santa.',{reply}),5);assert.ok(seen.every(p=>p==='Write as a jolly Santa.'));
 const rows=db.prepare('SELECT * FROM challenge_learning_samples ORDER BY ordinal').all();
 for(const r of rows){const t=JSON.parse(r.truth),s=JSON.parse(r.source);assert.equal(s.writtenBy,'model');assert.match(r.reply,/Ho ho ho/);assert.equal(t.bad,t.wantBad);assert.equal(t.faults.length>0,t.wantBad);}});
test('model failure falls back to the scripted reply for that letter',async()=>{
 const db=seed();assert.equal(await writeTrainingReplies(db,'a','p',{reply:async()=>{throw Error('down');}}),0);
 const r=db.prepare("SELECT * FROM challenge_learning_samples WHERE id='s0'").get();assert.equal(r.reply,trainingSources[0].reply);assert.equal(JSON.parse(r.source).writtenBy,'scripted');});
test('every injected fault is detectable',()=>{for(const s of trainingSources)assert.ok(detectFaults(s,injectFault(s,'Dear '+s.name+', merry Christmas.')).length,s.name);});
