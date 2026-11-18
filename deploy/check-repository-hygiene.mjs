// Source-only repository guard. Runtime data and audit evidence belong outside Git.
import{execFileSync}from'node:child_process';import{readFileSync}from'node:fs';import path from'node:path';import{fileURLToPath}from'node:url';
export function privatePath(name){
 const p=name.replaceAll('\\','/');
 if(/^(?:data|work|outputs|logs|screenshots|backups|local-backups|audit-evidence|test-results|playwright-report|node_modules|dist|\.ssh|\.aws)(?:\/|$)/i.test(p))return 'runtime or local output directory';
 if(/(?:^|\/)(?:\.codex|\.claude|\.cursor|\.aider)(?:\/|$)/i.test(p))return 'local development assistant state';
 if(/(?:^|\/)(?:(?:codex|claude)[-_](?:conversation|transcript|session|notes)[^/]*|rollout-[^/]*\.jsonl|chat[-_]transcript[^/]*|SECURITY-AUDIT\.md|deep-testing\.md|gb10-validation\.md)$/i.test(p))return 'development transcript or historical report';
 if(/(?:^|\/)(?:\.env(?:\..*)?|\.npmrc|\.netrc|credentials\.json|auth-profiles\.json|private\.env)$/i.test(p)&&p!=='.env.example')return 'credential or environment file';
 if(/\.(?:log|sqlite\w*|db|pem|key|p12|pfx|zip|tar|gz|tgz)$/i.test(p)&&p!=='vendor/nvidia-openshell-sdk-0.0.116.tgz')return 'log, database, key, backup or unreviewed archive';
 if(/(?:^|\/)(?:DEPLOYED_COMMIT|test-report\.[^/]+|Screenshot[^/]*)$/i.test(p))return 'machine or run artifact';
 return null;
}
export function privateText(text){const rules=[
 ['personal machine path',/\/(?:Users\/[a-zA-Z0-9._-]+|home\/(?!linuxbrew(?:\/|$)|sandbox(?:\/|$)|node(?:\/|$)|pwuser(?:\/|$)|ubuntu(?:\/|$)|user(?:\/|$))[a-zA-Z0-9._-]+)\//],
 ['device hostname',/\bspark-[a-f0-9]{4}\b/i],
 ['private deployment URL',/\b[a-z0-9-]+\.gobrev\.dev\b/i],
 ['internal-only repository URL',/\bgitlab-master\.nvidia\.com\b/i],
 ['private key material',/-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/]
 ];return rules.filter(([,re])=>re.test(text)).map(([label])=>label);}
export function checkRepository(root){const files=execFileSync('git',['ls-files','-z'],{cwd:root,encoding:'utf8'}).split('\0').filter(Boolean),findings=[];for(const file of files){const reason=privatePath(file);if(reason)findings.push({file,reason});if(file.endsWith('.tgz'))continue;const b=readFileSync(path.join(root,file));if(b.includes(0))continue;for(const issue of privateText(b.toString('utf8')))findings.push({file,reason:issue});}return{files:files.length,findings};}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){const result=checkRepository(process.cwd());if(result.findings.length){for(const f of result.findings)console.error(f.file+': '+f.reason);process.exitCode=1;}else console.log('Repository hygiene passed for '+result.files+' tracked source files.');}
