#!/usr/bin/env python3
"""Live offline CAD smoke test on the Linux deployment host (no inference/printing)."""
import json,os,pathlib,subprocess,tempfile,time,platform,sys
if platform.system()!='Linux':sys.exit('Run this check on your Linux Brev or GB10 deployment host.')
image=os.environ.get('SANTA_FACTORY_IMAGE','santa-claw-factory:1')
base={'title':'Smoke ornament','brief':'CPU geometry test','diameter':60,'initials':'','palette':['#76b900','#ffffff'],'decoration':'plain','track':'bauble'}
with tempfile.TemporaryDirectory(prefix='santa-factory-smoke-') as tmp:
 root=pathlib.Path(tmp)
 def run(mode,out,source=None):
  args=['docker','run','--rm','--network','none','--read-only','--cap-drop','ALL','--security-opt','no-new-privileges','--pids-limit','96','--memory','3g','--cpus','1.5','--user',str(os.getuid())+':'+str(os.getgid()),'--tmpfs','/tmp:rw,noexec,nosuid,size=256m','-e','HOME=/tmp','-e','OPENBLAS_NUM_THREADS=1','--mount','type=bind,src='+str(out)+',dst=/job']
  if source:args+=['--mount','type=bind,src='+str(source)+',dst=/input,readonly']
  args += [image,'python','/opt/factory/worker.py',mode]
  subprocess.run(args,check=True,timeout=180)
 for name,design,expected in [('plain',base,True),('changed',{**base,'diameter':54,'initials':'AJ','decoration':'belt'},True),('floating',{**base,'code':'import cadquery as cq\nresult=cq.Workplane("XY").sphere(30).union(cq.Workplane("XY",origin=(80,0,0)).sphere(4))'},False)]:
  started=time.monotonic();out=root/name;out.mkdir();(out/'design.json').write_text(json.dumps(design));run('build',out)
  for f in ['model.step','model.stl','model.glb','model.3mf','front.png','side.png','top.png','perspective.png']:assert (out/f).stat().st_size>100,f
  check=root/(name+'-inspect');check.mkdir();(check/'design.json').write_text(json.dumps(design));run('inspect',check,out);report=json.loads((check/'inspection.json').read_text());assert report['geometryPassed']==expected,report
  print(json.dumps({'case':name,'seconds':round(time.monotonic()-started,2),'geometryPassed':report['geometryPassed'],'checks':report['checks']}),flush=True)
print('Factory CAD live smoke passed; slicer and physical qualification remain separate.')
