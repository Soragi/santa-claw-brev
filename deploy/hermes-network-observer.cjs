// Read only bounded, redacted network metadata from the active Hermes worker.
const fs=require('node:fs');const [agent,session]=process.argv.slice(1);
if(!/^(sc-[a-f0-9]{12}|santa-(manager|reviewer|drafter|postmaster)|main)$/.test(agent||'')||!/^[a-f0-9-]{36}$/.test(session||''))process.exit(1);
try{
 const root='/sandbox/.hermes/santa-claw',file=root+'/workspace-'+agent+'/.hermes/'+session+'.network.json';
 if(fs.lstatSync(file).isSymbolicLink()||fs.realpathSync(file)!==file||fs.statSync(file).size>1000000)throw Error('Invalid telemetry file');
 const rows=JSON.parse(fs.readFileSync(file,'utf8'));if(!Array.isArray(rows))throw Error('Invalid telemetry');
 const values=[];for(const row of rows.slice(-40)){
  if(!/^[a-f0-9-]{36}$/.test(row.key||'')||!Number.isFinite(row.at)||!['GET','HEAD','POST','PUT','PATCH','DELETE','OPTIONS'].includes(row.method))continue;
  try{const u=new URL(row.url);if(!['http:','https:'].includes(u.protocol)||u.username||u.password)continue;const result=row.result?{status:Number.isInteger(row.result.status)&&row.result.status>=100&&row.result.status<=599?row.result.status:null,error:row.result.error===true,at:Number(row.result.at)||row.at}:null;values.push({key:row.key,at:row.at,url:u.origin+u.pathname,queryRedacted:row.queryRedacted===true||!!u.search,method:row.method,result});}catch{}
 }
 console.log(JSON.stringify(values));
}catch{console.log('[]');}
