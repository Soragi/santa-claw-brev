import{execFileSync}from'node:child_process';import{browserImage}from'../server/browser-check.mjs';
execFileSync('docker',['pull',browserImage],{stdio:'inherit',timeout:600000});
console.log('Pinned isolated browser image prepared. Browser checks run without network, host data, or added capabilities.');
