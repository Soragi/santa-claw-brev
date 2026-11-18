// Original eight-bit holiday arrangement, synthesized locally. No audio downloads.
const melody=[
 [76,0,76,79,76,74,72,0],[74,0,74,77,74,72,71,0],
 [72,76,79,0,81,79,76,72],[74,77,79,77,74,71,67,0],
 [76,79,84,79,81,79,76,0],[77,81,84,81,79,77,76,72],
 [74,77,79,83,81,79,77,74],[76,74,72,0,67,71,72,0],
 [79,0,76,72,76,79,81,0],[77,0,74,71,74,77,79,0],
 [76,79,81,84,81,79,76,72],[74,77,79,81,79,77,74,71],
 [72,76,79,84,83,81,79,76],[77,81,84,81,79,77,76,72],
 [74,77,79,83,81,79,77,71],[72,0,79,76,72,0,0,0]
];
const roots=[48,55,48,55,48,53,55,48,48,55,57,55,48,53,55,48];
const tick=60/114/2;
export function createChristmasMusic(){const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Audio is unavailable in this browser.');const context=new Context(),master=context.createGain();master.gain.value=.075;master.connect(context.destination);let timer=null,next=0,step=0,closed=false;
 function tone(midi,time,length,type,level){const oscillator=context.createOscillator(),gain=context.createGain();oscillator.type=type;oscillator.frequency.value=440*2**((midi-69)/12);gain.gain.setValueAtTime(0,time);gain.gain.linearRampToValueAtTime(level,time+.008);gain.gain.exponentialRampToValueAtTime(.0001,time+length);oscillator.connect(gain);gain.connect(master);oscillator.onended=()=>{oscillator.disconnect();gain.disconnect();};oscillator.start(time);oscillator.stop(time+length+.01);}
 function schedule(){if(closed||context.state!=='running')return;if(next<context.currentTime-.2){const missed=Math.ceil((context.currentTime-next)/tick);step+=missed;next+=missed*tick;}while(next<context.currentTime+.16){const bar=Math.floor(step/8)%melody.length,index=step%8,note=melody[bar][index],root=roots[bar];if(note)tone(note,next,tick*.85,'square',.33);if(index%2===0)tone(root-12,next,tick*1.65,'triangle',.65);if(index===0){tone(root+12,next,tick*2.8,'sine',.22);tone(root+19,next,tick*2.1,'sine',.1);}if(index%2===1)tone(root+[12,16,19,16][Math.floor(index/2)],next,tick*.55,'triangle',.17);step++;next+=tick;}}
 return {async play(){if(closed)throw Error('Audio was stopped.');await context.resume();if(closed)return;next=context.currentTime+.03;step=0;schedule();if(!timer)timer=window.setInterval(schedule,25);},async stop(){if(closed)return;closed=true;if(timer)window.clearInterval(timer);timer=null;master.disconnect();await context.close();}};
}
