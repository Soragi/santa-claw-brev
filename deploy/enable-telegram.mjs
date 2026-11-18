// Invoked only by the unchanged reviewed credential helper. The token stays in env.
import {spawnSync} from 'node:child_process';
const sandbox=process.argv[2];if(!/^[a-z][a-z0-9-]{1,40}$/.test(sandbox))throw Error('Invalid configured sandbox');
for(const args of [[sandbox,'channels','add','telegram'],[sandbox,'rebuild','--yes']]){
 const result=spawnSync('nemoclaw',args,{env:{...process.env,NEMOCLAW_NON_INTERACTIVE:'1',TELEGRAM_GROUP_POLICY:'disabled'},stdio:'inherit'});if(result.status!==0)process.exit(result.status||1);
}
console.log('Native Telegram channel applied. Complete pairing in the native '+(process.env.SANTA_AGENT_RUNTIME==='hermes'?'Hermes':'OpenClaw')+' interface.');
