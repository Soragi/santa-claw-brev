#!/usr/bin/env node
import {mkdir,mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';import {execFile,execFileSync} from 'node:child_process';import {promisify} from 'node:util';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const exec=promisify(execFile),root=path.dirname(path.dirname(fileURLToPath(import.meta.url))),name=process.env.SANTA_SANDBOX;
if(process.platform!=='linux'||process.arch!=='arm64')throw Error('Install this user service on the DGX Spark.');if(!/^[a-z][a-z0-9-]{1,40}$/.test(name||''))throw Error('Export SANTA_SANDBOX before installation.');
await exec(process.execPath,[path.join(root,'deploy/check-gb10.mjs'),'--stage','runtime'],{env:process.env,timeout:90000});
const dir=path.join(os.homedir(),'.config/santa-claw-gb10'),units=path.join(os.homedir(),'.config/systemd/user');await mkdir(dir,{recursive:true,mode:0o700});await mkdir(units,{recursive:true});
if(!/^\d+$/.test(process.env.PORT||'4310')||Number(process.env.PORT||4310)<1024||Number(process.env.PORT||4310)>65535)throw Error('Invalid workshop port');
const settings=['SANTA_SANDBOX='+name,'SANTA_ALLOW_CLOUD_INFERENCE=0','SANTA_NETWORK_GUARD=1','PORT='+(process.env.PORT||'4310')];for(const k of ['SANTA_DATA','SANTA_PUBLIC_ORIGIN','SANTA_SSH_HOST','SANTA_LOCAL_MODEL','NEMOCLAW_VLLM_PORT','NEMOCLAW_GATEWAY_PORT','SANTA_OPENSHELL_GATEWAY'])if(process.env[k]){if(/[\r\n\0]/.test(process.env[k]))throw Error('Invalid service setting');settings.push(k+'='+JSON.stringify(process.env[k]));}
const bootState=process.env.SANTA_GB10_BOOT_STATE;
if(bootState){if(!path.isAbsolute(bootState)||/[\r\n\0]/.test(bootState)||!/^[a-z][a-z0-9-]{1,18}$/.test(name))throw Error('Invalid managed boot recovery settings');settings.push('SANTA_GB10_BOOT_STATE='+JSON.stringify(bootState));}
await writeFile(path.join(dir,'workshop.env'),settings.join('\n')+'\n',{mode:0o600});
const tools=await Promise.all(['nemoclaw','openshell'].map(async tool=>path.dirname((await exec('which',[tool])).stdout.trim())));
const servicePath=[...new Set([...tools,path.dirname(process.execPath),'/usr/local/bin','/usr/bin','/bin'])].join(':');
const quoted=v=>JSON.stringify(v.replaceAll('%','%%'));
const shellQuote=v=>"'"+v.replaceAll("'", "'\\''")+"'";
const docker=(await exec('which',['docker'])).stdout.trim();
const probe=args=>exec('systemd-run',['--user','--quiet','--wait','--pipe','--collect','--',...args],{timeout:25000});
let dockerGroup=false;
try{await probe([docker,'info','--format','{{.Architecture}}']);}catch{
 // The login database can grant Docker while the user manager still holds its old groups.
 // sg activates that existing membership; setpriv locks out privilege gains before the app starts.
 const group=(await exec('id',['-nG',os.userInfo().username])).stdout.trim().split(/\s+/);
 if(!group.includes('docker'))throw Error('The Village user service cannot access Docker and this user has no Docker group membership.');
 await probe(['/usr/bin/sg','docker','-c','exec /usr/bin/setpriv --no-new-privs '+shellQuote(docker)+' info --format '+shellQuote('{{.Architecture}}')]).catch(()=>{throw Error('The Village user service could not activate its Docker group. Check Docker socket permissions and rerun the installer.');});
 dockerGroup=true;
}
const launch=path.join(root,'deploy/start-workshop.sh');
const start=dockerGroup?':/usr/bin/sg docker -c '+quoted('exec /usr/bin/setpriv --no-new-privs /usr/bin/bash '+shellQuote(launch)):quoted('/usr/bin/bash')+' '+quoted(launch);
if(bootState){
 const uid=process.getuid(),hookName=`santa-claw-gb10-shutdown-${uid}.service`;
 const destination=path.join('/etc/systemd/system',hookName);
 const header=`# Santa Claw managed shutdown hook for uid ${uid}, sandbox ${name}\n`;
 const existing=await readFile(destination,'utf8').catch(error=>{if(error.code!=='ENOENT')throw error;return '';});
 if(existing&&!existing.startsWith(header))throw Error('A different shutdown hook is already installed for this user.');
 const hook=header+`[Unit]\nDescription=Stop the Santa Claw sandbox before Docker shutdown\nAfter=docker.service docker.socket user@${uid}.service\n\n[Service]\nType=oneshot\nUser=${uid}\nRemainAfterExit=yes\nNoNewPrivileges=true\nUMask=0077\nEnvironmentFile=-/etc/nemoclaw/gateway-management.env\nEnvironment=${quoted('PATH='+servicePath)}\nEnvironment=${quoted('SANTA_SANDBOX='+name)}\nEnvironment=${quoted('SANTA_GB10_BOOT_STATE='+bootState)}\nExecStart=/usr/bin/true\nExecStop=:/usr/bin/bash ${quoted(path.join(root,'deploy/gb10-sandbox-boot.sh'))} stop\nTimeoutStopSec=60\n\n[Install]\nWantedBy=multi-user.target\n`;
 const tmp=await mkdtemp(path.join(os.tmpdir(),'santa-shutdown-'));
 try{
  const unitFile=path.join(tmp,hookName);
  await writeFile(unitFile,hook,{mode:0o600});
  await exec('systemd-analyze',['verify',unitFile]);
  if(existing!==hook){
   execFileSync('sudo',['install','-m','0644','--',unitFile,destination],{stdio:'inherit'});
   execFileSync('sudo',['systemctl','daemon-reload'],{stdio:'inherit'});
  }
  execFileSync('sudo',['systemctl','enable','--now',hookName],{stdio:'inherit'});
 }finally{await rm(tmp,{recursive:true,force:true});}
}
const directory=v=>{if(/[\r\n\0]/.test(v)||/\s$/.test(v))throw Error('Invalid checkout path');return v.replaceAll('%','%%');};
const unit='[Unit]\nDescription=Santa Claw local GB10 workshop\nAfter=network-online.target\nStartLimitIntervalSec=0\n\n[Service]\nType=simple\nWorkingDirectory='+directory(root)+'\nEnvironment=NODE_ENV=production\nEnvironmentFile=%h/.config/santa-claw-gb10/workshop.env\nEnvironmentFile=-/etc/nemoclaw/gateway-management.env\nExecStart='+start+'\nEnvironment=PATH='+quoted(servicePath)+'\nRestart=on-failure\nRestartSec=10\nUMask=0077\nNoNewPrivileges='+(dockerGroup?'false':'true')+'\n\n[Install]\nWantedBy=default.target\n';
await writeFile(path.join(units,'santa-claw-gb10.service'),unit,{mode:0o600});await exec('systemd-analyze',['--user','verify',path.join(units,'santa-claw-gb10.service')]);await exec('systemctl',['--user','daemon-reload']);await exec('systemctl',['--user','enable','--now','santa-claw-gb10.service']);await exec('systemctl',['--user','is-active','--quiet','santa-claw-gb10.service']);
let healthy=false;for(let attempt=0;attempt<30;attempt++){try{const response=await fetch('http://127.0.0.1:'+(process.env.PORT||'4310')+'/santa/api/health',{redirect:'error',signal:AbortSignal.timeout(1000)}),status=await response.json();if(response.ok&&status.ok&&status.target==='dgx-spark-gb10'&&status.localOnly===true){healthy=true;break;}}catch{}await new Promise(resolve=>setTimeout(resolve,500));}if(!healthy)throw Error('Service HTTP readiness failed. Inspect journalctl --user -u santa-claw-gb10; installation is not verified.');
console.log('Installed santa-claw-gb10.service for the current Spark user. Model/runtime services were not changed.');
