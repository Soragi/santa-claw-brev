# SANTA_HERMES_WORKER: executed only inside the selected OpenShell sandbox.
import contextlib, inspect, json, os, pathlib, signal, sys, time
runtime_stage='validation'


def native_model_options(model, endpoint, parameters):
    options={'max_tokens':4096}
    if endpoint=='https://integrate.api.nvidia.com/v1' and str(model).startswith('nvidia/nemotron'):
        options['max_tokens']=8192
        if 'reasoning_config' in parameters:options['reasoning_config']={'enabled':False}
        if 'request_overrides' in parameters:options['request_overrides']={'temperature':0,'extra_body':{'chat_template_kwargs':{'enable_thinking':False}}}
    return options

def turn_failure_info(result):
    import re
    text=str(result.get('error') or result.get('final_response') or '')+' '+str(result.get('failure_reason') or '')
    rules=[('output_limit',r'truncat|max.?tokens|output.*limit|finish.reason.*length'),('context_limit',r'context.*(?:limit|overflow|length)|compaction.*exhaust'),('rate_limit',r'rate.?limit|429|TooManyRequests'),('provider_auth',r'authentication|unauthoriz|401|credential'),('timeout',r'time.?out|timed out'),('malformed_tool_call',r'(?:tool.*(?:invalid|malform|json)|json.*tool)'),('invalid_response',r'invalid API response|empty API response'),('iteration_limit',r'max.*(?:iteration|turn)|iteration.*(?:limit|exhaust)'),('provider_rejected',r'BadRequest|HTTP.?400')]
    cause='native_interrupted' if result.get('interrupted') else next((name for name,pattern in rules if re.search(pattern,text,re.I)), 'incomplete_turn')
    assistant=next((m for m in reversed(result.get('messages') or []) if isinstance(m,dict) and m.get('role')=='assistant'),{})
    finish=assistant.get('finish_reason');finish=finish if finish in ['stop','tool_calls','length','content_filter'] else 'unknown'
    calls=result.get('api_calls');calls=calls if isinstance(calls,int) and 0<=calls<=1000 else None
    return {'cause':cause,'completed':bool(result.get('completed')),'interrupted':bool(result.get('interrupted')),'apiCalls':calls,'finishReason':finish,'reasoningCharacters':min(1000000,len(str(assistant.get('reasoning_content') or '')))}


def redacted_native_diagnostic(value):
    import re
    text=str(value or '')
    if 'PRIVATE KEY' in text:return '[private key omitted]'
    text=re.sub(r'(?:nvapi-|sk-|ghp_|gho_|github_pat_)[A-Za-z0-9_-]{12,}|[a-fA-F0-9]{40,}|\b[0-9]{7,14}:[A-Za-z0-9_-]{25,}|Bearer\s+[^\s\"\']+', '[redacted]',text,flags=re.I)
    text=re.sub(r'(https?://)[^/\s]*@',r'\1[redacted]@',text)
    return text[:1400]

def private_failure_detail(result):
    rows=[]
    for message in (result.get('messages') or [])[-14:]:
        if not isinstance(message,dict):continue
        if message.get('role')=='tool':
            raw=message.get('content','')
            try:
                parsed=json.loads(raw)
                if isinstance(parsed,dict):raw=parsed.get('error') or parsed.get('output') or raw
            except (ValueError,TypeError):pass
            rows.append({'role':'tool','name':message.get('name') or message.get('tool_name'),'diagnostic':redacted_native_diagnostic(raw)})
        elif message.get('role')=='assistant' and message.get('tool_calls'):
            rows.append({'role':'assistant','toolNames':[call.get('function',{}).get('name') for call in message['tool_calls'] if isinstance(call,dict)]})
    return {'error':redacted_native_diagnostic(result.get('error') or result.get('final_response')),'steps':rows}

def fail_native_turn(home,session,result):
    info=turn_failure_info(result);file=home/(session+'.failure.json');file.write_text(json.dumps(info));file.chmod(0o600)
    detail=home/(session+'.failure-detail.json');detail.write_text(json.dumps(private_failure_detail(result)));detail.chmod(0o600)
    error=RuntimeError('Hermes turn did not complete; inspect saved work.');error.hermes_cause=info['cause'];raise error


