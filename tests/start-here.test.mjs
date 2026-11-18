import test from 'node:test';import assert from 'node:assert/strict';import {startSteps} from '../src/start-here.mjs';
const next=data=>startSteps(data).find(s=>!s.done)?.id;
test('start-here progress follows the real workshop state',()=>{
 assert.equal(next({projects:[],challenge:{state:'not_started',history:[]}}),'design');
 assert.equal(next({projects:[{id:'a'}]}),'accept');
 assert.equal(next({projects:[{id:'a',acceptedAt:'t'}]}),'deploy');
 assert.equal(next({projects:[{id:'a',acceptedAt:'t',deployedAt:'t'}],sessions:[]}),'village');
 assert.equal(next({projects:[{id:'a',acceptedAt:'t',deployedAt:'t'}],sessions:[{id:1}],challenge:{state:'not_started',history:[]}}),'challenge');
 assert.equal(next({projects:[{id:'a',acceptedAt:'t',deployedAt:'t'}],sessions:[{id:1}],challenge:{state:'running',history:[]}}),undefined);
 assert.equal(next({projects:[{id:'a',departedAt:'t',acceptedAt:'t'}]}),'design');});
