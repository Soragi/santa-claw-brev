import{bulkMethods}from'./bulk-delivery.mjs';
import{permissionCatalog,factsFor,authoredPrompt,scopeReasonCorrect,boundaryReasonCorrect}from'./assessment.mjs';
import{containsSecret}from'../security.mjs';
const fail=message=>{throw Object.assign(Error(message),{status:409});};
export const requiredMailScopes=['read_inbox','triage_letter','save_draft','send_approved_reply'];
export function initializeStaged(office){
 const db=office.db;
 for(const[name,type]of [['trainingStarted','INTEGER'],['pausedAt','INTEGER'],['arrivalsStopped','INTEGER NOT NULL DEFAULT 0']])if(!db.prepare('PRAGMA table_info(challenge_attempts)').all().some(c=>c.name===name))db.exec('ALTER TABLE challenge_attempts ADD COLUMN '+name+' '+type);
 if(!db.prepare('PRAGMA table_info(challenge_learning_samples)').all().some(c=>c.name==='arrived'))db.exec('ALTER TABLE challenge_learning_samples ADD COLUMN arrived INTEGER');
 db.exec(`CREATE TABLE IF NOT EXISTS challenge_learning_quiz(attempt TEXT PRIMARY KEY,selections TEXT NOT NULL,correct INTEGER NOT NULL,tries INTEGER NOT NULL,created INTEGER NOT NULL);`);
}
export const stagedMethods={
 ...bulkMethods,
 upgradePressureClock(){const a=this.current();if(!a||a.rulesVersion!==5||!['active','paused'].includes(a.state))return;this.db.prepare('UPDATE challenge_attempts SET rulesVersion=6,lastArrival=?,pausedAt=? WHERE id=?').run(this.now(),a.state==='paused'?this.now():null,a.id);this.log(a.id,'learning.clock_upgraded','Five-second mailbox clock enabled from this update. Existing checkpoint, letters and judgments are preserved; an explicit pause stays paused.');},

 upgradeStagedAttempt(){
  const a=this.current();if(!a||a.rulesVersion!==4||!['active','paused','failed'].includes(a.state))return;
  if(this.db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='missions'").get()&&this.db.prepare("SELECT id FROM missions WHERE state IN ('queued','planning','working','reviewing','synthesizing','waiting_approval','stopping') LIMIT 1").get())return;
  const {capability,...b}=this.binding();
  this.tx(()=>{this.db.prepare("UPDATE challenge_attempts SET state='archived',binding=? WHERE id=?").run(JSON.stringify({...b,automatic:false}),a.id);this.log(a.id,'learning.upgraded','Earlier review examples and mailbox preserved as read-only history for the staged lesson update.');const id=this.newAttempt(a.session,'paused',5);this.db.prepare('UPDATE challenge_attempts SET binding=? WHERE id=?').run(JSON.stringify({suggestedProject:b.project,suggestedPlaybook:b.playbook}),id);this.log(id,'learning.flow_upgraded','Updated lesson ready. Previous mail and reviews are saved in history; the original agent checkpoint is unchanged.');});
 },
 stagedMode(attempt=this.current()?.id){return !!attempt&&this.db.prepare('SELECT rulesVersion FROM challenge_attempts WHERE id=?').get(attempt)?.rulesVersion>=5;},
 permissionQuiz(attempt=this.current()?.id){
  const q=this.db.prepare('SELECT * FROM challenge_learning_quiz WHERE attempt=?').get(attempt),selections=q?JSON.parse(q.selections):[];
  return {submitted:!!q,correct:!!q?.correct,tries:q?.tries||0,selections,points:q?.correct?15:0,max:15,options:permissionCatalog.map(t=>({...t,label:t.name==='send_approved_reply'?'Dispatch replies after deployment':t.name==='request_approval'?'Ask for per-message human review':t.label,...(q?{selected:selections.includes(t.name),needed:requiredMailScopes.includes(t.name),correct:selections.includes(t.name)===requiredMailScopes.includes(t.name)}:{})}))};
 },
 submitPermissionQuiz({selections,reasons={}}){
  this.tick();const a=this.current(),b=this.binding();
  if(!a||!this.stagedMode(a.id)||!['active','paused'].includes(a.state)||!b.project)fail('Configure your communication agent first.');
  if(this.deployment()?.phase==='calibrating'||this.autonomous())fail('Pause and reconnect the agent before changing a deployed permission plan.');
  if(!Array.isArray(selections)||new Set(selections).size!==selections.length||selections.some(s=>!permissionCatalog.some(t=>t.name===s)))fail('Select permissions from the quiz.');
  if(containsSecret(JSON.stringify(reasons)))fail('Credentials do not belong in permission explanations.');
  const correct=requiredMailScopes.every(s=>selections.includes(s))&&selections.length===requiredMailScopes.length;
  this.tx(()=>{
   this.db.prepare('INSERT INTO challenge_learning_quiz VALUES(?,?,?,?,?) ON CONFLICT(attempt)DO UPDATE SET selections=excluded.selections,correct=excluded.correct,tries=tries+1,created=excluded.created').run(a.id,JSON.stringify(selections),correct?1:0,1,this.now());
   this.db.prepare('UPDATE challenge_attempts SET binding=? WHERE id=?').run(JSON.stringify({...b,scopes:correct?requiredMailScopes:['read_inbox'],permissionReasons:reasons}),a.id);
   this.log(a.id,'learning.permissions',correct?'MCP quiz correct. Full 15 points awarded; training can start.':'MCP quiz needs changes. Add or remove permissions and retry for full credit.');
  });return this.snapshot();
 },
 startTraining(){
  this.tick();const a=this.current(),b=this.binding();if(!a||!this.stagedMode(a.id)||!['active','paused'].includes(a.state)||!b.project||!this.permissionQuiz(a.id).correct)fail('Configure the agent and pass the MCP access quiz before training.');
  if(a.arrivalsStopped)fail('Arrivals are closed for this deployment. Reset the checkpoint to start a new mailbox.');
  if(!a.trainingStarted){this.db.prepare("UPDATE challenge_attempts SET state='active',trainingStarted=?,lastArrival=?,pausedAt=NULL WHERE id=?").run(this.now(),a.rulesVersion>=6&&a.state==='active'?a.lastArrival:this.now(),a.id);this.log(a.id,'learning.training_started','Training started. The first review letter arrives in five seconds.');}
  return this.snapshot();
 },
 stagedArrival(a,n){
  if(n>=10)return null;
  const sample=this.db.prepare('SELECT * FROM challenge_learning_samples WHERE attempt=? AND ordinal=?').get(a.id,n),source=JSON.parse(sample.source),expected=factsFor(source).gift?'gift':source.name==='Leo'?'thanks':'question';
  return {id:sample.id,source,expected};
 },
 stagedFlow(attempt=this.current()?.id){
  const a=this.db.prepare('SELECT * FROM challenge_attempts WHERE id=?').get(attempt),b=JSON.parse(a.binding),q=this.permissionQuiz(attempt),d=this.deployment(attempt),letters=this.viewLetters(attempt),receipts=this.db.prepare('SELECT * FROM challenge_receipts WHERE attempt=?').all(attempt),sent=new Set(receipts.map(r=>r.letter));
  const held=letters.filter(l=>!sent.has(l.id)&&((l.duplicateOf&&l.category==='duplicate')||(!l.address&&l.category==='needs_review'))),replyable=letters.filter(l=>l.address&&!l.duplicateOf),delivered=replyable.filter(l=>sent.has(l.id)).length,cleared=letters.length>=10&&letters.every(l=>sent.has(l.id)||held.some(h=>h.id===l.id));
  const stage=a.state==='completed'||!!this.db.prepare("SELECT seq FROM challenge_events WHERE attempt=? AND type='challenge.completed' LIMIT 1").get(attempt)?'completed':a.arrivalsStopped?'dispatch':!b.project?'configure':!q.correct?'permissions':a.trainingStarted?'training':'permissions';
  return {stage,bulkSent:receipts.filter(r=>r.approvalMode==='workshop_bulk').length,bulkAvailable:this.bulkAvailable(attempt),bulkFinishing:!!b.bulkFinishing,upgradeNotice:this.db.prepare("SELECT message FROM challenge_events WHERE attempt=? AND type='learning.flow_upgraded' LIMIT 1").get(attempt)?.message,quiz:q,trainingStarted:!!a.trainingStarted,arrivalsStopped:!!a.arrivalsStopped,trainingArrived:this.trainingSamples(attempt).length,delivered,replyable:replyable.length,held:held.length,remaining:letters.length-receipts.length-held.length,cleared,deployed:!!d};
 },
 stagedScore(attempt){
  const state=this.learningState(attempt),flow=this.stagedFlow(attempt),a=this.db.prepare('SELECT * FROM challenge_attempts WHERE id=?').get(attempt),b=JSON.parse(a.binding),d=this.deployment(attempt),verified=d?.phase==='active'&&d.report?.afterCorrect>=5&&(this.current()?.id!==attempt||this.deploymentMatches(d));
  const first=new Map();for(const r of this.db.prepare('SELECT * FROM challenge_learning_reviews WHERE attempt=? ORDER BY rowid').all(attempt))if(!first.has(r.sample))first.set(r.sample,r);
  const reviewBonus=[...first.values()].filter(r=>r.bonus).length,scopeBonus=Math.round(5*requiredMailScopes.filter(s=>s==='send_approved_reply'?/send|deliver|dispatch/i.test(b.permissionReasons?.[s]||'')&&/deploy|authoriz|source[- ]check/i.test(b.permissionReasons?.[s]||''):scopeReasonCorrect(s,b.permissionReasons?.[s])).length/4),trials=new Map();for(const t of this.db.prepare('SELECT * FROM challenge_permission_trials WHERE attempt=? ORDER BY rowid').all(attempt))trials.set(t.scenario,t);
  const labBonus=Math.round(5*['inbox','dispatch','approval'].filter(id=>trials.get(id)?.correct&&boundaryReasonCorrect(id,trials.get(id).reason)).length/3);
  const rows=[{name:'Your authored agent prompt',points:authoredPrompt(b.playbook)?5:0,max:5},{name:'MCP access quiz · retries count',points:flow.quiz.points,max:15},{name:'Correct Approve / Reject decisions',points:3*(state.approvedCorrect+state.rejectedIncorrect),max:30},{name:'Ten incoming letters analysed',points:state.reviewed,max:10},{name:'Local model verification',points:verified?10:0,max:10},{name:'Mailbox delivered',points:flow.replyable?Math.round(10*flow.delivered/flow.replyable):0,max:10},{name:'Optional MCP explanations',points:scopeBonus+labBonus,max:10},{name:'Optional review explanations',points:reviewBonus,max:10}];
  const total=rows.reduce((n,r)=>n+r.points,0),bonusTotal=scopeBonus+labBonus+reviewBonus;
  return {total,max:100,rows,baseTotal:total-bonusTotal,baseMax:80,bonusTotal,bonusMax:20,explanationBonuses:true,reviewedMessages:state.reviewed,requiredReviews:10,caughtMistakes:state.rejectedIncorrect,requiredCaught:5,cleanReviews:state.approvedCorrect,delivered:flow.delivered,permissionTests:flow.quiz.correct?1:0,passed:!a.failureReason&&state.ready&&flow.quiz.correct&&verified&&flow.arrivalsStopped&&flow.cleared&&total>=80};
 },
 completeStaged(attempt){
  const a=this.current();if(a?.id!==attempt||a.state!=='active'||!a.arrivalsStopped||!this.stagedScore(attempt).passed)return;
  const b=this.binding();this.db.prepare("UPDATE challenge_attempts SET state='completed',binding=? WHERE id=?").run(JSON.stringify({...b,automatic:false}),attempt);
  this.log(attempt,'challenge.completed','Challenge 1 completed. All replyable letters were sent; duplicate or missing-address mail was safely resolved. Arrivals remain closed.');
 }
};
