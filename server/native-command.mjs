import{deflateSync}from'node:zlib';
// OpenShell limits each exec argument to 32 KiB. Compress only application-owned
// runner source; the request remains separate JSON on stdin, never executable code.
export function nativeCommand(source){
 const encoded=deflateSync(Buffer.from(source,'utf8')).toString('base64');
 if(Buffer.byteLength(encoded)>=32768)throw Error('The packaged native runner exceeds OpenShell’s command argument limit.');
 return ['node','-e','eval(require("node:zlib").inflateSync(Buffer.from(process.argv[1],"base64")).toString("utf8"))',encoded];
}
