"""Offline geometry builder / separate trusted inspector. Units are millimetres."""
import json, pathlib, sys, math, hashlib, zipfile
import cadquery as cq
import numpy as np
import trimesh
from PIL import Image, ImageDraw
JOB=pathlib.Path('/job')

def core_source(d):
    r=d['diameter']/2
    # Loop dimensions remain fixed when the body changes size.
    code=f'''import cadquery as cq
body = cq.Workplane("XY").sphere({r})
loop = cq.Workplane("XZ", origin=(0,2,{r}+3)).circle(5).circle(2.5).extrude(4)
result = body.union(loop)
'''
    if d['decoration']=='belt':
        code+=f'belt=cq.Workplane("XY").circle({r}+0.6).extrude(2, both=True)\nresult=result.union(belt)\n'
    if d['initials']:
        # Deterministic pixel text: 1.2 mm strokes, anchored to a connected plaque.
        # Glyph masks use Pillow's built-in bitmap font, never downloaded fonts.
        from PIL import ImageFont
        font=ImageFont.load_default(size=8)
        mask=Image.new('1',(30,12));draw=ImageDraw.Draw(mask);draw.text((0,-2),d['initials'],font=font,fill=1)
        bounds=mask.getbbox()
        if bounds:
            mask=mask.crop(bounds);w,h=mask.size;cell=1.2
            code+=f'plate=cq.Workplane("XZ", origin=(0,-{r}+6,0)).rect({w*cell+2.4},{h*cell+2.4}).extrude(8)\nresult=result.union(plate)\n'
            for x in range(w):
                for y in range(h):
                    if mask.getpixel((x,y)):
                        px=(x-(w-1)/2)*cell;pz=((h-1)/2-y)*cell
                        code+=f'pixel=cq.Workplane("XZ", origin=({px},-{r}-1.9,{pz})).rect(1.23,1.23).extrude(1.2)\nresult=result.union(pixel)\n'
    return code

def mesh_of(shape):
    vs,ts=shape.tessellate(0.15)
    mesh=trimesh.Trimesh(vertices=np.array([v.toTuple() for v in vs]),faces=np.array(ts),process=True)
    # STEP face tessellations can differ at shared edges below CAD tolerance.
    mesh.merge_vertices(digits_vertex=3)
    mesh.update_faces(mesh.nondegenerate_faces())
    mesh.update_faces(mesh.unique_faces())
    mesh.remove_unreferenced_vertices()
    trimesh.repair.fix_normals(mesh,multibody=True)
    return mesh

def render(mesh,name):
    # Four projections of the exact inspected STEP mesh, never generated images.
    cameras={'front':(0,-1,0),'side':(1,0,0),'top':(0,0,1),'perspective':(1,-1,0.7)}
    w=np.array(cameras[name],dtype=float);w/=np.linalg.norm(w)
    up=np.array([0.,0.,1.]) if name!='top' else np.array([0.,1.,0.])
    u=np.cross(up,w);u/=np.linalg.norm(u);v=np.cross(w,u)
    verts=mesh.vertices-np.array(mesh.bounds).mean(axis=0)
    xy=np.stack([verts@u,verts@v],axis=1)
    scale=440/max(np.ptp(xy,axis=0));xy=xy*scale+256;xy[:,1]=512-xy[:,1]
    im=Image.new('RGB',(512,512),'#edf3ee');draw=ImageDraw.Draw(im)
    for i in np.argsort(mesh.triangles_center@w):
        f=mesh.faces[i];normal=mesh.face_normals[i];shade=0.42+0.58*abs(float(normal@w));base=tuple(int(x) for x in mesh.visual.face_colors[i][:3])
        draw.polygon([tuple(p) for p in xy[f]],fill=tuple(int(x*shade) for x in base))
    draw.text((16,16),name.upper(),fill='#19352b');im.save(JOB/(name+'.png'))

