import {z} from 'zod';
import {createHash} from 'node:crypto';
export const digest=v=>createHash('sha256').update(typeof v==='string'||Buffer.isBuffer(v)?v:JSON.stringify(v)).digest('hex');
export const designSchema=z.object({title:z.string().min(1).max(80),brief:z.string().min(1).max(2000),diameter:z.number().min(30).max(60),initials:z.string().regex(/^[A-Z0-9]{0,3}$/),palette:z.array(z.string().regex(/^#[a-fA-F0-9]{6}$/)).min(1).max(4),decoration:z.enum(['plain','belt','initials']),track:z.enum(['bauble','topper']).default('bauble'),code:z.string().max(24000).optional()}).strict();
export const roles={designer:['read_skill_reference','read_brief','read_design','revise_design'],builder:['read_skill_reference','read_brief','read_design','build_cad','job_status'],inspector:['read_skill_reference','read_brief','read_design','inspect_print','job_status','request_approval','submit_approved','check_submission']};
export const toolDefinitions=[
 ['read_skill_reference','Read pinned NVIDIA skill instructions and references. GPU services require organizer provisioning.',{skill:z.enum(['omniverse-cad-to-simready','omniverse-realtime-viewer']),file:z.string().max(200).default('SKILL.md')}],
 ['read_brief','Read event constraints, printer readiness and the timed change request.',{}],
 ['read_design','Read current parameters, immutable revisions and validation failures.',{}],
 ['revise_design','Create a new design revision. This invalidates previous approvals.',{design:designSchema}],
 ['build_cad','Queue an isolated CAD build and four views from the same geometry.',{}],
 ['inspect_print','Independently inspect and slice the current built revision.',{}],
 ['job_status','Read job state; wait for completion before the next step.',{jobId:z.string().uuid()}],
 ['request_approval','Request Telegram approval of a qualified, current revision.',{}],
 ['submit_approved','Submit the exact approved revision to the operator-controlled queue.',{}],
 ['check_submission','Read print queue receipts. Agents cannot start a physical printer.',{}]
].map(([name,description,shape])=>({name,description,schema:z.object(shape).strict()}));
export const toolSchemas=scopes=>toolDefinitions.filter(t=>scopes.includes(t.name)).map(({name,description,schema})=>({name,description,inputSchema:z.toJSONSchema(schema)}));
export const profileSchema=z.object({version:z.literal(1),id:z.string().regex(/^[a-z0-9-]{1,64}$/),printer:z.string().min(1),material:z.string().min(1),nozzleMm:z.number().positive(),minFeatureMm:z.number().positive(),maxBodyMm:z.number().min(30).max(60),maxPrintMinutes:z.number().positive(),maxMaterialGrams:z.number().positive(),supports:z.enum(['none','profile']),colors:z.array(z.string().regex(/^#[a-fA-F0-9]{6}$/)).min(1).max(4),qualified:z.boolean(),qualificationEvidence:z.string().min(1),slicerImage:z.string().regex(/^[a-zA-Z0-9./:_-]+@sha256:[a-f0-9]{64}$/),cadWorkerImage:z.string().regex(/^sha256:[a-f0-9]{64}$/),slicerProfileSha256:z.string().regex(/^[a-f0-9]{64}$/),loop:z.object({outerRadius:z.literal(5),innerRadius:z.literal(2.5),depth:z.literal(4),offset:z.literal(3)}).strict()}).strict();
export const agenda=[{minutes:20,label:'Brief & architecture'},{minutes:70,label:'Build the pipeline'},{minutes:30,label:'Validate & improve'},{minutes:15,label:'Surprise change'},{minutes:15,label:'Demonstrate & export'}];
