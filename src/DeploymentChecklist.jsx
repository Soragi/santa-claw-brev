import React from 'react';
import {Check} from 'lucide-react';
import './deployment-checklist.css';

export default function DeploymentChecklist({saved,checked,networked,tested}){
 const checks=[
  {complete:saved,done:'Design and configuration saved',pending:'Save your design and configuration'},
  {complete:checked,done:'Current OpenShell checks passed',pending:'Pass the current OpenShell checks'},
  {complete:networked,done:'External request blocked, approved and retried',pending:'Try an external request, approve and retry'},
  {complete:tested,done:'A real test completed',pending:'Complete a real agent test'}
 ];
 const completed=checks.filter(check=>check.complete).length;
 return <section className="deployment-readiness" aria-labelledby="deployment-readiness-heading">
  <header className="readiness-heading"><h3 id="deployment-readiness-heading">Ready for your village?</h3><span className={'readiness-summary'+(completed===4?' is-complete':'')} role="status">{completed} of 4 complete</span></header>
  <ul className="readiness-checks">{checks.map((check,index)=><li key={index} className={check.complete?'is-complete':'is-pending'}><span className="readiness-icon" aria-hidden="true">{check.complete?<Check size={19} strokeWidth={3}/>:index+1}</span><strong>{check.complete?check.done:check.pending}</strong><span className="readiness-state">{check.complete?'Complete':'To do'}</span></li>)}</ul>
 </section>;
}
