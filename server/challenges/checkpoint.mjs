import {randomUUID} from 'node:crypto';
// Configuration checkpoint, not a VM snapshot. Runtime credentials, policy and historical files stay put.
export function captureCheckpoint(db){return {version:1,projects:db.prepare('SELECT * FROM projects WHERE deletedAt IS NULL').all(),checks:db.prepare('SELECT * FROM checks').all(),qualifications:db.prepare('SELECT * FROM agent_qualifications').all(),networkTests:db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workshop_network_tests'").get()?db.prepare("SELECT * FROM workshop_network_tests WHERE state='passed'").all():[]};}
export function restoreCheckpoint(db,checkpoint){
 const columns=db.prepare('PRAGMA table_info(projects)').all().map(c=>c.name),ids=new Set(checkpoint.projects.map(p=>p.id));db.exec('BEGIN IMMEDIATE');try{
  for(const p of db.prepare('SELECT id FROM projects WHERE deletedAt IS NULL').all())if(!ids.has(p.id))db.prepare("UPDATE projects SET hidden=1,deletedAt=? WHERE id=?").run(new Date().toISOString(),p.id);
  for(const saved of checkpoint.projects){const current=db.prepare('SELECT revision FROM projects WHERE id=?').get(saved.id);if(!current)throw Error('A checkpoint Claw record is missing.');const revision=Math.max(current.revision,saved.revision)+1,record={...saved,revision};db.prepare('UPDATE projects SET '+columns.filter(c=>c!=='id').map(c=>c+'=?').join(',')+' WHERE id=?').run(...columns.filter(c=>c!=='id').map(c=>record[c]??null),saved.id);
   if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='challenge_agents'").get())db.prepare('UPDATE challenge_agents SET revision=? WHERE project=? AND revision=?').run(revision,saved.id,saved.revision);
   db.prepare('DELETE FROM checks WHERE project=?').run(saved.id);for(const check of checkpoint.checks.filter(c=>c.project===saved.id)){db.prepare('INSERT INTO checks(id,project,revision,result,created)VALUES(?,?,?,?,?)').run(randomUUID(),saved.id,check.revision===saved.revision?revision:check.revision,check.result,check.created);}
   if(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='workshop_network_tests'").get()){db.prepare('DELETE FROM workshop_network_tests WHERE project=?').run(saved.id);for(const proof of (checkpoint.networkTests||[]).filter(p=>p.project===saved.id)){const row={...proof,id:randomUUID(),revision:proof.revision===saved.revision?revision:proof.revision};const keys=Object.keys(row);db.prepare('INSERT INTO workshop_network_tests('+keys.join(',')+')VALUES('+keys.map(()=>'?').join(',')+')').run(...keys.map(k=>row[k]));}}
   db.prepare('DELETE FROM agent_qualifications WHERE project=?').run(saved.id);for(const q of checkpoint.qualifications.filter(q=>q.project===saved.id))db.prepare('INSERT OR REPLACE INTO agent_qualifications VALUES(?,?,?,?)').run(saved.id,q.revision===saved.revision?revision:q.revision,q.mission,q.runtimeEpoch);
  }
  db.exec('COMMIT');
 }catch(e){db.exec('ROLLBACK');throw e;}
}
