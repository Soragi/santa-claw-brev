// Resume only a failed native finalization that already produced an attested CAD
// build in this mission. Never infer completion from model prose or old artifacts.
export function factoryBuildRecovery({state,project,since,error,verifyBuild=()=>false}){
 if(state?.state!=='active'||!Number.isFinite(since)||!/^Hermes model_turn failed \(RuntimeError\)/.test(error?.message||''))return null;
 const binding=state.bindings?.find(b=>b.project===project&&b.role==='builder'),revision=state.revisions?.at(-1);
 if(!binding||!revision?.build||revision.builtBy!==project)return null;
 const job=state.jobs?.find(j=>j.revision===revision.id&&j.agent===project&&j.type==='build'&&j.state==='completed'&&j.createdAt>=since);
 if(!job||!/^[a-f0-9]{64}$/.test(revision.build.geometryHash||''))return null;
 const required=['model.step','model.stl','model.glb','source.py','front.png','side.png','top.png','perspective.png'];
 if(required.some(name=>!revision.build.files?.[name])||!verifyBuild(revision.build,required))return null;
 return {revision:revision.id,job:job.id,geometryHash:revision.build.geometryHash,diameter:revision.design.diameter,initials:revision.design.initials,files:required};
}

// A new revision assigned to the full factory team needs actual build/inspection
// receipts. A fluent narrative or queued job cannot satisfy the requested work.
export function factoryTeamFailures({state,assignedProjects=[],since}){
 const roles=['designer','builder','inspector'].map(role=>state?.bindings?.find(b=>b.role===role&&assignedProjects.includes(b.project)));
 const r=state?.revisions?.at(-1);if(roles.some(r=>!r)||!r||!Number.isFinite(since)||r.createdAt<since)return [];
 const errors=[];if(!r.build||r.builtBy!==roles[1].project||!state.jobs?.some(j=>j.revision===r.id&&j.type==='build'&&j.state==='completed'&&j.agent===roles[1].project))errors.push({name:'Factory CAD build',detail:'The new revision has no completed CAD build receipt from its assigned Builder.'});
 if(!r.validation?.geometryPassed||r.inspectedBy!==roles[2].project||!state.jobs?.some(j=>j.revision===r.id&&j.type==='inspect'&&j.state==='completed'&&j.agent===roles[2].project))errors.push({name:'Factory independent inspection',detail:'The new revision has no passing independent geometry inspection receipt. Print qualification remains a separate gate.'});return errors;
}