def export_3mf(mesh,palette):
    # Generic model, not a certified printer project. Slicer adapter replaces it.
    import xml.etree.ElementTree as ET
    ns='http://schemas.microsoft.com/3dmanufacturing/core/2015/02'
    ET.register_namespace('',ns)
    def tag(n):return '{'+ns+'}'+n
    model=ET.Element(tag('model'),unit='millimeter');resources=ET.SubElement(model,tag('resources'))
    mats=ET.SubElement(resources,tag('basematerials'),id='1')
    for i,c in enumerate(palette):ET.SubElement(mats,tag('base'),name='Event color '+str(i+1),displaycolor=c+'FF')
    obj=ET.SubElement(resources,tag('object'),id='2',type='model',pid='1',pindex='0');m=ET.SubElement(obj,tag('mesh'));vertices=ET.SubElement(m,tag('vertices'));triangles=ET.SubElement(m,tag('triangles'))
    for v in mesh.vertices:ET.SubElement(vertices,tag('vertex'),**dict(zip(['x','y','z'],map(str,v))))
    for face in mesh.faces:
        z=float(mesh.vertices[face].mean(axis=0)[2]);color=min(len(palette)-1,max(0,int((z-mesh.bounds[0,2])/max(1,mesh.extents[2])*len(palette))))
        ET.SubElement(triangles,tag('triangle'),v1=str(face[0]),v2=str(face[1]),v3=str(face[2]),pid='1',p1=str(color))
    build=ET.SubElement(model,tag('build'));ET.SubElement(build,tag('item'),objectid='2')
    with zipfile.ZipFile(JOB/'model.3mf','w',zipfile.ZIP_DEFLATED) as z:
        z.writestr('[Content_Types].xml','<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/></Types>')
        z.writestr('_rels/.rels','<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel0" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')
        z.writestr('3D/3dmodel.model',ET.tostring(model,encoding='utf-8',xml_declaration=True))

def build(d):
    if d['track']=='topper' and not d.get('code'):raise ValueError('Advanced topper requires authored CadQuery code and organizer review')
    source=d.get('code') or core_source(d)
    (JOB/'source.py').write_text(source)
    scope={};exec(compile(source,'source.py','exec'),scope)
    result=scope.get('result')
    if not isinstance(result,cq.Workplane):raise ValueError('Source must produce a CadQuery Workplane named result')
    shape=result.val();cq.exporters.export(shape,str(JOB/'model.step'))
    # Reimport STEP: exported geometry is the single source for previews and meshes.
    shape=cq.importers.importStep(str(JOB/'model.step')).val();mesh=mesh_of(shape)
    colors=[]
    for center in mesh.triangles_center:
        slot=min(len(d['palette'])-1,max(0,int((center[2]-mesh.bounds[0,2])/max(1,mesh.extents[2])*len(d['palette']))));c=d['palette'][slot];colors.append([int(c[i:i+2],16) for i in (1,3,5)]+[255])
    mesh.visual.face_colors=colors
    mesh.export(JOB/'model.stl');mesh.export(JOB/'model.glb');export_3mf(mesh,d['palette'])
    for name in ['front','side','top','perspective']:render(mesh,name)

def inspect(d):
    shape=cq.importers.importStep('/input/model.step').val();mesh=mesh_of(shape)
    solids=shape.Solids();parts=mesh.split(only_watertight=False)
    expected=d['diameter']+(1.2 if d['decoration']=='belt' else 0)
    checks=[('Valid closed CAD solid',shape.isValid() and len(solids)==1),('Watertight positive-volume mesh',mesh.is_watertight and mesh.is_volume),('No floating components',len(parts)==1),('Body dimensions match parameters',abs(mesh.extents[0]-expected)<1.5),('At most four colors',1<=len(d['palette'])<=4)]
    # Trusted parametric path can certify known loop throat and source dimensions.
    if not d.get('code') and d['track']=='bauble':
        probe=cq.Vector(0,0,d['diameter']/2+3)
        # The ring center must remain open; check complete CAD loop by a local shape intersection.
        ring=cq.Workplane('XZ',origin=(0,2,d['diameter']/2+3)).circle(5).circle(2.5).extrude(4).val()
        overlap=shape.intersect(ring).Volume();checks.append(('Fixed hanging-loop geometry retained',abs(overlap-ring.Volume())<0.05))
    else:checks.append(('Advanced wall/attachment verification requires organizer review',False))
    report={'geometryPassed':all(ok for _,ok in checks),'qualified':False,'boundsMm':mesh.bounds.tolist(),'volumeMm3':float(mesh.volume),'components':len(parts),'boundaryEdges':int(np.count_nonzero(np.bincount(mesh.edges_unique_inverse)==1)),'nonManifoldEdges':int(np.count_nonzero(np.bincount(mesh.edges_unique_inverse)>2)),'consistentWinding':bool(mesh.is_winding_consistent),'checks':[{'label':name,'passed':bool(ok)} for name,ok in checks]}
    (JOB/'inspection.json').write_text(json.dumps(report,indent=2))

if __name__=='__main__':
    d=json.loads((JOB/'design.json').read_text());{'build':build,'inspect':inspect}[sys.argv[1]](d)
