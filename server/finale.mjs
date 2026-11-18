const key='hackathon_finale';
export const finaleDuration=23000;
export class HackathonFinale{
 constructor({db,progress,guard=()=>{},onOpenBuild=()=>{},now=()=>Date.now()}){Object.assign(this,{db,progress,guard,onOpenBuild,now});}
 read(){const r=this.db.prepare('SELECT value FROM meta WHERE key=?').get(key);return r?JSON.parse(r.value):null;}
 save(s){this.db.prepare('INSERT OR REPLACE INTO meta(key,value)VALUES(?,?)').run(key,JSON.stringify(s));return s;}
 snapshot(){let s=this.read();if(s?.state==='delivering'&&this.now()-s.startedAt>=finaleDuration)s=this.save({...s,state:'completed',completedAt:s.startedAt+finaleDuration});const checks=this.progress();return {...(s||{state:checks.every(Boolean)?'ready':'locked'}),checks,duration:finaleDuration,serverNow:this.now(),locked:s?.state==='delivering'};}
 openBuild(){const s=this.snapshot();if(s.state!=='completed')throw Object.assign(Error('Finish the delivery celebration first.'),{status:409});this.onOpenBuild();this.save({...this.read(),openBuild:true});return this.snapshot();}
 start(){const s=this.snapshot();if(this.read())return s;this.guard();if(!s.checks.every(Boolean))throw Object.assign(Error('Successfully complete all three challenges before starting delivery.'),{status:409});this.save({state:'delivering',startedAt:this.now()});return this.snapshot();}
}
export function registerFinale({app,...options}){const f=new HackathonFinale(options);app.get('/santa/api/finale',(_q,r)=>r.json(f.snapshot()));app.post('/santa/api/finale/start',(q,r)=>{if(Object.keys(q.body||{}).length)return r.status(400).json({error:'No delivery options are required.'});r.json(f.start());});app.post('/santa/api/finale/open-build',(_q,r)=>r.json(f.openBuild()));return f;}
