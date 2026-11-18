// Only the installation's reserved workshop agent namespace may be removed.
module.exports=function resetWorkshop(p,{fs=require('node:fs'),cp=require('node:child_process'),root='/sandbox/.openclaw'}={}){
 if(p.confirm!=='RESET ALL'||!Array.isArray(p.projectAgents)||p.projectAgents.some(id=>!/^sc-[a-f0-9]{12}$/.test(id)))throw Error('Invalid workshop reset confirmation or agent inventory');
 if(fs.realpathSync(root)!==root||!fs.lstatSync(root).isDirectory())throw Error('Unsafe native workshop root');
 const path=require('node:path'),file=path.join(root,'openclaw.json'),config=JSON.parse(fs.readFileSync(file,'utf8')),entries=config.agents?.entries||{},ids=new Set([...p.projectAgents,...Object.keys(entries).filter(id=>/^sc-[a-f0-9]{12}$/.test(id))]);
 for(const name of fs.readdirSync(root)){const match=name.match(/^workspace-(sc-[a-f0-9]{12})$/);if(match)ids.add(match[1]);}
 const agents=path.join(root,'agents');if(fs.existsSync(agents)){if(fs.realpathSync(agents)!==agents||!fs.lstatSync(agents).isDirectory())throw Error('Unsafe native agent directory');for(const id of fs.readdirSync(agents))if(/^sc-[a-f0-9]{12}$/.test(id))ids.add(id);}
 if(ids.size>256)throw Error('Workshop inventory requires operator cleanup');
 for(const id of ids){if(entries[id])cp.execFileSync('openclaw',['agents','delete',id,'--force','--json'],{timeout:30000,stdio:['ignore','pipe','pipe']});for(const target of [path.join(root,'workspace-'+id),path.join(agents,id)]){const parent=path.dirname(target);if(fs.existsSync(parent)&&fs.realpathSync(parent)!==parent)throw Error('Unsafe native cleanup parent');fs.rmSync(target,{recursive:true,force:true});}}
 // Clear files produced by the application-owned Santa helpers. Native main/channel data is preserved.
 for(const id of ['santa-manager','santa-reviewer','santa-drafter','santa-postmaster'])fs.rmSync(path.join(root,'workspace-'+id),{recursive:true,force:true});
 const after=JSON.parse(fs.readFileSync(file,'utf8'));if(Object.keys(after.agents?.entries||{}).some(id=>/^sc-[a-f0-9]{12}$/.test(id)))throw Error('Native custom agents remain after reset');return {removed:ids.size};
};
