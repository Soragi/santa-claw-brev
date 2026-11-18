import {fileURLToPath} from 'node:url';
import {readFileSync,lstatSync} from 'node:fs';import {createHash} from 'node:crypto';import path from 'node:path';
const root=path.resolve(fileURLToPath(new URL('..',import.meta.url)));
const checks=JSON.parse(readFileSync(path.join(root,'checksums.json'),'utf8'));
for(const[file,hash]of Object.entries(checks)){if(path.isAbsolute(file)||file.split('/').includes('..')||!/^([a-zA-Z0-9_.-]+\/)*[a-zA-Z0-9_.-]+$/.test(file))throw Error('Unsafe package path.');const target=path.join(root,file);let current=root;for(const part of file.split('/')){current=path.join(current,part);if(lstatSync(current).isSymbolicLink())throw Error('Symlinks are not supported.');}if(createHash('sha256').update(readFileSync(target)).digest('hex')!==hash)throw Error('Package checksum failed: '+file);}
console.log('Package integrity verified. This is a corruption check, not publisher authentication.');
