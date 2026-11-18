import*as T from'three';
// Walkability grid for the roaming Grinch, built from the real scene geometry.
// Anything with geometry between ankle and head height blocks a cell; blocked cells grow by the Grinch's radius.
const CELL=.5,HALF=34,N=Math.round(HALF*2/CELL),LOW=.15,HIGH=3.4;
const idx=(i,j)=>j*N+i,toCell=v=>Math.max(0,Math.min(N-1,Math.floor((v+HALF)/CELL))),toWorld=i=>-HALF+(i+.5)*CELL;
function fillTriangle(blocked,a,b,c){if(Math.abs((b.x-a.x)*(c.z-a.z)-(b.z-a.z)*(c.x-a.x))<1e-8){for(const[p,q]of[[a,b],[b,c],[c,a]]){const steps=Math.max(1,Math.ceil(Math.hypot(q.x-p.x,q.z-p.z)/(CELL*.5)));for(let i=0;i<=steps;i++){const t=i/steps;blocked[idx(toCell(p.x+(q.x-p.x)*t),toCell(p.z+(q.z-p.z)*t))]=1;}}return;}const minX=toCell(Math.min(a.x,b.x,c.x)),maxX=toCell(Math.max(a.x,b.x,c.x)),minZ=toCell(Math.min(a.z,b.z,c.z)),maxZ=toCell(Math.max(a.z,b.z,c.z));const s=(p,q,x,z)=>(q.x-p.x)*(z-p.z)-(q.z-p.z)*(x-p.x);for(let j=minZ;j<=maxZ;j++)for(let i=minX;i<=maxX;i++){const x=toWorld(i),z=toWorld(j),d1=s(a,b,x,z),d2=s(b,c,x,z),d3=s(c,a,x,z);if(!((d1<0||d2<0||d3<0)&&(d1>0||d2>0||d3>0)))blocked[idx(i,j)]=1;}}
export function buildGrid(roots,radius=1.1){
 const raw=new Uint8Array(N*N),box=new T.Box3(),v=[new T.Vector3(),new T.Vector3(),new T.Vector3()];
 for(const root of roots)root.updateWorldMatrix(true,true),root.traverse(o=>{if(!o.isMesh||!o.visible||!o.geometry?.attributes?.position)return;box.setFromObject(o);if(box.max.y<LOW||box.min.y>HIGH)return;
  const size=box.getSize(new T.Vector3());
  if(size.x*size.z<40){for(let j=toCell(box.min.z);j<=toCell(box.max.z);j++)for(let i=toCell(box.min.x);i<=toCell(box.max.x);i++)raw[idx(i,j)]=1;return;}
  // Large meshes (ropes, rings, fences): block only the triangles that are actually at body height.
  const pos=o.geometry.attributes.position,index=o.geometry.index,count=index?index.count:pos.count;
  for(let t=0;t<count;t+=3){for(let k=0;k<3;k++)v[k].fromBufferAttribute(pos,index?index.getX(t+k):t+k).applyMatrix4(o.matrixWorld);if(Math.max(v[0].y,v[1].y,v[2].y)<LOW||Math.min(v[0].y,v[1].y,v[2].y)>HIGH)continue;fillTriangle(raw,v[0],v[1],v[2]);}});
 const blocked=new Uint8Array(N*N),r=Math.ceil(radius/CELL);
 for(let j=0;j<N;j++)for(let i=0;i<N;i++)if(raw[idx(i,j)])for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){const x=i+di,z=j+dj;if(x>=0&&z>=0&&x<N&&z<N&&di*di+dj*dj<=r*r)blocked[idx(x,z)]=1;}
 return {blocked,free:(x,z)=>!blocked[idx(toCell(x),toCell(z))]};
}
export function nearestFree(grid,p){const i0=toCell(p.x),j0=toCell(p.z);if(!grid.blocked[idx(i0,j0)])return p.clone();for(let r=1;r<N;r++)for(let dj=-r;dj<=r;dj++)for(let di=-r;di<=r;di++){if(Math.max(Math.abs(di),Math.abs(dj))!==r)continue;const i=i0+di,j=j0+dj;if(i>=0&&j>=0&&i<N&&j<N&&!grid.blocked[idx(i,j)])return new T.Vector3(toWorld(i),p.y,toWorld(j));}return p.clone();}
function lineFree(grid,a,b){
 let i=toCell(a.x),j=toCell(a.z);const endI=toCell(b.x),endJ=toCell(b.z),dx=b.x-a.x,dz=b.z-a.z,sx=Math.sign(dx),sz=Math.sign(dz),tx=dx?CELL/Math.abs(dx):Infinity,tz=dz?CELL/Math.abs(dz):Infinity;
 let mx=dx?(toWorld(i)+sx*CELL/2-a.x)/dx:Infinity,mz=dz?(toWorld(j)+sz*CELL/2-a.z)/dz:Infinity;
 for(let n=0;n<N*2+4;n++){if(i<0||j<0||i>=N||j>=N||grid.blocked[idx(i,j)])return false;if(i===endI&&j===endJ)return true;
  if(Math.abs(mx-mz)<1e-10){if(grid.blocked[idx(i+sx,j)]||grid.blocked[idx(i,j+sz)])return false;i+=sx;j+=sz;mx+=tx;mz+=tz;}else if(mx<mz){i+=sx;mx+=tx;}else{j+=sz;mz+=tz;}}
 return false;
}
// A* over the grid, then string-pulled so the Grinch walks straight wherever it can.
export function findPath(grid,from,to){
 const s=idx(toCell(from.x),toCell(from.z)),g=idx(toCell(to.x),toCell(to.z));if(grid.blocked[s]||grid.blocked[g])return [from.clone()];if(s===g||lineFree(grid,from,to))return [from.clone(),to.clone()];
 const cost=new Float32Array(N*N).fill(Infinity),prev=new Int32Array(N*N).fill(-1),open=[[0,s]],gi=g%N,gj=Math.floor(g/N);cost[s]=0;
 const h=c=>Math.hypot(c%N-gi,Math.floor(c/N)-gj);
 while(open.length){let best=0;for(let k=1;k<open.length;k++)if(open[k][0]<open[best][0])best=k;const [,c]=open.splice(best,1)[0];if(c===g)break;const ci=c%N,cj=Math.floor(c/N);
  for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++){if(!di&&!dj)continue;const i=ci+di,j=cj+dj;if(i<0||j<0||i>=N||j>=N)continue;const n=idx(i,j);if(grid.blocked[n]&&n!==g)continue;if(di&&dj&&(grid.blocked[idx(ci+di,cj)]||grid.blocked[idx(ci,cj+dj)]))continue;const nc=cost[c]+(di&&dj?Math.SQRT2:1);if(nc<cost[n]){cost[n]=nc;prev[n]=c;open.push([nc+h(n),n]);}}}
 if(prev[g]<0)return [from.clone()];
 const cells=[];for(let c=g;c>=0;c=prev[c])cells.unshift(new T.Vector3(toWorld(c%N),0,toWorld(Math.floor(c/N))));cells[0]=from.clone();cells[cells.length-1]=to.clone();
 const out=[cells[0]];let k=0;while(k<cells.length-1){let far=k+1;for(let m=cells.length-1;m>k+1;m--)if(lineFree(grid,cells[k],cells[m])){far=m;break;}out.push(cells[far]);k=far;}return out;
}
export function pointAlong(path,u){const lengths=[];let total=0;for(let k=1;k<path.length;k++){const d=path[k].distanceTo(path[k-1]);lengths.push(d);total+=d;}let left=u*total;for(let k=1;k<path.length;k++){if(left<=lengths[k-1]||k===path.length-1){const t=lengths[k-1]?Math.min(1,left/lengths[k-1]):1;return {position:path[k-1].clone().lerp(path[k],t),heading:Math.atan2(path[k].x-path[k-1].x,path[k].z-path[k-1].z)};}left-=lengths[k-1];}return {position:path[path.length-1].clone(),heading:0};}
