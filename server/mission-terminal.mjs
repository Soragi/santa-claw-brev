import {fileURLToPath} from 'node:url';
import {WebSocketServer} from 'ws';
import {spawn} from 'node:child_process';
import {randomBytes} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
const prefix='/santa/api/challenges/grinch';
export function missionTerminal({app,grinch,locked,allowedHost,spawnTerminal=spawn,sessionTimeoutMs=15*60*1000}){
 const tickets=new Map(),sessions=new Map();
 const eligible=()=>!locked()&&!grinch.busy&&['contained','review','completed'].includes(grinch.read().state);
 const trusted=req=>{if(!allowedHost(req.headers.host)||req.headers['sec-fetch-site']==='cross-site')return false;try{return !req.headers.origin||new URL(req.headers.origin).host===req.headers.host;}catch{return false;}};
 const consume=token=>{const ticket=tickets.get(token);tickets.delete(token);return eligible()&&sessions.size<4&&ticket?.expires>Date.now()&&ticket.attempt===grinch.read().attempt;};
 app.get(prefix+'/terminal-status',async(_q,r)=>{try{const state=grinch.read();if(locked()||!state.sandbox||!['contained','review','completed'].includes(state.state))return r.status(409).json({error:'Contain the Grinch before opening Mission Control.'});const c=await grinch.network.connect(),draft=await c.raw.getDraftPolicy({name:state.sandbox},{timeoutMs:10000});if(grinch.read().attempt!==state.attempt||locked())return r.status(409).json({error:'Challenge changed. Reopen Mission Control.'});r.json({challengeState:state.state,sandbox:state.sandbox,command:'PATH="$HOME/.local/bin:$PATH" openshell -g '+(process.env.SANTA_OPENSHELL_GATEWAY||'nemoclaw')+' term --theme dark',requests:(draft.chunks||[]).map(chunk=>({id:chunk.id,status:chunk.status,ruleName:chunk.ruleName,endpoints:(chunk.proposedRule?.endpoints||[]).map(e=>({host:e.host,port:e.port,rules:e.rules})),binary:chunk.binary||chunk.proposedRule?.binaries?.[0]?.path}))});}catch{r.status(503).json({error:'Cannot read native OpenShell reviews. Check the gateway connection; no decisions were changed.'});}});
 app.post(prefix+'/terminal-ticket',(_q,r)=>{if(!eligible())return r.status(409).json({error:'Contain the Grinch before opening Mission Control.'});if(sessions.size>=4)return r.status(409).json({error:'Four operator terminals are open. Close an unused terminal first.'});for(const[key,t]of tickets)if(t.expires<Date.now())tickets.delete(key);if(tickets.size>=16)return r.status(429).json({error:'Too many terminal connection attempts. Wait briefly and retry.'});const token=randomBytes(32).toString('hex');tickets.set(token,{expires:Date.now()+20000,attempt:grinch.read().attempt});r.json({token});});
 function launch(token,transport){
  const child=spawnTerminal('python3',[fileURLToPath(new URL('../deploy/mission-terminal.py',import.meta.url))],{env:{...process.env,TERM:'xterm-256color',OPENSHELL_GATEWAY:process.env.SANTA_OPENSHELL_GATEWAY||'nemoclaw'},stdio:['pipe','pipe','pipe'],detached:true});
  let stopped=false,output='';const decoder=new StringDecoder('utf8');
  const stop=(code=1000,reason='Native terminal exited. Reconnect to open it again.')=>{if(stopped)return;stopped=true;sessions.delete(token);clearTimeout(timer);clearInterval(heartbeat);try{process.kill(-child.pid,'SIGTERM');}catch{}transport.close(code,reason);};
  const timer=setTimeout(()=>stop(4000,'Terminal session expired after 15 minutes. Reconnect to continue.'),sessionTimeoutMs),heartbeat=setInterval(()=>transport.heartbeat(),15000);
  const send=data=>{if(!stopped&&!transport.send(data))stop(1011,'Terminal output could not be delivered. Reconnect to continue.');};
  const input=v=>{if(stopped||locked())return false;if(v.type==='input'&&typeof v.data==='string'&&v.data.length<=2048||v.type==='resize'&&Number.isInteger(v.cols)&&v.cols>=20&&v.cols<=240&&Number.isInteger(v.rows)&&v.rows>=8&&v.rows<=100){child.stdin.write(JSON.stringify(v)+'\n');return true;}return false;};
  sessions.set(token,{stop,input});
  child.stdout.on('data',b=>{output+=b.toString();if(output.length>1000000)return stop(1011,'Terminal output limit reached. Reconnect to continue.');let i;while((i=output.indexOf('\n'))>=0){const line=output.slice(0,i);output=output.slice(i+1);try{const v=JSON.parse(line);if(v.output)send(decoder.write(Buffer.from(v.output,'base64')));}catch{}}});
  child.stderr.on('data',b=>send(b.toString()));child.on('error',e=>{send('Native terminal unavailable: '+e.message);stop(1011,'Native terminal could not start. Check the terminal output.');});child.on('exit',(code,signal)=>stop(code||signal?1011:1000,code||signal?'Native terminal failed. Check the terminal output and reconnect.':'Native terminal exited. Reconnect to open it again.'));child.stdin.on('error',()=>{});
  return {stop,input};
 }
 app.get(prefix+'/terminal-stream',(q,r)=>{
  const token=q.query.ticket;if(!trusted(q)||typeof token!=='string'||!consume(token))return r.status(403).json({error:'Terminal ticket expired or invalid. Reconnect to obtain a fresh ticket.'});
  r.set({'Content-Type':'text/event-stream','Cache-Control':'no-store, no-transform','X-Accel-Buffering':'no'});r.flushHeaders();
  const session=launch(token,{send:data=>{if(r.destroyed||r.writableLength>1000000)return false;r.write('event: output\ndata: '+JSON.stringify({data})+'\n\n');return true;},heartbeat:()=>{if(!r.destroyed)r.write(': keepalive\n\n');},close:(code,reason)=>{if(!r.destroyed){r.write('event: closed\ndata: '+JSON.stringify({code,reason})+'\n\n');r.end();}}});r.on('close',()=>session.stop());
 });
 app.post(prefix+'/terminal-input',(q,r)=>{const {token,message}=q.body||{};if(!trusted(q)||typeof token!=='string'||!sessions.has(token))return r.status(403).json({error:'Terminal session closed. Reconnect to continue.'});if(!message||!sessions.get(token).input(message))return r.status(400).json({error:'Invalid terminal input.'});r.json({ok:true});});
 app.post(prefix+'/terminal-close',(q,r)=>{const {token}=q.body||{};if(!trusted(q)||typeof token!=='string')return r.status(403).json({error:'Invalid terminal session.'});sessions.get(token)?.stop();r.json({ok:true});});
 const wss=new WebSocketServer({noServer:true,maxPayload:4096});
 return {attach(server){server.on('upgrade',(req,socket,head)=>{const u=new URL(req.url,'http://localhost'),token=u.searchParams.get('ticket');if(u.pathname!==prefix+'/terminal'||!req.headers.origin||!trusted(req)||!consume(token)){socket.destroy();return;}wss.handleUpgrade(req,socket,head,ws=>{const session=launch(token,{send:data=>{if(ws.readyState!==1||ws.bufferedAmount>1000000)return false;ws.send(data);return true;},heartbeat:()=>{if(ws.readyState===1)ws.ping();},close:(code,reason)=>ws.close(code,reason)});ws.on('message',b=>{try{session.input(JSON.parse(b.toString()));}catch{}});ws.on('close',()=>session.stop());ws.on('error',()=>session.stop(1011,'Terminal connection interrupted. Reconnect to continue.'));});});},close(){tickets.clear();for(const session of [...sessions.values()])session.stop();}};
}
