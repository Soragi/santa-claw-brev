#!/usr/bin/env python3
"""Host launcher: the native runtime owns sandbox lifecycle, not a nested Compose app."""
import argparse, fcntl, getpass, json, os, pathlib, platform, re, shutil, signal, stat, subprocess, sys, time, urllib.request
ROOT = pathlib.Path(__file__).resolve().parents[1]

def supported(system, machine):
    return (system == 'Linux' and machine in ('aarch64','arm64','x86_64','amd64')) or (system == 'Darwin' and machine == 'arm64')

def settings(args, saved=None):
    saved = saved or {}
    name = args.sandbox or saved.get('sandbox','santa-claw-portable')
    provider = args.provider or saved.get('provider','build')
    agent = getattr(args,'agent',None) or saved.get('agent','openclaw')
    if agent not in ('openclaw','hermes'):raise ValueError('Choose openclaw or hermes.')
    if agent=='hermes' and not args.sandbox and not saved:name='santa-claw-hermes'
    model = args.model or saved.get('model','')
    if not re.fullmatch(r'[a-z][a-z0-9-]{1,18}',name): raise ValueError('Sandbox must be 2–19 lowercase letters, digits or hyphens.')
    if model and not re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}',model): raise ValueError('Invalid model identifier.')
    port = args.port or saved.get('port',4310)
    vllm = args.vllm_port or saved.get('vllm_port',8000)
    if any(not 1024 <= int(p) <= 65535 for p in (port,vllm)): raise ValueError('Ports must be 1024–65535.')
    return dict(sandbox=name,agent=agent,provider=provider,model=model,port=int(port),vllm_port=int(vllm),root=str(ROOT),factory=bool(getattr(args,'factory',False) or saved.get('factory',False)))

def write_private(file, value):
    temp = file.with_suffix('.new')
    fd=os.open(temp,os.O_WRONLY|os.O_CREAT|os.O_TRUNC,0o600)
    with os.fdopen(fd,'w') as stream: json.dump(value,stream,indent=2)
    os.chmod(temp,0o600);os.replace(temp,file)

def run(argv,env,**kwargs):
    return subprocess.run(argv,check=True,env=env,**kwargs)

