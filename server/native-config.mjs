import {createHash} from 'node:crypto';
// Per-process optimization only. A restart or model/configuration change forces sync.
export class NativeConfigCache{
 constructor(){this.key=null;}
 invalidate(){this.key=null;}
 async sync(agents,route,apply,{force=false}={}){const key=createHash('sha256').update(JSON.stringify({agents,route})).digest('hex');if(!force&&key===this.key)return {cached:true};await apply({op:'configure',agents});this.key=key;return {cached:false};}
}
