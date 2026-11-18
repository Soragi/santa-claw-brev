import fileGuard from '../deploy/sandbox-files.cjs';
export function allowedHost(value,publicOrigin=process.env.SANTA_PUBLIC_ORIGIN){
  try{const url=new URL('http://'+value);if(url.username||url.password||url.pathname!=='/'||url.search||url.hash)return false;
    if(['localhost','127.0.0.1','[::1]'].includes(url.hostname))return true;
    return !!publicOrigin&&url.host===new URL(publicOrigin).host;
  }catch{return false;}
}
export const containsSecret=fileGuard.secret;

export function safeArtifactName(name){return typeof name==='string'&&/^(?:[a-zA-Z0-9_-][a-zA-Z0-9_. -]*\/)*[a-zA-Z0-9_-][a-zA-Z0-9_. -]*$/.test(name)&&!name.split('/').some(p=>p==='.'||p==='..');}
