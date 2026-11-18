import test from 'node:test';import assert from 'node:assert/strict';import{execFileSync}from'node:child_process';import{mkdtempSync,readFileSync,existsSync,rmSync}from'node:fs';import os from'node:os';import path from'node:path';
import{fileURLToPath}from'node:url';const launcher=fileURLToPath(new URL('../deploy/launcher.py',import.meta.url));
test('portable plan requires no installation and never writes receipts or exposes secrets',()=>{const dir=mkdtempSync(path.join(os.tmpdir(),'santa-plan-'));try{const text=execFileSync('python3',[launcher,'up','--plan','--provider','build','--model','nvidia/model'],{env:{...process.env,XDG_STATE_HOME:dir,NVIDIA_INFERENCE_API_KEY:'PRIVATE_KEY_DO_NOT_PRINT'},encoding:'utf8'});const v=JSON.parse(text);assert.equal(v.provider,'build');assert.equal(v.model,'nvidia/model');assert.equal(v.port,4310);assert.doesNotMatch(text,/PRIVATE_KEY_DO_NOT_PRINT/);assert.equal(existsSync(path.join(dir,'santa-claw-portable')),false);}finally{rmSync(dir,{recursive:true,force:true});}});
test('invalid arguments fail before native commands or state mutation',()=>{for(const args of[['--sandbox','../bad'],['--port','80'],['--model','bad model']])assert.throws(()=>execFileSync('python3',[launcher,'up','--plan',...args],{stdio:'pipe'}));});
test('platform matrix and saved config recovery are explicit',()=>{const code=`import importlib.util, argparse\ns=importlib.util.spec_from_file_location('launcher',${JSON.stringify(launcher)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)\nassert m.supported('Linux','x86_64')\nassert m.supported('Linux','aarch64')\nassert m.supported('Darwin','arm64')\nassert not m.supported('Darwin','x86_64')\nassert not m.supported('Windows','AMD64')\na=argparse.Namespace(sandbox=None,provider=None,model=None,port=None,vllm_port=None)\nc=m.settings(a,{'sandbox':'my-team','provider':'vllm','model':'my-vlm','port':4322,'vllm_port':8001})\nassert c['port']==4322 and c['model']=='my-vlm'\n`;execFileSync('python3',['-c',code]);});

test('Hermes selection is persisted in plans and uses a separate sandbox and state location',()=>{const dir=mkdtempSync(path.join(os.tmpdir(),'santa-hermes-plan-'));try{const text=execFileSync('python3',[launcher,'up','--plan','--agent','hermes','--model','nvidia/model'],{env:{...process.env,XDG_STATE_HOME:dir},encoding:'utf8'});const plan=JSON.parse(text);assert.equal(plan.agent,'hermes');assert.equal(plan.sandbox,'santa-claw-hermes');}finally{rmSync(dir,{recursive:true,force:true});}});

test('portable qualification and Hermes entrypoints parse before native provisioning',()=>{for(const file of ['deploy/check-portable.mjs','deploy/hermes-runner.cjs','server/runtime-profile.mjs'])execFileSync(process.execPath,['--check',fileURLToPath(new URL('../'+file,import.meta.url))],{stdio:'pipe'});});

