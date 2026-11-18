#!/usr/bin/env python3
"""Private installer progress; no credentials, history, or model responses."""
import json, os, sys, tempfile, time

def verify(value, root, sandbox, reuse):
    if value.get('root') != root or value.get('sandbox') != sandbox:
        raise ValueError('A different Santa installation owns this receipt. Use its release path.')
    if not reuse and value.get('nativeOwned') is not True:
        raise ValueError('This receipt does not own the native runtime. Rerun with --reuse-existing; no native changes were made.')

def main():
    action, file, root, sandbox, reuse = sys.argv[1:6]
    if action == 'verify':
        with open(file) as f: verify(json.load(f), root, sandbox, reuse == '1')
    elif action == 'write':
        phase = sys.argv[6]
        with open(os.path.join(root, 'package.json')) as f: release = json.load(f)['version']
        fd, temp = tempfile.mkstemp(dir=os.path.dirname(file))
        os.fchmod(fd, 0o600)
        with os.fdopen(fd, 'w') as f:
            json.dump(dict(schema=1,root=root,sandbox=sandbox,nativeOwned=reuse!='1',phase=phase,release=release,updatedAt=int(time.time())),f)
        os.replace(temp,file)
    else: raise ValueError('Unknown receipt action')

if __name__ == '__main__':
    try: main()
    except (ValueError, OSError, KeyError) as e: raise SystemExit(str(e))
