import{test}from'node:test';import assert from'node:assert/strict';import{execFileSync}from'node:child_process';
test('terminal selects a working user-local CLI and fails visibly when the selected CLI is incompatible',()=>{const code=`import importlib.util,unittest.mock as mock,subprocess,sys
sys.dont_write_bytecode=True
spec=importlib.util.spec_from_file_location('mission','deploy/mission-terminal.py')
m=importlib.util.module_from_spec(spec);spec.loader.exec_module(m)
with mock.patch.dict(m.os.environ,{},clear=True),mock.patch.object(m.os.path,'expanduser',return_value='/user/.local/bin/openshell'),mock.patch.object(m.shutil,'which',return_value='/usr/bin/openshell'),mock.patch.object(m.os.path,'isfile',return_value=True),mock.patch.object(m.os,'access',return_value=True),mock.patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],0)) as run:
 assert m.resolve_cli()=='/user/.local/bin/openshell'
 assert run.call_args.args[0]==['/user/.local/bin/openshell','sandbox','list']
with mock.patch.dict(m.os.environ,{'SANTA_OPENSHELL_BIN':'/broken/openshell'},clear=True),mock.patch.object(m.os.path,'isfile',return_value=True),mock.patch.object(m.os,'access',return_value=True),mock.patch.object(m.subprocess,'run',return_value=subprocess.CompletedProcess([],1)):
 try:m.resolve_cli();raise AssertionError('legacy CLI accepted')
 except RuntimeError as e:assert 'No compatible OpenShell CLI' in str(e)
`;execFileSync('python3',['-c',code]);assert.ok(true);});
