#!/usr/bin/env node
// Portable stdio bridge. Supply a fresh, scoped workshop connection; never bundle it in exports.
import readline from 'node:readline';
if(!process.env.SANTA_POST_OFFICE_URL)throw Error('Configure your destination MCP server URL in SANTA_POST_OFFICE_URL.');
const endpoint=new URL(process.env.SANTA_POST_OFFICE_URL);
if(endpoint.username||endpoint.password||!((endpoint.protocol==='http:'&&['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))||endpoint.protocol==='https:'))throw Error('Use a local forwarded endpoint or HTTPS.');
const capability=process.env.SANTA_POST_OFFICE_CAPABILITY;if(!capability)throw Error('Supply this attempt’s scoped Post Office capability through the environment.');
const input=readline.createInterface({input:process.stdin,crlfDelay:Infinity});let queue=Promise.resolve();
input.on('line',line=>{queue=queue.then(async()=>{let request;try{if(line.length>32000)throw Error('Request too large');request=JSON.parse(line);const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json',Accept:'application/json, text/event-stream',Authorization:'Bearer '+capability},body:line,signal:AbortSignal.timeout(15000)});if(response.status===202)return;if(!response.ok)throw Error('MCP connection rejected; reconnect the current challenge attempt.');process.stdout.write(JSON.stringify(await response.json())+'\n');}catch{if(request?.id!==undefined)process.stdout.write(JSON.stringify({jsonrpc:'2.0',id:request.id,error:{code:-32000,message:'Post Office connection failed. Check the local URL and current attempt capability.'}})+'\n');}});});
