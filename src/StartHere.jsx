import React,{useState} from 'react';import {Check,X,ArrowRight} from 'lucide-react';import {startSteps} from './start-here.mjs';
// First-run path across the four tabs. Progress comes from real state; only the dismissal is stored in the browser.
const KEY='santa-start-here-dismissed';
const read=()=>{try{return localStorage.getItem(KEY)==='1';}catch{return false;}};
export default function StartHere({data,onGo}){const [hidden,setHidden]=useState(read);const steps=startSteps(data),next=steps.find(s=>!s.done);
 if(hidden||!next)return null;
 const dismiss=()=>{setHidden(true);try{localStorage.setItem(KEY,'1');}catch{}};
 return <nav className="start-here" aria-label="Start here"><strong>Start here</strong><ol>{steps.map(s=><li key={s.id} className={s.done?'done':s===next?'next':''}>{s.done?<Check size={13} aria-hidden="true"/>:<span aria-hidden="true">{steps.indexOf(s)+1}</span>}{s.label}{s.done&&<span className="sr-only"> (done)</span>}</li>)}</ol><button className="start-here-go" onClick={()=>onGo(next.page)}>{next.label}<ArrowRight size={14}/></button><button className="icon" aria-label="Hide start here" onClick={dismiss}><X size={14}/></button></nav>;}