class FactoryTools:
    """Expose the existing scoped MCP service without shell quoting or credential disclosure."""
    def __init__(self, root, enabled, invoke=None, now=time.monotonic, pause=time.sleep):
        self.schemas=[];self.names=set();self.now=now;self.pause=pause
        self.directory=root.parent/'factory';self.config=self.directory/(root.name.removeprefix('workspace-')+'.json')
        self.invoke=invoke or self._invoke
        if not enabled or not (root/'FACTORY_CONNECTOR.md').is_file() or not self.config.is_file():return
        reply=self.invoke(['list']);tools=reply.get('result',{}).get('tools',[])
        for tool in tools:
            name=tool.get('name','')
            import re
            if not re.fullmatch(r'[a-z][a-z0-9_]{0,63}',name) or name in {'approve_package','terminal','read_file','write_file','search_files','patch','web_extract','process_manage'}:continue
            self.names.add(name);self.schemas.append({'type':'function','function':{'name':name,'description':tool.get('description','Factory MCP tool'),'parameters':tool.get('inputSchema',{'type':'object','properties':{}})}})
    def _invoke(self, args):
        import subprocess
        reply=subprocess.run(['/usr/local/bin/node',str(self.directory/'factory-mcp.cjs'),str(self.config),*args],capture_output=True,text=True,timeout=50)
        if reply.returncode:raise RuntimeError('Factory MCP connector unavailable. Check the active attempt and role permissions.')
        return json.loads(reply.stdout)
    def call(self, name, arguments):
        if name not in self.names:raise ValueError('Factory tool is not permitted for this role.')
        reply=self.invoke(['call',name,json.dumps(arguments)]);result=reply.get('result')
        if reply.get('error') or not isinstance(result,dict):return json.dumps({'error':'Factory MCP request failed.'})
        if result.get('isError'):return json.dumps({'error':' '.join(str(c.get('text','')) for c in result.get('content',[]))})
        text='\n'.join(c.get('text','') for c in result.get('content',[]) if c.get('type')=='text') or '{}'
        if name=='job_status':
            deadline=self.now()+45
            while self.now()<deadline:
                try:pending=json.loads(text).get('state') in ('queued','running')
                except (ValueError,AttributeError):break
                if not pending:break
                self.pause(min(1,max(0,deadline-self.now())))
                reply=self.invoke(['call',name,json.dumps(arguments)]);result=reply.get('result',{})
                if reply.get('error') or result.get('isError'):return json.dumps({'error':'Factory job status could not be verified. Read the current job before retrying.'})
                text='\n'.join(c.get('text','') for c in result.get('content',[]) if c.get('type')=='text') or '{}'
        return text

class NetworkTrace:
    """Only URL metadata crosses into village telemetry; never commands or bodies."""
    def __init__(self,home,session,parser_source=''):
        self.file=home/(session+'.network.json');self.events=[];self.parser_source=parser_source
        self.save()
    def save(self):
        temporary=self.file.with_suffix('.tmp')
        temporary.write_text(json.dumps(self.events[-40:]));temporary.chmod(0o600)
        temporary.replace(self.file)
    def begin(self,url,method='GET'):
        from urllib.parse import urlsplit,urlunsplit
        import uuid
        try:
            u=urlsplit(url)
            if u.scheme not in ('http','https') or not u.hostname or u.username or u.password or len(url)>4000 or method not in ('GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'):return []
            event={'key':str(uuid.uuid4()),'at':int(time.time()*1000),'url':urlunsplit((u.scheme,u.netloc,u.path or '/','','')),'queryRedacted':bool(u.query),'method':method,'result':None}
            self.events.append(event);self.events=self.events[-40:];self.save();return [event['key']]
        except ValueError:return []
    def command(self,command):
        import subprocess
        if not self.parser_source or not isinstance(command,str):return []
        code='const module={exports:{}};'+self.parser_source+';let input="";process.stdin.on("data",b=>input+=b);process.stdin.on("end",()=>console.log(JSON.stringify(module.exports.curlIntents(input))));'
        result=subprocess.run(['node','-e',code],input=command,text=True,capture_output=True,timeout=5,check=True)
        values=json.loads(result.stdout);keys=[]
        for value in values[:12]:keys+=self.begin(value.get('url',''),value.get('method','GET'))
        return keys
    def finish(self,keys,status=None,error=False):
        for event in self.events:
            if event['key'] in keys:event['result']={'at':int(time.time()*1000),'status':status if isinstance(status,int) and 100<=status<=599 else None,'error':bool(error)}
        self.save()