test('deferred native setup starts onboarding; only interrupted setup uses resume and both receive acceptance',()=>{
 const code=`import importlib.util, pathlib, tempfile, os, json, sys, io, socket
s=importlib.util.spec_from_file_location('launcher',${JSON.stringify(launcher)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
class Socket:
 def __enter__(self):return self
 def __exit__(self,*a):pass
 def bind(self,*a):pass
 def setsockopt(self,*a):pass
socket.socket=lambda *a,**kw:Socket()
class Child:
 pid=99999999
 def poll(self):return None
m.subprocess.Popen=lambda *a,**kw:Child()
m.urllib.request.urlopen=lambda url,*a,**kw:io.BytesIO(b'{"data":[{"id":"test/model"}]}' if url.endswith('/v1/models') else b'{"ok":true}')
m.shutil.which=lambda *a,**kw:'/native/nemoclaw'
m.ensure_node=lambda env:'/native/node'
m.ensure_native_state_permissions=lambda env:None
m.ensure_user_service_persistence=lambda env:None
for interrupted,changed in ((False,False),(True,False),(True,True)):
 with tempfile.TemporaryDirectory() as temp:
  os.environ['XDG_STATE_HOME']=temp
  os.environ['NVIDIA_INFERENCE_API_KEY']='TEST_ONLY_NOT_A_REAL_KEY'
  directory=pathlib.Path(temp)/'santa-claw-portable-hermes';directory.mkdir()
  cfg={'root':str(m.ROOT),'agent':'hermes','sandbox':'santa-test','provider':'build','model':'old/model' if changed else 'test/model','port':4310,'vllm_port':8000,'qualified':False}
  (directory/'launcher.json').write_text(json.dumps(cfg))
  calls=[];rows=[]
  m.native_status=lambda env:{'sandboxes':list(rows),'incompleteOnboarding':{'name':'santa-test','resumable':True} if interrupted else None}
  def run(argv,env,**kw):
   calls.append(list(argv))
   if argv[:2]==['nemoclaw','onboard']:
    assert env['NEMOCLAW_ACCEPT_THIRD_PARTY_SOFTWARE']=='1'
    assert env['NEMOCLAW_AGENT']=='hermes'
    assert env['NVIDIA_INFERENCE_API_KEY']=='TEST_ONLY_NOT_A_REAL_KEY'
    rows.append({'name':'santa-test','agent':'hermes','model':'test/model','provider':'nvidia-prod'})
   else:assert 'NVIDIA_INFERENCE_API_KEY' not in env
  m.run=run;m.run_native=lambda argv,env,*a,**kw:run(argv,env,**kw)
  sys.argv=['santa-claw','up','--agent','hermes','--yes','--model','test/model']
  m.main()
  onboard=next(v for v in calls if v[:2]==['nemoclaw','onboard'])
  assert ('--resume' in onboard)==(interrupted and not changed)
  assert ('--fresh' in onboard)==changed
  assert '--yes-i-accept-third-party-software' in onboard
  receipt=json.loads((directory/'launcher.json').read_text())
  assert receipt['qualified'] is True
  assert 'TEST_ONLY_NOT_A_REAL_KEY' not in json.dumps(receipt)
`;
 execFileSync('python3',['-c',code],{stdio:'pipe'});
});

test('native failures retain a private transcript with credentials and dashboard tokens redacted',()=>{
 const code=`import importlib.util,tempfile,pathlib,os,sys,contextlib,io,subprocess,stat
s=importlib.util.spec_from_file_location('launcher',${JSON.stringify(launcher)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
 log=pathlib.Path(temp)/'native.log';env={**os.environ,'NVIDIA_INFERENCE_API_KEY':'TEST_PRIVATE_VALUE'}
 script='import os; print(os.environ["NVIDIA_INFERENCE_API_KEY"]); print("https://localhost/?token=PRIVATE_LINK_VALUE"); raise SystemExit(7)'
 with contextlib.redirect_stdout(io.StringIO()):
  try:m.run_native([sys.executable,'-c',script],env,log)
  except subprocess.CalledProcessError as e:assert e.returncode==7
  else:raise AssertionError('failure was ignored')
 text=log.read_text();assert 'TEST_PRIVATE_VALUE' not in text and 'PRIVATE_LINK_VALUE' not in text
 assert '[redacted]' in text and stat.S_IMODE(log.stat().st_mode)==0o600
`;
 execFileSync('python3',['-c',code],{stdio:'pipe'});
});

test('unavailable hosted models fail before asking for credentials or invoking native installation',()=>{
 const code=`import importlib.util,tempfile,os,sys
s=importlib.util.spec_from_file_location('launcher',${JSON.stringify(launcher)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
 os.environ['XDG_STATE_HOME']=temp
 m.cloud_models=lambda:['current/vision-model']
 def forbidden(*a,**kw):raise AssertionError('Credential/native operation ran before model availability check')
 m.secret=forbidden;m.run=forbidden;m.run_native=forbidden;m.native_status=forbidden
 sys.argv=['santa-claw','up','--agent','hermes','--yes','--model','retired/model']
 try:m.main()
 except RuntimeError as e:assert 'absent from the current NVIDIA-hosted catalog' in str(e)
 else:raise AssertionError('Unavailable model was accepted')
`;
 execFileSync('python3',['-c',code],{stdio:'pipe'});
});

test('native state permissions repair owned writable ancestors without changing files and reject symlinks before mutation',()=>{
 const code=`import importlib.util,tempfile,pathlib,os,stat,shutil
s=importlib.util.spec_from_file_location('launcher',${JSON.stringify(launcher)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
 home=pathlib.Path(temp)/'home';home.mkdir()
 dirs=[home,home/'.local',home/'.local/state',home/'.config',home/'.config/openshell',home/'.config/openshell/gateways']
 for p in dirs:p.mkdir(parents=True,exist_ok=True);p.chmod(0o775)
 data=home/'.local/state/retained.txt';data.write_text('Keep this data')
 m.ensure_native_state_permissions({'HOME':str(home)})
 assert all(not p.stat().st_mode&0o022 for p in dirs)
 assert data.read_text()=='Keep this data'
 shutil.rmtree(home/'.config/openshell');outside=pathlib.Path(temp)/'outside';outside.mkdir();(home/'.config/openshell').symlink_to(outside,target_is_directory=True)
 home.chmod(0o775)
 try:m.ensure_native_state_permissions({'HOME':str(home)})
 except RuntimeError:pass
 else:raise AssertionError('Symlink was accepted')
 assert stat.S_IMODE(home.stat().st_mode)==0o775
`;
 execFileSync('python3',['-c',code],{stdio:'pipe'});
});

