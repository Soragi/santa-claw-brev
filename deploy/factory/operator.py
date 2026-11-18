#!/usr/bin/env python3
"""Host-only judging / physical print handoff. Never exposed through agent MCP."""
import argparse,json,sqlite3,pathlib,time
p=argparse.ArgumentParser(description=__doc__);p.add_argument('--data',required=True,help='Santa Claw private data directory');p.add_argument('action',choices=['queue','release','score']);p.add_argument('--submission');p.add_argument('--engineering',type=int);p.add_argument('--workflow',type=int);p.add_argument('--design',type=int);p.add_argument('--security',type=int);p.add_argument('--confirm',help='For release: PRINT HANDOFF')
a=p.parse_args();dbfile=pathlib.Path(a.data)/'workshop.sqlite'
if not dbfile.is_file():p.error('Existing workshop database required.')
with sqlite3.connect(dbfile) as db:
 db.execute('BEGIN IMMEDIATE');row=db.execute("SELECT value FROM meta WHERE key='open_hackathon'").fetchone()
 if not row:p.error('No factory attempt.')
 s=json.loads(row[0])
 if s.get('kind')!='bauble-factory':p.error('No factory attempt.')
 if a.action!='queue' and s['state']!='paused':p.error('Pause the factory in the UI before operator release or scoring.')
 if a.action=='queue':print(json.dumps(s['receipts'],indent=2))
 elif a.action=='release':
  if a.confirm!='PRINT HANDOFF':p.error('Use --confirm "PRINT HANDOFF" only after reviewing the current package and printer.')
  receipt=next((r for r in s['receipts'] if r['id']==a.submission),None)
  if not receipt or receipt['state']!='queued':p.error('Choose a queued submission.')
  if receipt['revision']!=s['revisions'][-1]['id']:p.error('This submission was superseded by a newer revision.')
  receipt['state']='released';receipt['releasedAt']=int(time.time()*1000);print('Recorded operator handoff. This command does not control a printer.')
 else:
  values={k:getattr(a,k) for k in ['engineering','workflow','design','security']}
  if any(v is None or not 0<=v<=m for (k,v),m in zip(values.items(),[30,30,25,15])):p.error('Supply scores in ranges 30 / 30 / 25 / 15.')
  r=s['revisions'][-1] if s['revisions'] else None
  if not r or not r.get('validation',{}).get('qualified') or not r.get('changeApplied') or not any(x['revision']==r['id'] and x['judged'] for x in s['receipts']):p.error('A print-qualified change-request submission before deadline is required.')
  s['rubric']=values;s['rubricRevision']=r['id'];print('Organizer rubric recorded: '+str(sum(values.values()))+'/100.')
 if a.action!='queue':db.execute("UPDATE meta SET value=? WHERE key='open_hackathon'",(json.dumps(s),))