def allowed_names(flags):
    return {'read_file','search_files'} | ({'write_file','patch'} if flags.get('files') else set()) | ({'terminal','process_manage'} if flags.get('terminal') else set()) | ({'web_extract'} if flags.get('web') else set())

def session_tool_names(flags, factory):
    names=allowed_names(flags)|factory.names
    return set(factory.names) if factory.names else names

def scoped_file(root, value):
    p=(root/pathlib.Path(value)).resolve()
    if (p!=root and root not in p.parents) or '.hermes' in p.relative_to(root).parts:raise ValueError('File must remain in this Claw workspace, outside runtime state.')
    return p

def run(p):
    global runtime_stage
    import subprocess, re
    root=pathlib.Path(p['workspace']).resolve()
    if not re.fullmatch(r'/sandbox/\.hermes/santa-claw/workspace-(?:sc-[a-f0-9]{12}|santa-(?:manager|reviewer|drafter|postmaster)|main)',str(root)):raise ValueError('Invalid Hermes workspace.')
    session=p['sessionId']
    if not re.fullmatch(r'[a-f0-9-]{36}',session):raise ValueError('Invalid session.')
    root.mkdir(parents=True,exist_ok=True)
    home=root/'.hermes';home.mkdir(mode=0o700,exist_ok=True)
    trace=NetworkTrace(home,session,p.get('networkIntentSource',''))
    # Separate homes prevent cross-Claw memory, configuration and transcript leakage.
    os.environ['HERMES_HOME']=str(home);os.environ['TERMINAL_ENV']='local';os.environ['TERMINAL_CWD']=str(root)
    os.chdir(root)
    sys.path.insert(0,'/opt/hermes')
    import yaml
    # Match the challenge adapters: inference always traverses OpenShell's managed route.
    # No native provider keys or endpoint configuration are copied into worker profiles.
    transport=p.get('inference',{'baseUrl':'https://inference.local/v1','apiKey':'openshell'})
    endpoint=transport['baseUrl'];reference=transport['apiKey']
    if endpoint=='https://integrate.api.nvidia.com/v1':
        if not re.fullmatch(r'openshell:resolve:env:(?:v[0-9]{1,20}|s[a-f0-9]{64})_NVIDIA_INFERENCE_API_KEY',reference):raise ValueError('Native NVIDIA reference missing.')
    elif endpoint!='https://inference.local/v1':
        from urllib.parse import urlsplit
        import ipaddress
        u=urlsplit(endpoint)
        try:private=ipaddress.ip_address(u.hostname).version==4 and any(ipaddress.ip_address(u.hostname) in ipaddress.ip_network(cidr) for cidr in ('10.0.0.0/8','172.16.0.0/12','192.168.0.0/16'))
        except ValueError:private=False
        if u.scheme!='http' or u.hostname not in ('host.openshell.internal','host.docker.internal') and not private or not u.port or u.port<1024 or u.username or u.password or u.query or u.fragment or not re.fullmatch(r'/(?:[A-Za-z0-9_-]+/)*[A-Za-z0-9_-]+',u.path) or not re.fullmatch(r'openshell:resolve:env:(?:v[0-9]{1,20}|s[a-f0-9]{64})_NEMOCLAW_LOCAL_INFERENCE_TOKEN',reference):raise ValueError('Native local inference route is not qualified.')
    elif reference!='openshell':raise ValueError('Unexpected managed-route credential.')
    model={'default':p['model'],'provider':'custom','base_url':endpoint,'api_key':reference}
    endpoint=model['base_url']
    # Runtime-only configuration; no provider credentials are exposed to the host or exports.
    config={'model':model,'agent':{'max_turns':16},'terminal':{'backend':'local','cwd':str(root)},'memory':{'memory_enabled':False,'user_profile_enabled':False},'platform_toolsets':{'cli':['file','terminal','web']},'mcp_servers':{}}
    (home/'config.yaml').write_text(yaml.safe_dump(config));(home/'config.yaml').chmod(0o600)
    factory=FactoryTools(root,p.get('tools',{}).get('terminal',False))
    # Connected Factory roles cannot invoke sibling connectors through a shared shell.
    names=session_tool_names(p.get('tools',{}),factory)
    observed=[]
    runtime_stage='sdk_import'
    import model_tools
    from tools.registry import registry
    original_definitions=model_tools.get_tool_definitions
    original_dispatch=registry.dispatch
    owned_schemas={
        'read_file':{'path':{'type':'string'}},
        'search_files':{},
        'write_file':{'path':{'type':'string'},'content':{'type':'string'}},
        'patch':{'path':{'type':'string'},'old_string':{'type':'string'},'new_string':{'type':'string'}},
        'web_extract':{'url':{'type':'string'}}}
    def definitions(*args,**kwargs):
        native=[t for t in original_definitions(*args,**kwargs) if t.get('function',{}).get('name') in names and t['function']['name'] not in owned_schemas and t['function']['name'] not in factory.names]
        return native+factory.schemas+[{'type':'function','function':{'name':name,'description':'Workshop-scoped '+name+'. Network access remains subject to OpenShell approval.','parameters':{'type':'object','properties':props,'required':list(props),'additionalProperties':False}}} for name,props in owned_schemas.items() if name in names]

    def dispatch(name,args,**kwargs):
        if name not in names:return json.dumps({'error':'Tool not enabled for this Claw.'})
        if name in factory.names:
            observed.append('mcp:'+name)
            try:return factory.call(name,args)
            except Exception:return json.dumps({'error':'Factory MCP call failed. Check the connection and active attempt.'})
        observed.append({'read_file':'read','search_files':'read','write_file':'write','patch':'edit','terminal':'exec','process_manage':'process','web_extract':'web_fetch'}[name])
        pending=[]
        try:
            if name=='read_file':
                f=scoped_file(root,args.get('path',args.get('file_path','')))
                if f.stat().st_size>1000000:raise ValueError('File too large.')
                return json.dumps({'content':f.read_text()})
            if name in ('write_file','patch'):
                f=scoped_file(root,args.get('path',args.get('file_path','')))
                if '.hermes' in f.relative_to(root).parts:raise ValueError('Runtime state is not an output file.')
                if name=='patch' and (not args.get('old_string') or f.read_text().count(args['old_string'])!=1):raise ValueError('Patch must match one exact source occurrence.')
                content=args.get('content','') if name=='write_file' else f.read_text().replace(args['old_string'],args['new_string'],1)
                if not isinstance(content,str) or len(content)>2000000:raise ValueError('Invalid file content.')
                f.parent.mkdir(parents=True,exist_ok=True);f.write_text(content);return json.dumps({'written':str(f)})
            if name=='search_files':
                return json.dumps({'files':[str(f.relative_to(root)) for f in root.rglob('*') if f.is_file() and '.hermes' not in f.parts][:200]})
            if name=='web_extract':
                from urllib.parse import urlsplit
                urls=args.get('urls') or [args.get('url','')]
                if isinstance(urls,str):urls=[urls]
                if len(urls)>3:raise ValueError('At most three URLs per request.')
                results=[]
                for url in urls:
                    u=urlsplit(url)
                    if u.scheme not in ('http','https') or not u.hostname or u.username or u.password:raise ValueError('Invalid URL.')
                    pending=trace.begin(url)
                    result=subprocess.run(['curl','--fail','--silent','--show-error','--max-time','20','--max-filesize','2000000','--write-out','\nSANTA_HTTP_STATUS:%{http_code}',url],capture_output=True,timeout=22)
                    body,separator,code=result.stdout.rpartition(b'\nSANTA_HTTP_STATUS:')
                    status=int(code) if separator and code.isdigit() else None
                    trace.finish(pending,status,result.returncode!=0);pending=[]
                    results.append({'url':url,'text':(body if separator else result.stdout)[:250000].decode(errors='replace'),'ok':result.returncode==0,'status':status})
                return json.dumps({'results':results})
            if name=='terminal':pending=trace.command(args.get('command',''))
            value=original_dispatch(name,args,**kwargs)
            status=None;failed=False
            try:
                parsed=json.loads(value);failed=bool(parsed.get('error'))
                match=re.search(r'SANTA_HTTP_STATUS:(\d{3})',str(parsed.get('output',parsed.get('content',''))))
                if match:status=int(match[1])
            except (ValueError,TypeError,AttributeError):pass
            trace.finish(pending,status,failed)
            return value
        except Exception as error:
            trace.finish(pending,error=True)
            return json.dumps({'error':str(error)[:300]})
    # Register adapter-owned file/HTTP handlers in this fresh worker process.
    # This avoids giving file-only Claws a terminal or requiring a third-party web-tool key.
    for name,props in owned_schemas.items():
        if name in names:
            schema={'name':name,'description':'Workshop-scoped '+name,'parameters':{'type':'object','properties':props,'required':list(props),'additionalProperties':False}}
            registry.register(name=name,toolset='web' if name=='web_extract' else 'file',schema=schema,handler=lambda args,_name=name,**kwargs:dispatch(_name,args,**kwargs),check_fn=lambda:True,override=True)
    for item in factory.schemas:
        f=item['function'];name=f['name']
        registry.register(name=name,toolset='terminal',schema=f,handler=lambda args,_name=name,**kwargs:dispatch(_name,args,**kwargs),check_fn=lambda:True,override=True)
    model_tools.get_tool_definitions=definitions;registry.dispatch=dispatch

    from run_agent import AIAgent
    required={'enabled_toolsets','session_id','ephemeral_system_prompt','api_mode'}
    if not required.issubset(inspect.signature(AIAgent).parameters):raise RuntimeError('Installed Hermes SDK does not meet the Santa adapter contract.')
    context='\n\n'.join((root/f).read_text() for f in ['AGENTS.md','SOUL.md','KNOWLEDGE.md','SKILLS.md','FACTORY_CONNECTOR.md'] if (root/f).exists())
    if factory.names:context+='\nFACTORY MCP: Your authorized role tools are directly available as function tools. The overall User task describes the team goal, not your individual scope. Perform ONLY the Santa assignment for your own role, then return your actual result. Santa dispatches the other specialists after you return; their unavailable tools or unfinished future steps are not your failure. Shared MCP state is the deliverable. Do not inspect or save a local output directory, report, or predecessor file; all necessary CAD evidence is available through your MCP tools. Use these tools exclusively for Factory operations. Raw terminal/process and workspace file tools are disabled for connected Factory roles to prevent invoking sibling connectors. Do not perform another role’s work or discover other agents. Their results are already unwrapped JSON. Keep the model as the source of truth. Do not create redundant local report files unless the user explicitly requests one; return a concise final report after the required MCP operations. Never approve a design yourself.'
    # The app owns delegation and human approval; native tools cannot self-expand the roster.
    runtime_stage='agent_initialization'
    agent=AIAgent(provider='custom',base_url=endpoint,api_key=model.get('api_key') or 'openshell',model=p['model'],api_mode='chat_completions',max_iterations=16,enabled_toolsets=['file','terminal','web'],disabled_toolsets=['delegation','memory','skills','context_engine','connections','code_execution','browser','cronjob'],session_id=session,quiet_mode=True,ephemeral_system_prompt=context,**native_model_options(p['model'],endpoint,inspect.signature(AIAgent).parameters))
    agent.tools=[t for t in agent.tools if t.get('function',{}).get('name') in names];agent.valid_tool_names={t['function']['name'] for t in agent.tools}
    history_file=home/(session+'.json')
    history=json.loads(history_file.read_text()) if history_file.exists() else []
    if len(json.dumps(history))>180000:history=[]
    runtime_stage='model_turn'
    result=agent.run_conversation(p['prompt'],conversation_history=history)
    if result.get('interrupted') or result.get('error') or not result.get('completed'):fail_native_turn(home,session,result)
    text=result.get('final_response','')
    if not text.strip():raise RuntimeError('Hermes returned no final response.')
    runtime_stage='history'
    history_file.write_text(json.dumps(result.get('messages',[])));history_file.chmod(0o600)
    return {'text':text,'tools':observed[-40:]}

if __name__=='__main__':
    try:
        payload=json.load(sys.stdin)
        os.setsid()
        pidfile=pathlib.Path(payload['workspace'])/'.hermes'/('running-'+payload['sessionId']+'.json')
        pidfile.parent.mkdir(parents=True,exist_ok=True,mode=0o700)
        pidfile.write_text(json.dumps({'pid':os.getpid()}));pidfile.chmod(0o600)
        with contextlib.redirect_stdout(sys.stderr):value=run(payload)
        pidfile.unlink(missing_ok=True)
        print('SANTA_HERMES_RESULT:'+json.dumps(value))
    except Exception as error:
        print('SANTA_HERMES_FAILURE:'+json.dumps({'stage':runtime_stage,'errorType':type(error).__name__,'cause':getattr(error,'hermes_cause','unknown')}),file=sys.stderr)
        print('Hermes runtime execution failed; native compatibility or inference needs attention.',file=sys.stderr);sys.exit(1)
