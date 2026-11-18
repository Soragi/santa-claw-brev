import test from'node:test';import assert from'node:assert/strict';
import{readinessCache}from'../server/readiness.mjs';
test('concurrent readiness requests share one native check, cache briefly and refresh after expiry',async()=>{
 let time=0,calls=0,finish;const read=readinessCache(()=>{calls++;return new Promise(resolve=>finish=resolve);},{ttlMs:5000,now:()=>time});
 const requests=Array.from({length:25},()=>read());await Promise.resolve();assert.equal(calls,1);
 finish({ok:true,checkedAt:time});const results=await Promise.all(requests);assert.ok(results.every(v=>v===results[0]));
 time=4999;assert.equal((await read()).ok,true);assert.equal(calls,1);
 time=5000;const refresh=read();await Promise.resolve();assert.equal(calls,2);finish({ok:false});assert.equal((await refresh).ok,false);
 assert.equal((await read()).ok,false);assert.equal(calls,2);
});
test('a failed readiness probe releases its in-flight slot for a real retry',async()=>{
 let calls=0;const read=readinessCache(async()=>{if(++calls===1)throw Error('native unavailable');return{ok:true};});
 await assert.rejects(read(),/native unavailable/);assert.equal((await read()).ok,true);assert.equal(calls,2);
});
