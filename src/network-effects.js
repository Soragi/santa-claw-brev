import * as T from 'three';
import {northPoleWelcome} from './north-pole.js';
export function networkEffects(scene,{enclosureRadius=2.4,enclosureHeight=5}={}){
 const root=new T.Group(),globe=new T.Group(),barrier=new T.Group();root.add(globe,barrier);scene.add(root);const geometry=[],materials=[];
 function material(color,extra={}){const m=new T.MeshStandardMaterial({color,roughness:.5,...extra});materials.push(m);return m;}
 function add(group,g,m,x=0,y=0,z=0){geometry.push(g);const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);group.add(mesh);return mesh;}
 const red=material('#c9414b'),white=material('#fbfdff'),gold=material('#f3ce79',{metalness:.6,roughness:.25}),pine=material('#457f76');
 const glass=new T.MeshPhysicalMaterial({color:'#d9f6ff',transparent:true,opacity:.3,roughness:.08,metalness:0,clearcoat:1,depthWrite:false});materials.push(glass);
 add(globe,new T.SphereGeometry(.72,24,16),glass,0,.48);add(globe,new T.CylinderGeometry(.58,.67,.2,24),red,0,-.13);add(globe,new T.CylinderGeometry(.56,.56,.08,24),white,0,.01);const welcome=northPoleWelcome();welcome.root.scale.setScalar(.55);welcome.root.position.set(0,.06,0);globe.add(welcome.root);
 const particleData=new Float32Array(72*3),seeds=[];for(let i=0;i<72;i++){const a=i*2.399,r=.55*Math.sqrt((i+.5)/72);seeds.push([Math.cos(a)*r,Math.sin(a)*r,(i*.173)%1]);}const particles=new T.BufferGeometry();geometry.push(particles);particles.setAttribute('position',new T.BufferAttribute(particleData,3));const snow=new T.PointsMaterial({color:'#ffffff',size:.055,transparent:true,opacity:.92,depthWrite:false});materials.push(snow);globe.add(new T.Points(particles,snow));
 // A floor-level enclosure surrounds the whole Claw instead of a floating gate.
 const fenceMaterial=material('#c9414b',{transparent:true,opacity:.36,wireframe:true,depthWrite:false});
 add(barrier,new T.CylinderGeometry(enclosureRadius,enclosureRadius,enclosureHeight,28,8,true),fenceMaterial,0,enclosureHeight/2,0);
 for(const y of [.08,enclosureHeight]){const ring=add(barrier,new T.TorusGeometry(enclosureRadius,.045,8,48),white,0,y,0);ring.rotation.x=Math.PI/2;}
 for(let i=0;i<8;i++){const a=i*Math.PI/4;add(barrier,new T.CylinderGeometry(.045,.045,enclosureHeight,8),red,Math.cos(a)*enclosureRadius,enclosureHeight/2,Math.sin(a)*enclosureRadius);}
 add(barrier,new T.TorusGeometry(.2,.045,8,16),gold,0,enclosureHeight*.58,enclosureRadius+.03);add(barrier,new T.BoxGeometry(.5,.4,.14),gold,0,enclosureHeight*.524,enclosureRadius+.03);
 globe.position.y=7.8;
 globe.visible=false;barrier.visible=false;
 return {root,update(position,state,time,reduced,heading=0,camera=null){if(reduced)time=0;root.position.copy(position);const show=state&&['retrieving','retrieved'].includes(state.status);globe.visible=!!show;barrier.visible=!!state&&['attempted','blocked','rejected','tool_error'].includes(state.status);root.visible=!!state;root.rotation.y=heading;barrier.rotation.y=-heading;globe.rotation.y=-heading;globe.position.y=7.8+(reduced?0:Math.sin(time*2)*.065);barrier.rotation.z=0;fenceMaterial.opacity=reduced?.36:.3+Math.sin(time*4)**2*.12;if(show){for(let i=0;i<seeds.length;i++){const [x,z,seed]=seeds[i],radius=Math.sqrt(Math.max(0,.62*.62-x*x-z*z)),phase=(seed+time*.2)%1;particleData[i*3]=x;particleData[i*3+1]=.48+(1-phase*2)*radius;particleData[i*3+2]=z;}particles.attributes.position.needsUpdate=true;}},dispose(){scene.remove(root);welcome.dispose();geometry.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());}};
}
