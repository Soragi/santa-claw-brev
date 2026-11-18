import test from 'node:test';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';
import {readiness,localModelProbe} from '../server/readiness.mjs';import {profileDrift} from '../deploy/check-gb10.mjs';import {selectReleases,selectBackups} from '../deploy/prune-releases.mjs';
const db=()=>{const d=new DatabaseSync(':memory:');d.exec("CREATE TABLE missions(id TEXT,state TEXT);INSERT INTO missions VALUES('a','working'),('b','done')");return d;};
test('readiness reports each dependency and fails when the local model is down',async()=>{
 const up=await readiness({db:db(),network:{state:{ready:true,sandbox:'s'}},model:async()=>({model:'m'}),version:'x'});assert.equal(up.ok,true);assert.equal(up.activeJobs,1);assert.deepEqual(up.checks.map(c=>c.name),['database','localModel','openshell']);
 const down=await readiness({db:db(),network:{state:{ready:true}},model:async()=>{throw Error('connect ECONNREFUSED');}});assert.equal(down.ok,false);assert.match(down.checks[1].error,/ECONNREFUSED/);
 const gate=await readiness({db:db(),network:{state:{ready:false,message:'Connecting'}},model:async()=>({})});assert.equal(gate.checks[2].ok,false);});
test('local model probe requires the configured served model',async()=>{
 const fetchImpl=async()=>({ok:true,json:async()=>({data:[{id:'santa-qwen',max_model_len:32768}]})});
 assert.deepEqual(await localModelProbe({port:'8000',expected:'santa-qwen',fetchImpl}),{model:'santa-qwen',maxModelLength:32768});
 await assert.rejects(localModelProbe({port:'8000',expected:'other',fetchImpl}),/not found/);await assert.rejects(localModelProbe({port:'x',fetchImpl}),/Invalid/);});
test('profile drift warns about a different served context but accepts the reference',()=>{
 const reference={servedName:'santa-qwen',repository:'nvidia/Qwen',maxModelLength:32768};
 assert.deepEqual(profileDrift({id:'santa-qwen',max_model_len:32768},reference),[]);
 const drift=profileDrift({id:'other',max_model_len:262144},reference);assert.equal(drift.length,2);assert.match(drift[1],/262144/);assert.deepEqual(profileDrift(null,reference),[]);});
test('retention keeps the newest releases, the protected release and recent backups',()=>{
 const now=Date.now(),d=86400000,rel=[1,2,3,4,5].map(i=>({name:'r'+i,mtime:now-i*d}));
 assert.deepEqual(selectReleases(rel,{keep:3,protect:['r5']}).map(e=>e.name),['r4']);
 const bak=Array.from({length:14},(_,i)=>({name:'b'+i,mtime:now-i*2*d}));
 assert.deepEqual(selectBackups(bak,{keep:10,maxAgeDays:14,now}).map(e=>e.name),['b10','b11','b12','b13']);});

test('readiness accepts an explicitly verified authenticated native model fallback and propagates its failure',async()=>{const network={state:{ready:true}},up=await readiness({db:db(),network,model:async()=>{throw Error('HTTP 401')},nativeModel:async()=>({model:'local',via:'authenticated native local route'})});assert.equal(up.ok,true);assert.equal(up.checks[1].via,'authenticated native local route');const down=await readiness({db:db(),network,model:async()=>{throw Error('HTTP 401')},nativeModel:async()=>{throw Error('Route is not local')}});assert.equal(down.ok,false);});
