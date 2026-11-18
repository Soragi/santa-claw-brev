#!/usr/bin/env python3
"""Install bounded CAD worker; never starts the app or native runtime itself."""
import pathlib, platform, subprocess, sys
root=pathlib.Path(__file__).resolve().parent
if platform.system()!='Linux':sys.exit('Factory service deployment requires Linux ARM64/x86_64; use Brev or GB10. No Mac service was deployed.')
subprocess.run(['docker','build','--tag','santa-claw-factory:1',str(root)],check=True)
subprocess.run(['docker','run','--rm','--network','none','--read-only','--tmpfs','/tmp','santa-claw-factory:1','python','-c','import cadquery,trimesh,PIL,networkx,scipy; print("CAD worker dependencies ready")'],check=True)
