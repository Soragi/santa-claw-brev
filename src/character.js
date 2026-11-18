import * as T from 'three';
import {nameplate} from './nameplate.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
export const colors=['#b8f36b','#f27861','#83c8f1','#c2a3ed','#ffc86e','#f49dc3','#e8eef4','#45b9a1'];
export const avatarDefaults={body:'lobster',color:'#b8f36b',accent:'#f27861',hat:'santa',outfit:'scarf',accessory:'none',finish:'satin',eyes:'friendly',size:'regular',bodyWidth:1,clawSize:1,hatScale:1};
export function appearance(a){return {...avatarDefaults,...a,hat:'santa',body:a?.body==='crab'?'lobster':a?.body||'lobster'};}
export function character(raw={},name=''){
 const a=appearance(raw),root=new T.Group(),body=new T.Group();root.add(body);const arms=[],legs=[],eyes=[],mouths=[],materials=[],geometries=[];let editPart='body';
 const finish={satin:[.45,.07],glossy:[.2,.16],metallic:[.27,.7]}[a.finish];
 const skin=new T.MeshStandardMaterial({color:a.color,roughness:finish[0],metalness:finish[1]});materials.push(skin);
 const makeMat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.55,...extra});materials.push(m);return m;};
 const ivory=makeMat('#fff7e7'),dark=makeMat('#172731'),accent=makeMat(a.accent),silver=makeMat('#a9b9c5',{metalness:.6,roughness:.32});
 function add(g,m,pos,parent=body,scale){geometries.push(g);const o=new T.Mesh(g,m);o.position.set(...pos);if(scale)o.scale.set(...scale);o.castShadow=true;o.receiveShadow=true;o.userData.editPart=editPart;o.name=editPart+'-'+geometries.length;parent.add(o);return o;}
 const oval=(p,s,m=skin,parent=body)=>add(new T.SphereGeometry(1,24,18),m,p,parent,s);
 const box=(p,s,m,parent=body)=>add(new RoundedBoxGeometry(...s,3,.055),m,p,parent);
 const tube=(from,to,r,m,parent=body)=>{const u=new T.Vector3(...from),v=new T.Vector3(...to),d=v.clone().sub(u);const o=add(new T.CylinderGeometry(r,r,d.length(),9),m,[...u.clone().add(v).multiplyScalar(.5)],parent);o.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),d.normalize());return o;};
 const robot=a.body==='robot',crab=a.body==='crab';
 if(robot){box([0,1.08,0],[.9,1.02,.65],skin);box([0,1.96,.015],[1.12,.84,.88],ivory);box([0,1.99,.45],[.87,.47,.10],dark);box([0,1.15,.35],[.45,.23,.06],accent);}
 else{oval([0,crab?1.0:1.12,0],crab?[.88,.56,.55]:[.55,.8,.48]);oval([0,1.86,.02],[.61,.56,.51]);oval([0,1.12,.39],[.34,.51,.11],ivory);for(let i=0;i<4;i++){oval([0,.69-i*.1,-.29-i*.19],[.43-i*.06,.15,.22]);}for(const side of [-1,1]){const fan=oval([side*.16,.26,-1.03],[.27,.08,.23]);fan.rotation.y=side*.5;}}
 editPart='eyes';const eyeY=robot?2.02:2.17,eyeZ=robot?.51:.48;
 for(const side of [-1,1]){
  if(!robot){tube([side*.23,1.99,.21],[side*.25,eyeY,.28],.055,skin);oval([side*.25,eyeY,.34],[.17,.19,.15],ivory);}
  const eye=oval([side*.25,eyeY,eyeZ],[a.eyes==='curious'&&side===1?.075:.065,a.eyes==='focused'?.055:.1,.045],robot?accent:dark);eye.userData.baseY=eye.scale.y;eyes.push(eye);
  if(!robot){const pts=[new T.Vector3(side*.43,2.17,.02),new T.Vector3(side*.75,2.43,-.02),new T.Vector3(side*.86,2.66,.08)];add(new T.TubeGeometry(new T.CatmullRomCurve3(pts),16,.045,8,false),skin,[0,0,0]);oval(pts[0].toArray(),[.065,.065,.065],skin);oval(pts.at(-1).toArray(),[.055,.055,.055],skin);}
  editPart='body';const arm=new T.Group();arm.position.set(side*(crab?.8:.51),1.42,0);body.add(arm);arms.push(arm);oval([0,0,0],[.18,.18,.18],robot?silver:skin,arm);
  oval([side*.25,-.05,.08],[.31,.13,.16],robot?silver:skin,arm);
  const claw=new T.Group();claw.position.set(side*.53,.03,.14);claw.rotation.z=-side*.22;claw.scale.setScalar(a.clawSize);arm.add(claw);
  oval([0,.05,0],[.32,.36,.23],skin,claw);
  for(const s of [-1,1]){const finger=oval([s*.18,.34,0],[.135,.32,.18],skin,claw);finger.rotation.z=-s*.25;}
  for(let i=0;i<(crab?3:2);i++){const leg=new T.Group();leg.position.set(side*(crab?.61:.28),.61,-.08-i*.24);body.add(leg);legs.push(leg);oval([0,0,0],[.15,.15,.15],robot?silver:skin,leg);tube([0,0,0],[side*.15,-.33,.12],.11,robot?silver:skin,leg);oval([side*.15,-.35,.14],[.14,.14,.15],robot?silver:skin,leg);box([side*.15,-.49,.2],[.24,.2,.43],robot?dark:skin,leg);}
 }
 const mouth=box([0,robot?1.8:1.83,robot?.50:.515],[.2,.04,.065],dark);mouths.push(mouth);
 editPart='outfit';if(a.outfit==='scarf'){add(new T.TorusGeometry(.51,.12,10,36),accent,[0,1.58,0]).rotation.x=Math.PI/2;const tail=box([.25,1.15,.48],[.22,.7,.11],accent);tail.rotation.z=-.15;}
 if(a.outfit==='jacket'){box([0,1.04,.07],[1.03,.71,.81],accent);box([0,1.05,.474],[.045,.61,.055],silver);for(const side of [-1,1])box([side*.3,.98,.475],[.19,.13,.07],ivory);}
 if(a.outfit==='overalls'){box([0,.91,.08],[.91,.57,.81],accent);for(const side of [-1,1]){box([side*.32,1.33,.4],[.12,.5,.1],accent);oval([side*.32,1.12,.47],[.045,.045,.03],silver);}box([0,.93,.481],[.28,.2,.075],skin);}
 editPart='hat';const hat=new T.Group();hat.scale.set(a.hatScale,a.hatScale,a.hatScale*.86);hat.position.set(0,robot?2.38:2.43,robot?.015:.02);body.add(hat);
 if(a.hat==='santa'){add(new T.CylinderGeometry(.62,.62,.17,32),ivory,[0,0,0],hat);const profile=[[0,.045],[.57,.045],[.565,.10],[.50,.25],[.40,.45],[.29,.65],[.17,.82],[.07,.96],[0,1.0]].map(([r,y])=>new T.Vector2(r,y));const cap=add(new T.LatheGeometry(profile,48),makeMat('#cf3946'),[0,0,0],hat);cap.name='santa-cap';const pom=oval([0,1.02,0],[.17,.17,.17],ivory,hat);pom.name='santa-pom';hat.name='santa-hat';if(name.trim()){const label=add(nameplate(name),dark,[0,0,0],hat);label.name='hat-name';label.userData.name=name;}}
 if(a.hat==='beanie'){oval([0,.19,0],[.64,.38,.52],accent,hat);add(new T.TorusGeometry(.51,.1,8,32),accent,[0,.02,0],hat).rotation.x=Math.PI/2;oval([0,.56,0],[.15,.15,.15],ivory,hat);}
 if(a.hat==='antlers'){for(const s of [-1,1]){tube([s*.34,0,0],[s*.67,.85,0],.065,makeMat('#bd8a59'),hat);tube([s*.49,.4,0],[s*.9,.62,.02],.045,makeMat('#bd8a59'),hat);tube([s*.61,.7,0],[s*.4,.95,0],.045,makeMat('#bd8a59'),hat);}}
 if(a.hat==='cap'){oval([0,.15,0],[.64,.3,.52],accent,hat);box([0,-.02,.4],[1.14,.1,.75],accent,hat);}
 if(a.hat==='crown'){add(new T.CylinderGeometry(.57,.57,.24,24,true),makeMat('#efbf59',{metalness:.6,roughness:.25}),[0,.13,0],hat);for(let i=0;i<5;i++){const ang=i/5*Math.PI*2;add(new T.ConeGeometry(.13,.34,4),accent,[Math.cos(ang)*.5,.39,Math.sin(ang)*.5],hat);}}
 editPart='accessory';if(a.accessory==='glasses'){for(const s of [-1,1])add(new T.TorusGeometry(.2,.035,9,24),dark,[s*.25,eyeY,eyeZ+.08]);tube([-.08,eyeY,eyeZ+.08],[.08,eyeY,eyeZ+.08],.045,dark);for(const side of [-1,1])tube([side*.45,eyeY,eyeZ+.08],[side*.45,eyeY-.05,.20],.045,dark);}
 if(a.accessory==='headphones'){for(const s of [-1,1])oval([s*.62,2.0,0],[.15,.31,.28],accent);const arc=add(new T.TorusGeometry(.65,.065,9,32,Math.PI),dark,[0,2.0,0]);tube([.65,1.93,0],[.55,1.63,.6],.035,dark);oval([.5,1.63,.61],[.1,.07,.07],dark);}
 if(a.accessory==='backpack'){box([0,1.22,-.49],[.7,.8,.46],accent);box([0,1.08,-.73],[.48,.3,.14],skin);}
 if(a.accessory==='halo'){const halo=add(new T.TorusGeometry(.63,.045,10,40),makeMat('#ffe5a0',{emissive:'#ffcc55',emissiveIntensity:.8}),[0,3.48,0]);halo.rotation.x=Math.PI/2;tube([0,2.55,-.24],[0,3.48,-.63],.055,silver);oval([0,3.48,-.63],[.065,.065,.065],silver);}
 const scale=a.size==='compact'?.84:a.size==='large'?1.12:1;root.scale.set(scale*a.bodyWidth,scale,scale);body.name='torso';arms.forEach((o,i)=>o.name='arm-'+i);legs.forEach((o,i)=>o.name='leg-'+i);root.name='Claw';root.userData.clawName=name;
 function update(t,mode='idle',speed=0){const working=mode==='work',walking=mode==='walk',talking=mode==='talk',wave=mode==='wave',dance=mode==='dance';const beat=t*(walking?9:dance?6:1.8);body.position.y=walking?Math.abs(Math.sin(beat))*.075:Math.sin(beat)*.025;body.rotation.z=dance?Math.sin(beat)*.16:0;body.rotation.y=dance?Math.sin(beat*.4)*.3:0;legs.forEach((leg,i)=>{leg.rotation.x=walking||dance?Math.sin(beat+i*Math.PI)*.5:0;});arms.forEach((arm,i)=>{arm.rotation.x=working?-.95+Math.sin(t*7+i*1.7)*.07:Math.sin(beat+i*Math.PI)*(walking?.32:talking?.22:.06);arm.rotation.z=(wave&&i===1?-1.5+Math.sin(t*8)*.22:dance?(i?-.75:.75)+Math.sin(beat)*.3:talking?(i?-.2:.2):0);});const blink=Math.sin(t*.71)>.996?.12:1;eyes.forEach(e=>e.scale.y=e.userData.baseY*blink);mouths.forEach(m=>m.scale.y=talking?1+Math.abs(Math.sin(t*12))*3:1);}
 function dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}
 return {root,body,arms,legs,update,dispose,appearance:a};
}
