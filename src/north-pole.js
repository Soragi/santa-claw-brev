import * as T from 'three';
// A local, code-built landmark shared by the workshop endpoint and network globe.
export function northPoleWelcome(){
 const root=new T.Group(),geometries=[],materials=[],textures=[];
 const mat=(color,extra={})=>{const m=new T.MeshStandardMaterial({color,roughness:.65,...extra});materials.push(m);return m;};
 const snow=mat('#fffaf0'),red=mat('#bd4655'),pine=mat('#285f53'),gold=mat('#e8c579',{metalness:.4}),shell=mat('#f28d76'),black=mat('#29343c');
 const add=(g,m,x=0,y=0,z=0)=>{geometries.push(g);const mesh=new T.Mesh(g,m);mesh.position.set(x,y,z);root.add(mesh);return mesh;};
 add(new T.CylinderGeometry(.9,1,.14,32),snow,0,.07,0);
 for(const x of [-.72,.72]){add(new T.CylinderGeometry(.045,.045,1.35,10),snow,x,.75,-.15);for(let j=0;j<6;j++)add(new T.CylinderGeometry(.049,.049,.09,10),red,x,.2+j*.2,-.15);add(new T.SphereGeometry(.075,10,8),gold,x,1.48,-.15);}
 add(new T.BoxGeometry(1.8,.65,.12),pine,0,1.65,-.15);
 const canvas=document.createElement('canvas');canvas.width=768;canvas.height=256;const ctx=canvas.getContext('2d');if(ctx){ctx.fillStyle='#285f53';ctx.fillRect(0,0,768,256);ctx.strokeStyle='#e8c579';ctx.lineWidth=8;ctx.strokeRect(12,12,744,232);ctx.textAlign='center';ctx.fillStyle='#f7e7bc';ctx.font='600 37px sans-serif';ctx.fillText('WELCOME TO',384,88);ctx.font='bold 58px sans-serif';ctx.fillStyle='#ffffff';ctx.fillText('SANTA’S NORTH POLE',384,170);const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;textures.push(texture);const sign=new T.MeshBasicMaterial({map:texture,side:T.DoubleSide});materials.push(sign);add(new T.PlaneGeometry(1.76,.6),sign,0,1.65,-.083);}
 // Santa Claw waves under the welcome board: red coat, boots, beard and fur-trimmed hat.
 add(new T.SphereGeometry(.32,16,12),red,0,.56,.18);for(const x of [-.17,.17]){add(new T.BoxGeometry(.19,.14,.3),black,x,.21,.3);add(new T.SphereGeometry(.12,12,8),snow,x*.92,.88,.21);}
 add(new T.SphereGeometry(.22,16,12),shell,0,.99,.2);add(new T.SphereGeometry(.2,16,12),snow,0,.88,.34);add(new T.SphereGeometry(.065,12,8),shell,0,1.01,.42);for(const side of [-1,1]){add(new T.SphereGeometry(.055,10,8),snow,side*.1,1.065,.385);add(new T.SphereGeometry(.025,8,6),black,side*.1,1.06,.435);add(new T.SphereGeometry(.01,8,6),snow,side*.1-.008,1.075,.456);const antenna=add(new T.CapsuleGeometry(.012,.14,4,8),shell,side*.25,1.23,.1);antenna.rotation.z=-side*.5;}
 add(new T.CylinderGeometry(.235,.235,.09,16),snow,0,1.18,.2);add(new T.ConeGeometry(.23,.42,16),red,0,1.42,.2);add(new T.SphereGeometry(.085,12,8),snow,0,1.65,.2);add(new T.BoxGeometry(.58,.08,.13),black,0,.48,.44);add(new T.BoxGeometry(.12,.12,.04),gold,0,.48,.52);const arm=add(new T.CapsuleGeometry(.09,.28,4,8),red,.38,.83,.2);arm.rotation.z=-.6;add(new T.SphereGeometry(.12,12,8),shell,.48,1.02,.2);for(const x of [.41,.55])add(new T.CapsuleGeometry(.045,.13,4,8),shell,x,1.17,.2);const left=add(new T.SphereGeometry(.12,12,8),shell,-.36,.69,.32);for(const x of [-.43,-.29])add(new T.CapsuleGeometry(.045,.13,4,8),shell,x,.83,.32);
 return {root,dispose(){geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());textures.forEach(t=>t.dispose());}};
}
