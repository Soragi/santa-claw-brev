import {z} from 'zod';
import {runtimeName} from '../runtime-profile.mjs';
import {factoryPackage} from './package.mjs';
export function registerFactoryRoutes({app,factory,telegram,native,connection,network,guard,openClaw,importNative,prepareConnector=()=>native.prepare(),stopAttempt=async()=>{}}){const prefix='/santa/api/hackathon';
 app.get(prefix,(_q,r)=>r.json({...factory.snapshot(),agentRuntime:runtimeName(),telegram:telegram.status()}));
 app.post(prefix+'/preflight',async(_q,r)=>{guard();const c=await connection();if(!c.ready)throw Error('Connect the model and native runtime first.');await network.ensure();factory.connector=await prepareConnector();const ready=telegram.status().ownerPaired&&factory.connector.ready&&factory.worker.status().ready;r.json({...factory.snapshot(),ready,message:ready?'CAD, MCP and Telegram ready. Printer qualification is checked separately.':'Check CAD worker installation and pair the Telegram owner.'});});
 app.post(prefix+'/start',async(_q,r)=>r.json(await factory.start()));
 app.post(prefix+'/connect',async(q,r)=>{const b=z.object({project:z.string(),role:z.enum(['designer','builder','inspector']),scopes:z.array(z.string()).min(1)}).strict().parse(q.body);r.json(await factory.connect(b.project,b.scopes,b.role));});
 app.post(prefix+'/import-native',async(q,r)=>{guard();if(factory.read()?.state!=='active')throw Error('Start the factory first.');const b=z.object({agent:z.string().regex(/^[a-z][a-z0-9-]{0,62}$/)}).strict().parse(q.body);r.status(201).json(await importNative(b.agent));});
 app.post(prefix+'/deploy',(q,r)=>{const b=z.object({projects:z.array(z.string()).length(3)}).strict().parse(q.body);r.json(factory.deploy(b.projects));});
 app.post(prefix+'/pause',(_q,r)=>r.json(factory.setPaused(true)));app.post(prefix+'/resume',(_q,r)=>r.json(factory.setPaused(false)));
 app.post(prefix+'/reset',async(q,r)=>{z.object({confirm:z.literal('RESET HACKATHON')}).strict().parse(q.body);guard();factory.quiesce();await stopAttempt();await native.revoke();r.json(await factory.reset());});
 app.post(prefix+'/validate',(_q,r)=>r.json(factory.validate()));
 app.post(prefix+'/telegram/setup',async(_q,r)=>{guard();r.json(await telegram.setup());});
 app.post(prefix+'/openclaw',async(_q,r)=>{guard();r.json(await openClaw());});
 app.get(prefix+'/revisions/:id/download',async(q,r)=>{const bytes=await factoryPackage(factory,z.string().uuid().parse(q.params.id));r.set({'Content-Type':'application/zip','Content-Disposition':'attachment; filename="santa-bauble.zip"'}).send(Buffer.from(bytes));});
 app.get(prefix+'/revisions/:id/views/:view',(q,r)=>{const s=factory.read(),v=s?.revisions.find(v=>v.id===q.params.id),name=q.params.view+'.png';if(!v?.build||!['front.png','side.png','top.png','perspective.png'].includes(name))return r.sendStatus(404);r.type('png').send(factory.worker.artifact(v.build.directory,name,v.build.files[name]));});
}
