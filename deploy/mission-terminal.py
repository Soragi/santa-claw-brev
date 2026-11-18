#!/usr/bin/env python3
"""Fixed-command operator PTY. Never executes user-supplied commands."""
import base64,fcntl,json,os,pty,select,signal,struct,sys,termios,shutil,subprocess
def resolve_cli():
 override=os.environ.get('SANTA_OPENSHELL_BIN')
 candidates=[override] if override else [os.path.expanduser('~/.local/bin/openshell'),shutil.which('openshell')]
 for candidate in dict.fromkeys(candidates):
  if not candidate or not os.path.isfile(candidate) or not os.access(candidate,os.X_OK):continue
  try:
   result=subprocess.run([candidate,'sandbox','list'],capture_output=True,text=True,timeout=12)
   if result.returncode==0:return candidate
  except (OSError,subprocess.TimeoutExpired):pass
 raise RuntimeError('No compatible OpenShell CLI can list this gateway. Check SANTA_OPENSHELL_BIN and the gateway connection; no permissions were changed.')
def main():
 try:cli=resolve_cli()
 except RuntimeError as error:
  print(json.dumps({'output':base64.b64encode(str(error).encode()).decode()}),flush=True)
  sys.exit(1)
 child,master=pty.fork()
 if child==0:
  size=struct.unpack('HHHH',fcntl.ioctl(0,termios.TIOCGWINSZ,b'\0'*8))
  if not size[0] or not size[1]:fcntl.ioctl(0,termios.TIOCSWINSZ,struct.pack('HHHH',32,110,0,0))
  os.environ['TERM']='xterm-256color'
  os.execvpe(cli,[cli,'term','--theme','dark'],os.environ)
 def stop(*_):
  try:os.killpg(child,signal.SIGTERM)
  except ProcessLookupError:pass
  raise SystemExit(0)
 signal.signal(signal.SIGTERM,stop);signal.signal(signal.SIGINT,stop)
 buffer=b''
 try:
  while True:
   ready,_,_=select.select([master,sys.stdin.buffer],[],[],1)
   if master in ready:
    try:data=os.read(master,16384)
    except OSError:break
    if not data:break
    print(json.dumps({'output':base64.b64encode(data).decode()}),flush=True)
   if sys.stdin.buffer in ready:
    data=os.read(sys.stdin.fileno(),8192)
    if not data:break
    buffer+=data
    if len(buffer)>32768:break
    while b'\n' in buffer:
     line,buffer=buffer.split(b'\n',1)
     try:
      v=json.loads(line)
      if v.get('type')=='input' and isinstance(v.get('data'),str) and len(v['data'])<=4096:os.write(master,v['data'].encode())
      elif v.get('type')=='resize':
       cols,rows=int(v['cols']),int(v['rows'])
       if 20<=cols<=240 and 8<=rows<=100:fcntl.ioctl(master,termios.TIOCSWINSZ,struct.pack('HHHH',rows,cols,0,0))
     except (ValueError,KeyError,TypeError):pass
 finally:
  try:os.close(master)
  except OSError:pass
  try:os.killpg(child,signal.SIGTERM)
  except ProcessLookupError:pass
if __name__=='__main__':main()