def run_native(argv,env,logfile,**kwargs):
    """Retain a private, redacted diagnostic transcript for failed onboarding."""
    fd=os.open(logfile,os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
    os.chmod(logfile,0o600)
    try:
        with os.fdopen(fd,'w',buffering=1) as log:
            process=subprocess.Popen(argv,env=env,stdout=subprocess.PIPE,stderr=subprocess.STDOUT,text=True,**kwargs)
            for line in process.stdout:
                sys.stdout.write(line);sys.stdout.flush()
                safe=line
                for key in ('NVIDIA_INFERENCE_API_KEY','NEMOCLAW_PROVIDER_KEY'):
                    if env.get(key):safe=safe.replace(env[key],'[redacted]')
                safe=re.sub(r'(?i)(token|api_key|password|secret)=([^\s&#]+)',r'\1=[redacted]',safe)
                safe=re.sub(r'nvapi-[A-Za-z0-9_-]+','[redacted]',safe)
                log.write(safe)
            code=process.wait()
            if code:raise subprocess.CalledProcessError(code,argv)
    except BaseException:
        if 'process' in locals() and process.poll() is None:process.terminate()
        raise

def output(argv,env):
    return subprocess.check_output(argv,env=env,text=True,timeout=30)

def owned_process(saved):
    pid=saved.get('pid')
    if not isinstance(pid,int) or pid<2:return False
    try:
        cmd=subprocess.check_output(['ps','-p',str(pid),'-o','args='],text=True,stderr=subprocess.DEVNULL)
        return str(ROOT/'server/private-index.mjs') in cmd
    except subprocess.CalledProcessError:return False

def stop_owned_ui(saved):
    if not owned_process(saved):return
    os.kill(saved['pid'],signal.SIGTERM)
    deadline=time.monotonic()+10
    while owned_process(saved):
        if time.monotonic()>=deadline:
            raise RuntimeError('The owned Santa UI is still shutting down. Its process receipt was retained; retry stop before restarting.')
        time.sleep(0.2)

def assert_ui_port_available(port):
    import socket
    with socket.socket() as probe:
        # Match the Node listener: completed connections may remain in TIME_WAIT
        # after shutdown. This does not share a port with an active listener.
        probe.setsockopt(socket.SOL_SOCKET,socket.SO_REUSEADDR,1)
        probe.bind(('127.0.0.1',port))

def native_status(env):
    raw=output(['nemoclaw','list','--json'],env)
    value=json.loads(raw[raw.index('{'):])
    if not isinstance(value.get('sandboxes'),list):raise RuntimeError('Native inventory did not include registered sandboxes.')
    return value

def native_inventory(env):
    return native_status(env)['sandboxes']

def cloud_models():
    try:
        with urllib.request.urlopen('https://integrate.api.nvidia.com/v1/models',timeout=15) as response:
            raw=response.read(1048577)
        if len(raw)>1048576:raise ValueError('Catalog exceeded its size limit.')
        rows=json.loads(raw)['data']
        ids=sorted({r['id'] for r in rows if isinstance(r,dict) and isinstance(r.get('id'),str) and re.fullmatch(r'[A-Za-z0-9][A-Za-z0-9._/:+-]{0,199}',r['id'])})
        if not ids:raise ValueError('No model identifiers were returned.')
        return ids
    except (OSError,ValueError,KeyError,TypeError):raise RuntimeError('The NVIDIA model catalog is unavailable. Check connectivity and retry; no key was requested.')

def ensure_native_state_permissions(env):
    home=pathlib.Path(env.get('HOME',str(pathlib.Path.home())))
    if not home.is_absolute():raise RuntimeError('Native setup requires an absolute home directory.')
    paths=[home,home/'.local',home/'.local/state',home/'.config',home/'.config/openshell',home/'.config/openshell/gateways']
    changes=[]
    for directory in paths:
        if not directory.exists() and not directory.is_symlink():continue
        info=directory.lstat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid not in (0,os.getuid()):
            raise RuntimeError('Native state requires trusted real directories owned by this user or root: '+str(directory))
        if info.st_mode&0o022:
            if info.st_uid!=os.getuid():raise RuntimeError('An administrator must remove group/world write access from '+str(directory))
            changes.append((directory,stat.S_IMODE(info.st_mode)&~0o022))
    for directory,mode in changes:directory.chmod(mode)
    if changes:print('Applied required native state directory permissions (owner access preserved).')

def ensure_user_service_persistence(env):
    if platform.system()!='Linux':return
    unit=pathlib.Path(env.get('HOME',str(pathlib.Path.home())))/'.config/systemd/user/nemoclaw-openshell-gateway.service'
    if not unit.is_file():return
    if not shutil.which('loginctl',path=env['PATH']):raise RuntimeError('Native user service requires loginctl or a separately managed persistent gateway.')
    uid=str(os.getuid())
    if output(['loginctl','show-user',uid,'-p','Linger','--value'],env).strip()=='yes':return
    for command in [['loginctl','enable-linger',uid],['sudo','-n','loginctl','enable-linger',uid]]:
        try:result=subprocess.run(command,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL,timeout=15)
        except OSError:continue
        if result.returncode==0:break
    if output(['loginctl','show-user',uid,'-p','Linger','--value'],env).strip()!='yes':
        raise RuntimeError('OpenShell would stop after SSH logout. Run sudo loginctl enable-linger '+uid+' on this instance, then rerun.')
    print('Native user services now persist after SSH logout.')

def ensure_node(env):
    candidates=[shutil.which('node',path=env['PATH'])]
    candidates += [str(p) for p in (pathlib.Path.home()/'.nvm/versions/node').glob('v*/bin/node')]
    for node in filter(None,candidates):
        try:
            v=tuple(map(int,output([node,'-p','process.versions.node'],env).strip().split('.')))
            if v >= (22,19,0):
                env['PATH']=str(pathlib.Path(node).parent)+os.pathsep+env['PATH'];return node
        except (ValueError,subprocess.SubprocessError):pass
    raise RuntimeError('Native installer did not provide Node.js 22.19+. Install a supported Node version and rerun.')

def secret(prompt):
    if not sys.stdin.isatty():raise RuntimeError('Set NVIDIA_INFERENCE_API_KEY in the invoking environment, or rerun in a terminal for hidden entry.')
    value=getpass.getpass(prompt)
    if not value:raise RuntimeError('An API key is required.')
    return value

def main():
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('command',choices=['up','status','stop','logs','check','models'],nargs='?',default='up')
    p.add_argument('--agent',choices=['openclaw','hermes'],help='Agent runtime (default OpenClaw; each runtime needs a separate sandbox).')
    p.add_argument('--provider',choices=['build','vllm']);p.add_argument('--model');p.add_argument('--sandbox')
    p.add_argument('--port',type=int);p.add_argument('--vllm-port',type=int)
    p.add_argument('--factory',action='store_true',help='Install the offline Bauble Factory CAD worker (Linux).')
    p.add_argument('--plan',action='store_true');p.add_argument('--yes',action='store_true')
    p.add_argument('--reuse-native',action='store_true',help='Explicitly adopt a configured compatible sandbox without replacing it.')
    args=p.parse_args()
    if not supported(platform.system(),platform.machine()):raise RuntimeError('Supported hosts: Linux ARM64/x86_64 or Apple Silicon macOS. Intel Macs need a remote Linux instance.')
    state_home=pathlib.Path(os.environ.get('XDG_STATE_HOME',str(pathlib.Path.home()/'.local/state')))
    if args.command=='up' and not args.plan and not args.agent and sys.stdin.isatty() and not (state_home/'santa-claw-portable/launcher.json').exists():
        selection=input('Agent runtime: 1 OpenClaw (default), 2 Hermes: ').strip()
        if selection not in ('','1','2'):raise ValueError('Choose 1 or 2.')
        args.agent='hermes' if selection=='2' else 'openclaw'
    base=state_home/('santa-claw-portable-hermes' if args.agent=='hermes' else 'santa-claw-portable')
    receipt=base/'launcher.json';saved=json.loads(receipt.read_text()) if receipt.exists() else {}
    if saved and saved.get('root')!=str(ROOT):raise RuntimeError('Another checkout owns this launcher installation. Use its launcher; nothing was replaced.')
    cfg=settings(args,saved)
    if args.command=='up' and cfg['factory'] and not args.plan and platform.system()!='Linux':raise RuntimeError('Bauble Factory deployment requires a Linux Brev or GB10 host. No local native provisioning was attempted.')
    if saved and (cfg['agent']!=saved.get('agent','openclaw') or cfg['sandbox']!=saved.get('sandbox')):raise RuntimeError('This state directory belongs to another runtime/sandbox. Use a separate installation; existing agents and data were preserved.')
    if args.plan:
        print(json.dumps(dict(**cfg,platform=platform.system(),architecture=platform.machine(),steps=['Verify Docker; install pinned NemoClaw/OpenShell and selected agent if absent','Onboard named sandbox using selected inference; preserve unrelated installations','npm ci; prepare offline browser; build UI','Verify actual native tool calling and image inference','Install isolated CAD worker when --factory is selected; printer qualification is a separate organizer step','Start loopback UI; verify readiness; discover allocated dashboard URL'],prerequisites='Python 3, Git; running Docker Desktop/Colima on macOS. Linux native setup can request administrator access. One model must support tools and images.'),indent=2));return
    if args.command=='models':
        print(json.dumps({'provider':'build','models':cloud_models(),'note':'Catalog membership does not guarantee an active route or tool/vision support; live probes still qualify deployment.'},indent=2));return
    if args.command=='status':
        print(json.dumps(dict(**cfg,running=owned_process(saved),qualified=bool(saved.get('qualified'))),indent=2));return
    if args.command=='logs':
        if not (base/'app.log').exists():raise RuntimeError('No application log yet.')
        os.execvp('tail',['tail','-n','80','-f',str(base/'app.log')])
    base.mkdir(parents=True,exist_ok=True,mode=0o700);base.chmod(0o700)
    with (base/'launcher.lock').open('a') as lock:
        try:fcntl.flock(lock,fcntl.LOCK_EX|fcntl.LOCK_NB)
        except BlockingIOError:raise RuntimeError('Another launcher operation is running.')
        if args.command=='stop':
            stop_owned_ui(saved)
            saved.pop('pid',None);saved['qualified']=False
            if saved:write_private(receipt,saved)
            print('Owned Santa UI stopped. Agents, data, native runtime and model are preserved.');return
        env=os.environ.copy()
        native_key=env.pop('NVIDIA_INFERENCE_API_KEY',None)
        env['PATH']=os.pathsep.join([str(pathlib.Path.home()/'.local/bin'),str(pathlib.Path.home()/'.npm-global/bin'),env.get('PATH','')])
        env.update(SANTA_AGENT_RUNTIME=cfg['agent'],NEMOCLAW_AGENT=cfg['agent'],SANTA_SANDBOX=cfg['sandbox'],SANTA_ALLOW_CLOUD_INFERENCE='1' if cfg['provider']=='build' else '0',SANTA_DEPLOYMENT_PROFILE='portable',SANTA_NETWORK_GUARD='1',PORT=str(cfg['port']),NEMOCLAW_VLLM_PORT=str(cfg['vllm_port']))
        env['SANTA_DATA']=str(base/'data')
        env['SANTA_FACTORY']='1' if cfg['factory'] else '0'
        if cfg['provider']=='vllm':env['SANTA_LOCAL_MODEL']=cfg['model']
        if args.command=='check':
            node=ensure_node(env)
            run([node,str(ROOT/'deploy/check-portable.mjs')],env,cwd=ROOT,timeout=180);return
        if owned_process(saved):
            if any(cfg[k]!=saved.get(k) for k in ('sandbox','agent','provider','model','port','vllm_port','factory')):raise RuntimeError('Stop this UI before changing its launch configuration.')
            print('Workshop is already running; checking dependencies without restarting.')
            run([ensure_node(env),str(ROOT/'deploy/check-portable.mjs')],env,cwd=ROOT,timeout=180);return
        if not cfg['model']:
            if not sys.stdin.isatty():raise RuntimeError('Supply --model with a tool- and image-capable model ID.')
            cfg['model']=input('Exact model ID (must support tool calls and images): ').strip()
            args.model=cfg['model'];cfg=settings(args,cfg)
        if cfg['provider']=='build' and cfg['model'] not in cloud_models():
            raise RuntimeError('Selected model is absent from the current NVIDIA-hosted catalog. Run ./santa-claw models and choose an available tool- and image-capable model. No key was requested.')
        if not args.yes:
            if not sys.stdin.isatty() or input('Install pinned software and images for this workshop? [y/N] ').strip().lower()!='y':raise RuntimeError('Installation cancelled. --yes accepts software/image downloads.')
        if not shutil.which('git',path=env['PATH']):raise RuntimeError('Install Git and rerun (macOS: Xcode Command Line Tools).')
        ensure_native_state_permissions(env)
        native=shutil.which('nemoclaw',path=env['PATH'])
        if native and not saved and not args.reuse_native:raise RuntimeError('Existing NemoClaw found. Choose its sandbox with --reuse-native --sandbox NAME; it was not modified.')
        if platform.system()=='Darwin':run(['docker','info'],env,stdout=subprocess.DEVNULL,timeout=15)
        # Stop before native provisioning if another application owns the UI port.
        assert_ui_port_available(cfg['port'])
        initial=dict(cfg,qualified=False)
        if not native:
            if shutil.which('openshell',path=env['PATH']):raise RuntimeError('Standalone OpenShell found. Qualify it before adopting a NemoClaw installation.')
            pin=json.loads((ROOT/'config/installer.json').read_text())['native']['commit']
            source=base/('native-'+pin)
            if not source.exists():
                run(['git','init','-q',str(source)],env)
                run(['git','-C',str(source),'remote','add','origin','https://github.com/NVIDIA/NemoClaw.git'],env)
            assert output(['git','-C',str(source),'remote','get-url','origin'],env).strip()=='https://github.com/NVIDIA/NemoClaw.git'
            run(['git','-C',str(source),'fetch','--depth','1','origin',pin],env)
            run(['git','-C',str(source),'checkout','--detach','FETCH_HEAD'],env)
            if output(['git','-C',str(source),'rev-parse','HEAD'],env).strip()!=pin:raise RuntimeError('Native source pin mismatch.')
            run(['git','-C',str(source),'diff','--exit-code','HEAD'],env)
            write_private(receipt,initial)
            native_env=env.copy()
            if native_key:native_env['NVIDIA_INFERENCE_API_KEY']=native_key
            native_env.update(NEMOCLAW_INSTALL_REF=pin,NEMOCLAW_AGENT=cfg['agent'],NEMOCLAW_NO_EXPRESS='1',NEMOCLAW_PROVIDER=cfg['provider'],NEMOCLAW_MODEL=cfg['model'],NEMOCLAW_SANDBOX_NAME=cfg['sandbox'],NEMOCLAW_NON_INTERACTIVE='1',NEMOCLAW_SINGLE_SESSION='1',NEMOCLAW_ACCEPT_THIRD_PARTY_SOFTWARE='1',NEMOCLAW_NON_INTERACTIVE_SUDO_MODE='prompt')
            if cfg['provider']=='build' and not native_env.get('NVIDIA_INFERENCE_API_KEY'):
                native_env['NVIDIA_INFERENCE_API_KEY']=secret('NVIDIA API key (hidden; passed only to native setup): ')
                if not native_env['NVIDIA_INFERENCE_API_KEY']:raise RuntimeError('API key required.')
            # Do not inherit destructive recreation or managed-model installation overrides.
            for key in ('NEMOCLAW_FRESH','NEMOCLAW_RECREATE_SANDBOX','NEMOCLAW_FORCE_FRESH_INSTALL','NEMOCLAW_FORCE_STATION_INSTALL','NEMOCLAW_RECREATE','NEMOCLAW_VLLM_MODEL','NEMOCLAW_INSTALL_TAG'):native_env.pop(key,None)
            try:run_native(['bash',str(source/'install.sh'),'--non-interactive','--yes-i-accept-third-party-software'],native_env,base/'native-install.log',cwd=ROOT)
            finally:native_env.pop('NVIDIA_INFERENCE_API_KEY',None)
        if cfg['provider']=='vllm':env['SANTA_LOCAL_MODEL']=cfg['model']
        node=ensure_node(env)
        ensure_native_state_permissions(env)
        ensure_user_service_persistence(env)
        inventory=native_status(env);rows=inventory['sandboxes']
        row=next((r for r in rows if (r.get('name') or r.get('sandboxName'))==cfg['sandbox']),None)
        if not row and saved:
            incomplete=inventory.get('incompleteOnboarding')
            if incomplete and incomplete.get('name')!=cfg['sandbox']:
                raise RuntimeError('Another native onboarding checkpoint belongs to '+str(incomplete.get('name'))+'. Finish or retire it in NemoClaw before starting this sandbox; no credentials were requested.')
            resume=env.copy()
            if native_key:resume['NVIDIA_INFERENCE_API_KEY']=native_key
            resume.update(NEMOCLAW_AGENT=cfg['agent'],NEMOCLAW_NO_EXPRESS='1',NEMOCLAW_PROVIDER=cfg['provider'],NEMOCLAW_MODEL=cfg['model'],NEMOCLAW_NON_INTERACTIVE='1',NEMOCLAW_SANDBOX_NAME=cfg['sandbox'],NEMOCLAW_ACCEPT_THIRD_PARTY_SOFTWARE='1')
            for key in ('NEMOCLAW_FRESH','NEMOCLAW_RECREATE_SANDBOX','NEMOCLAW_FORCE_FRESH_INSTALL'):resume.pop(key,None)
            # Deferred installation has no interrupted session to resume.
            # Software acceptance must also reach this direct CLI invocation.
            args_onboard=['nemoclaw','onboard','--name',cfg['sandbox'],'--agent',cfg['agent'],'--non-interactive','--yes','--yes-i-accept-third-party-software']
            if any(cfg[k]!=saved.get(k) for k in ('provider','model')):
                if rows:raise RuntimeError('Other sandboxes exist. Resolve the native onboarding checkpoint before changing inference; nothing was replaced.')
                args_onboard.append('--fresh')
            elif incomplete and incomplete.get('resumable'):args_onboard.append('--resume')
            if cfg['provider']=='build' and not resume.get('NVIDIA_INFERENCE_API_KEY'):
                resume['NVIDIA_INFERENCE_API_KEY']=secret('NVIDIA API key for native setup (hidden): ')
            try:run_native(args_onboard,resume,base/'native-onboard.log')
            finally:resume.pop('NVIDIA_INFERENCE_API_KEY',None)
            row=next((r for r in native_inventory(env) if (r.get('name') or r.get('sandboxName'))==cfg['sandbox']),None)
        if not row:
            raise RuntimeError('Named sandbox was not provisioned. Resume native onboarding with the selected provider, then rerun; unrelated sandboxes are preserved.')
        native_agent=row.get('agentName') or row.get('agent')
        if isinstance(native_agent,dict):native_agent=native_agent.get('name') or native_agent.get('id')
        if native_agent and native_agent!=cfg['agent']:raise RuntimeError('The existing sandbox uses another agent runtime. Choose a fresh sandbox; nothing was converted.')
        if row.get('model')!=cfg['model']:raise RuntimeError('Native model differs from --model. Configure the intended native route before continuing.')
        if cfg['provider']=='build' and row.get('provider')!='nvidia-prod':raise RuntimeError('Expected the NVIDIA provider nvidia-prod; native configuration was preserved.')
        write_private(receipt,initial)
        env.pop('NVIDIA_INFERENCE_API_KEY',None)
        if cfg['factory']:run([sys.executable,str(ROOT/'deploy/factory/setup.py')],env,cwd=ROOT)
        run(['npm','ci','--ignore-scripts','--no-audit','--no-fund'],env,cwd=ROOT)
        run(['npm','run','browser:prepare'],env,cwd=ROOT)
        run(['npm','run','build'],env,cwd=ROOT)
        run([node,str(ROOT/'deploy/check-portable.mjs')],env,cwd=ROOT,timeout=180)
        logfd=os.open(base/'app.log',os.O_WRONLY|os.O_CREAT|os.O_APPEND,0o600)
        try:child=subprocess.Popen([node,str(ROOT/'server/private-index.mjs')],env=env,cwd=ROOT,stdin=subprocess.DEVNULL,stdout=logfd,stderr=logfd,start_new_session=True)
        finally:os.close(logfd)
        initial['pid']=child.pid;write_private(receipt,initial)
        for attempt in range(15):
            if child.poll() is not None:raise RuntimeError('UI exited. Inspect ./santa-claw logs; no successful deployment is assumed.')
            try:
                with urllib.request.urlopen('http://127.0.0.1:'+str(cfg['port'])+'/santa/api/ready',timeout=40) as response:
                    ready=json.load(response)
                if ready.get('ok'):
                    initial['qualified']=True;write_private(receipt,initial)
                    print('Village: http://127.0.0.1:'+str(cfg['port'])+'/santa/')
                    print('Native dashboard URL (keep its token private):')
                    run(['nemoclaw',cfg['sandbox'],'dashboard-url','--quiet'],env)
                    print('Workshop ready. Camera access from another machine needs authenticated HTTPS.');return
            except (OSError,ValueError):pass
            time.sleep(2)
        raise RuntimeError('UI started but readiness did not pass. Inspect ./santa-claw logs. Saved data is preserved.')

if __name__=='__main__':
    try:main()
    except (RuntimeError,ValueError,AssertionError,subprocess.SubprocessError,OSError) as error:
        print('Santa Claw: '+str(error),file=sys.stderr);sys.exit(1)
