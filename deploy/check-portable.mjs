#!/usr/bin/env node
import {runtimeName} from '../server/runtime-profile.mjs';
import {execFileSync} from 'node:child_process';
import {readSandboxRoute,assertLocalRoute} from '../server/inference-policy.mjs';
import {call} from '../server/private-runtime.mjs';
import {verifyVision} from './installer-verify.mjs';
const name=process.env.SANTA_SANDBOX;
if(!/^[a-z][a-z0-9-]{1,40}$/.test(name||''))throw Error('Select a sandbox.');
console.log('Checking native sandbox execution…');
const route=await readSandboxRoute();assertLocalRoute(route);
const native=execFileSync('nemoclaw',[name,'exec','--no-tty','--timeout','20','--','node','-e','console.log("SANTA_NATIVE_OK")'],{encoding:'utf8',timeout:30000});
if(!native.includes('SANTA_NATIVE_OK'))throw Error('Native sandbox execution failed.');
if(runtimeName()==='hermes'){console.log('Checking Hermes filesystem and SDK…');const check=await call({op:'check'},40);if(!check.passed)throw Error('Hermes sandbox/runtime checks failed.');console.log('Checking an actual Hermes agent response…');const probe=await call({op:'runtime-probe'},75);if(probe.text.trim()!=='SANTA_HERMES_READY')throw Error('Actual Hermes agent inference did not pass qualification.');}
console.log('Checking structured model tool calling…');
const result=await call({op:'mcp-infer',agent:'santa-postmaster',prompt:'Assess the reply. Letter: child Alex requests a book. Reply: Dear Alex, I have noted your request for a book. Choose approve.',requiredTool:'assess_reply',mcpTools:[{name:'assess_reply',description:'Assess source fidelity.',inputSchema:{type:'object',properties:{decision:{type:'string',enum:['approve','reject']}},required:['decision'],additionalProperties:false}}],observations:[]},75);
const decision=JSON.parse(result.text);
if(decision.name!=='assess_reply'||decision.arguments?.decision!=='approve')throw Error('Configured model failed the structured tool-call probe.');
console.log('Checking actual image inference…');await verifyVision();
console.log('Verified native execution, structured tool call and actual image inference. No challenge progress changed.');