test('Linux native service persistence is verified and scoped to the current user',()=>{
 const code=`import importlib.util,tempfile,pathlib,os,types
s=importlib.util.spec_from_file_location('launcher',${JSON.stringify(launcher)});m=importlib.util.module_from_spec(s);s.loader.exec_module(m)
with tempfile.TemporaryDirectory() as temp:
 unit=pathlib.Path(temp)/'.config/systemd/user/nemoclaw-openshell-gateway.service';unit.parent.mkdir(parents=True);unit.write_text('[Service]')
 m.platform.system=lambda:'Linux';m.shutil.which=lambda *a,**kw:'/bin/loginctl'
 state={'linger':'no'};calls=[]
 def output(argv,env):
  assert argv==['loginctl','show-user',str(os.getuid()),'-p','Linger','--value'];return state['linger']
 def run(argv,**kw):
  calls.append(argv);assert argv[-1]==str(os.getuid())
  if argv[0]=='sudo':state['linger']='yes';return types.SimpleNamespace(returncode=0)
  return types.SimpleNamespace(returncode=1)
 m.output=output;m.subprocess.run=run
 env={'HOME':temp,'PATH':os.environ['PATH']}
 m.ensure_user_service_persistence(env)
 assert calls==[['loginctl','enable-linger',str(os.getuid())],['sudo','-n','loginctl','enable-linger',str(os.getuid())]]
 m.ensure_user_service_persistence(env);assert len(calls)==2
`;
 execFileSync('python3',['-c',code],{stdio:'pipe'});
});

test('stop waits for the owned UI to exit before discarding its process receipt',()=>{
 const code=`import importlib.util,pathlib,signal\nspec=importlib.util.spec_from_file_location('launcher',str(pathlib.Path('deploy/launcher.py').resolve()));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nchecks=iter([True,True,True,False]);calls=[]\nm.owned_process=lambda saved:next(checks)\nm.os.kill=lambda pid,sig:calls.append(('kill',pid,sig))\nm.time.sleep=lambda seconds:calls.append(('wait',seconds))\nm.stop_owned_ui({'pid':123})\nassert calls==[('kill',123,signal.SIGTERM),('wait',0.2),('wait',0.2)]\nm.owned_process=lambda saved:True\nclock=iter([0,11]);m.time.monotonic=lambda:next(clock)\ntry:m.stop_owned_ui({'pid':123})\nexcept RuntimeError as e:assert 'receipt was retained' in str(e)\nelse:raise AssertionError('A live UI must not be reported stopped')\n`;
 execFileSync('python3',['-c',code]);
});

test('Linux port preflight rejects a live listener but accepts its closed TIME_WAIT connections',{skip:process.platform!=='linux'},()=>{
 const code=`import importlib.util,pathlib,socket\nspec=importlib.util.spec_from_file_location('launcher',str(pathlib.Path('deploy/launcher.py').resolve()));m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)\nserver=socket.socket();server.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1);server.bind(('127.0.0.1',0));server.listen(1);port=server.getsockname()[1]\ntry:m.assert_ui_port_available(port)\nexcept OSError:pass\nelse:raise AssertionError('Must preserve the active listener')\nclient=socket.create_connection(('127.0.0.1',port),timeout=2);connection,_=server.accept();connection.close();assert client.recv(1)==b'';client.close();server.close()\nm.assert_ui_port_available(port)\n`;
 execFileSync('python3',['-c',code]);
});

test('factory opt-in is recorded without starting Docker during a plan',()=>{const dir=mkdtempSync(path.join(os.tmpdir(),'santa-factory-plan-'));try{const v=JSON.parse(execFileSync('python3',[launcher,'up','--plan','--factory','--agent','hermes','--provider','build','--model','nvidia/model'],{env:{...process.env,XDG_STATE_HOME:dir},encoding:'utf8'}));assert.equal(v.factory,true);assert.equal(v.agent,'hermes');assert.equal(existsSync(path.join(dir,'santa-claw-portable-hermes')),false);}finally{rmSync(dir,{recursive:true,force:true});}});
