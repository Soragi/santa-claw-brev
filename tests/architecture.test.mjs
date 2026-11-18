import test from 'node:test';
import assert from 'node:assert/strict';
import {architecture,architectureSvg} from '../server/architecture.mjs';
const entry=(id,extra={})=>({project:{id,deployedAt:'2026-11-01',spec:{name:'Claw '+id,role:'analyst',tools:{files:true,terminal:false,web:true},skills:['researcher'],customSkills:[{name:'Gift checker',instructions:'PRIVATE INSTRUCTIONS'}],knowledge:'PRIVATE KNOWLEDGE',goal:'PRIVATE PURPOSE'},...extra},postOffice:{scopes:['read_inbox','save_draft']},retail:{scopes:['get_order']}});
test('diagram reflects active deployed agents, saved skills and exact configured tools',()=>{
 const data=architecture([entry('one'),entry('draft',{deployedAt:null}),entry('gone',{departedAt:'2026-11-02'})]);
 assert.equal(data.agents.length,1);assert.equal(data.agents[0].reportsTo,'santa');
 assert.deepEqual(data.agents[0].tools,['read','write','edit','web_fetch']);
 assert.deepEqual(data.agents[0].skills,['Research & briefing','Gift checker']);
 assert.deepEqual(data.agents[0].integrations.map(i=>i.scopes),[['read_inbox','save_draft'],['get_order']]);
 assert.equal(data.reviewer.name,'Snow Inspector');
 assert.doesNotMatch(JSON.stringify(data),/PRIVATE/);
});
test('SVG escapes user-authored labels and remains self-contained',()=>{
 const e=entry('one');e.project.spec.name='<script>alert("x")</script>';
 const svg=architectureSvg(architecture([e]));
 assert.doesNotMatch(svg,/<script|https?:\/\/[^w]|foreignObject|<image/);
 assert.match(svg,/&lt;script&gt;/);assert.match(svg,/OpenShell/);
});
test('empty, large and long-label teams generate finite canvases without dropping agents',()=>{
 assert.match(architectureSvg(architecture()),/No deployed Claws yet/);
 const es=Array.from({length:16},(_,i)=>{const e=entry(String(i));e.project.spec.customSkills=Array.from({length:6},(_,j)=>({name:`Custom skill ${j} with a longer name`}));return e;});
 const data=architecture(es),svg=architectureSvg(data);
 assert.equal(data.agents.length,16);assert.match(svg,/Claw 15/);assert.doesNotMatch(svg,/NaN|undefined/);
 assert.ok(Number(svg.match(/height="(\d+)"/)[1])>1000);
});
