// Generated source runs only in Chromium. This worker runs in a networkless,
// unprivileged, read-only container; request HTML is data on stdin, never Node code.
import previewPolicy from'./preview-policy.cjs';
import{pathToFileURL}from'node:url';
const modulePath=process.env.SANTA_PLAYWRIGHT_MODULE;
const{chromium}=await import(modulePath?pathToFileURL(modulePath).href:'playwright');
export async function probeGame({html,requireCanvas=true,three=false},{executablePath,container=false}={}){
 const browser=await chromium.launch({headless:true,chromiumSandbox:true,...(executablePath?{executablePath}:{}),args:['--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-dev-shm-usage']});
 const results=[];
 try{for(const viewport of [{width:1100,height:740},{width:390,height:844}]){
  const context=await browser.newContext({viewport,serviceWorkers:'block',acceptDownloads:false}),page=await context.newPage(),errors=[],blocked=[];
  page.on('pageerror',e=>errors.push(e.message.slice(0,500)));page.on('console',m=>{if(m.type()==='error')errors.push(m.text().slice(0,500));});page.on('dialog',d=>d.dismiss());
  await page.addInitScript(()=>{
   const info=window.__SANTA_PROBE={frames:0,inputs:0,restarts:0};const raf=window.requestAnimationFrame.bind(window);window.requestAnimationFrame=callback=>raf(time=>{info.frames++;callback(time);});
   const add=EventTarget.prototype.addEventListener;EventTarget.prototype.addEventListener=function(type,listener,options){if(['keydown','pointerdown','mousedown','touchstart'].includes(type))info.inputs++;if(type==='click'&&this.id==='restart'&&typeof listener==='function'){const original=listener;listener=function(...args){info.restarts++;return original.apply(this,args);};}return add.call(this,type,listener,options);};
  });
  const address='https://santa-game.invalid/preview';await context.route('**/*',route=>route.request().url()===address?route.fulfill({status:200,contentType:'text/html',headers:{'Content-Security-Policy':previewPolicy},body:html}):(blocked.push(route.request().url().split(/[?#]/)[0]),route.abort()));
  try{await page.goto(address,{waitUntil:'load',timeout:6000});await page.waitForTimeout(450);
   const start=page.getByRole('button',{name:/^(start|play|begin)(\s|$)/i}).first();if(await start.isVisible().catch(()=>false))await start.click({timeout:700}).catch(()=>{});
   await page.waitForTimeout(250);
   const measure=()=>page.evaluate(async()=>{
    const G=window.SantaGame,c=G?.canvas||document.querySelector('canvas'),info=window.__SANTA_PROBE,rect=c?.getBoundingClientRect();let colors=0,opaque=0;
    if(c&&c.width*c.height<=5000000){let pixels;if(G?.renderer?.isWebGLRenderer){await new Promise(resolve=>requestAnimationFrame(()=>{try{G.renderer.render(G.scene,G.camera);const gl=G.renderer.getContext(),w=gl.drawingBufferWidth,h=gl.drawingBufferHeight;pixels=new Uint8Array(w*h*4);gl.readPixels(0,0,w,h,gl.RGBA,gl.UNSIGNED_BYTE,pixels);}catch{}resolve();}));}else try{const ctx=G?.ctx?.canvas===c?G.ctx:c.getContext('2d');if(ctx)pixels=ctx.getImageData(0,0,c.width,c.height).data;}catch{}
     if(pixels){const seen=new Set(),step=Math.max(1,Math.floor(pixels.length/4/12000));for(let i=0;i<pixels.length;i+=step*4){if(pixels[i+3])opaque++;seen.add([pixels[i],pixels[i+1],pixels[i+2],pixels[i+3]].join(','));}colors=seen.size;}}
    let state;try{state=JSON.parse(JSON.stringify(G?.state||{}));}catch{state={};}
    return {ready:window.__SANTA_BUILD_READY===true,frames:info.frames,inputs:info.inputs,restarts:info.restarts,canvas:c?{width:c.width,height:c.height,visible:!!rect&&rect.width>=64&&rect.height>=64&&rect.right>0&&rect.bottom>0&&rect.left<innerWidth&&rect.top<innerHeight&&getComputedStyle(c).display!=='none'&&getComputedStyle(c).visibility!=='hidden'&&Number(getComputedStyle(c).opacity)>0,colors,opaque,renderer:G?.renderer?.isWebGLRenderer?'webgl':G?.ctx?'2d':'none'}:null,state};
   });
   const before=await measure();await page.keyboard.press('ArrowLeft');await page.keyboard.press('ArrowRight');await page.waitForTimeout(160);const restart=page.locator('#restart');if(requireCanvas){if(!await restart.isVisible())errors.push('The mandatory Restart button is not visible.');else{await page.evaluate(()=>{const b=document.getElementById('restart');if(typeof b?.onclick==='function'){const old=b.onclick;b.onclick=function(...args){window.__SANTA_PROBE.restarts++;return old.apply(this,args);};}});await restart.click({timeout:1000});}}
   await page.waitForTimeout(160);const after=await measure();if(requireCanvas){if(!before.ready)errors.push('The assembled game did not finish initialization.');if(!before.canvas?.visible||before.canvas.opaque===0||before.canvas.colors<2)errors.push('The visible game canvas is blank or has no rendered game content.');if(before.frames<2)errors.push('The game animation loop is not running.');if(before.inputs===0)errors.push('No keyboard, pointer or touch game controls were registered.');if(after.frames-before.frames<2)errors.push('The animation stopped after Restart.');if(after.restarts===0)errors.push('The visible Restart button has no working game handler.');if(three&&before.canvas?.renderer!=='webgl')errors.push('The requested 3D renderer was not initialized.');}
   results.push({viewport,before,after,errors:[...new Set(errors)],blocked});
  }catch(e){results.push({viewport,errors:[...new Set([...errors,e.message.slice(0,500)])],blocked});}finally{await context.close();}
 }}finally{await browser.close();}
 return {status:results.every(r=>r.errors.length===0)?'passed':'failed',kind:'browser-startup-render-input-restart-smoke',limits:'This checks initialization, visible pixels, animation, input registration and restart handling; it does not prove all gameplay rules.',viewports:results,errors:results.flatMap(r=>r.errors.map(e=>r.viewport.width+'px: '+e))};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){let input='';for await(const chunk of process.stdin){input+=chunk;if(input.length>2200000)throw Error('Browser input too large');}try{const request=JSON.parse(input);if(typeof request.html!=='string'||Buffer.byteLength(request.html)>2000000)throw Error('Invalid browser input');console.log('SANTA_BROWSER_RESULT:'+JSON.stringify(await probeGame(request)));}catch(e){console.log('SANTA_BROWSER_RESULT:'+JSON.stringify({status:'unavailable',errors:['The isolated browser runtime could not complete: '+e.message.slice(0,5000)]}));process.exitCode=1;}}
