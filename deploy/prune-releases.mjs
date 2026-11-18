#!/usr/bin/env node
// Retention for staged releases and pre-upgrade SQLite copies. Dry run unless --apply; never touches the live checkout or data/.
import {readdirSync,statSync,rmSync,existsSync} from 'node:fs';import os from 'node:os';import path from 'node:path';import {fileURLToPath} from 'node:url';
const day=86400000;
export function selectReleases(entries,{keep=3,protect=[]}={}){const sorted=[...entries].sort((a,b)=>b.mtime-a.mtime);return sorted.slice(keep).filter(e=>!protect.includes(e.name));}
export function selectBackups(entries,{keep=10,maxAgeDays=14,now=Date.now()}={}){const sorted=[...entries].sort((a,b)=>b.mtime-a.mtime);return sorted.slice(keep).filter(e=>now-e.mtime>maxAgeDays*day);}
const list=(dir,match)=>existsSync(dir)?readdirSync(dir).filter(match).map(name=>{const s=statSync(path.join(dir,name));return {name,path:path.join(dir,name),mtime:s.mtimeMs,dir:s.isDirectory()};}):[];
export function plan({releases=path.join(os.homedir(),'santa-claw-releases'),backups=path.join(os.homedir(),'santa-claw-upgrade-backup'),keep=3,keepBackups=10,maxAgeDays=14,protect=[]}={}){
 return {releases:selectReleases(list(releases,n=>/^\d+\.\d+\.\d+-\d+$/.test(n)).filter(e=>e.dir),{keep,protect}),backups:selectBackups(list(backups,n=>/^before-.*\.sqlite$/.test(n)),{keep:keepBackups,maxAgeDays})};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const arg=(flag,fallback)=>{const at=process.argv.indexOf(flag);return at>=0?process.argv[at+1]:fallback;};const apply=process.argv.includes('--apply');
 const result=plan({keep:Number(arg('--keep',3)),keepBackups:Number(arg('--keep-backups',10)),maxAgeDays:Number(arg('--max-age-days',14)),protect:[arg('--protect','')].filter(Boolean)});
 for(const e of [...result.releases,...result.backups]){console.log((apply?'Removing ':'Would remove ')+e.path);if(apply)rmSync(e.path,{recursive:true,force:true});}
 console.log(result.releases.length+' release(s), '+result.backups.length+' backup(s) '+(apply?'removed.':'selected. Rerun with --apply to delete.'));}
