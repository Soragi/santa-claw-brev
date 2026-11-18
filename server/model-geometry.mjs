import * as T from 'three';
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js';
import {printableModel} from './printable.mjs';
import {character} from '../src/character.js';
// The Three exporter uses the browser FileReader interface for its binary Blob.
// No textures, DOM, network fetches or user-supplied executable assets are involved.
if(!globalThis.FileReader)globalThis.FileReader=class{readAsArrayBuffer(blob){blob.arrayBuffer().then(data=>{this.result=data;this.onloadend?.();}).catch(error=>this.onerror?.(error));}};
export async function buildModelFiles(avatar,name=''){
 const rig=character(avatar,name);try{
 const clips=[];for(const mode of ['idle','walk','wave']){const nodes=[rig.body,...rig.arms,...rig.legs],times=[],samples=nodes.map(()=>({p:[],q:[]}));for(let i=0;i<=40;i++){const t=i/20;times.push(t);rig.update(t,mode);nodes.forEach((o,j)=>{samples[j].p.push(...o.position.toArray());samples[j].q.push(...o.quaternion.toArray());});}const tracks=[];nodes.forEach((o,j)=>{tracks.push(new T.VectorKeyframeTrack(o.name+'.position',times,samples[j].p),new T.QuaternionKeyframeTrack(o.name+'.quaternion',times,samples[j].q));});clips.push(new T.AnimationClip(mode,2,tracks));}
 rig.update(0,'idle');rig.root.scale.multiplyScalar(.03);rig.root.updateMatrixWorld(true);
 const glb=new Uint8Array(await new GLTFExporter().parseAsync(rig.root,{binary:true,trs:true,animations:clips}));
 // STL has no unit metadata. Bake geometry in millimetres and document that convention.
 rig.root.scale.multiplyScalar(1000);rig.root.updateMatrixWorld(true);const {stl,report}=await printableModel(rig.root);
 return {'model/claw.glb':glb,'model/claw.stl':stl,'model/print-report.json':new TextEncoder().encode(JSON.stringify(report,null,2)),'model/PRINTING.md':new TextEncoder().encode('# Printing your Claw\n\nclaw.stl is a single joined watertight solid in millimetres, Z up, standing on a 3 mm base. It includes the Santa hat and raised name. Shoulders, hips, ankles and accessories have purpose-built overlapping connections shared with the visual character. No automatic repair bridges are added. Import without rescaling; place the flat base on the bed. Enable supports under the claws, hat and accessories. Use a suitable nozzle/layer height for small lettering; long names need finer detail, such as a 0.2 mm nozzle or resin. Preview every layer in your slicer. This mesh is computationally validated, not a physical print qualification for every printer/material. The GLB preserves animated visual geometry and does not include the print base.\n')};
 }finally{rig.dispose();}
}
