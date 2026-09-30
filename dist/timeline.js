(() => {
  const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
  const mix=(a,b,t)=>a+(b-a)*t;
  const smooth=t=>t*t*(3-2*t);
  function poseOf(frame,style) {
    const support=frame.supportFoot||frame.foot;
    return {
      left:{x:(frame.item[3][0]-50)*.019,z:(62-frame.item[3][1])*.016,y:0},
      right:{x:(frame.item[4][0]-50)*.019,z:(62-frame.item[4][1])*.016,y:0},
      weight:support==='L'?-1:support==='R'?1:0,
      turn:style==='casino'?(support==='L'?-.13:.13):0,bounce:0
    };
  }
  function between(a,b,progress,movingFoot) {
    const t=smooth(progress);
    const foot=name=>{
      const p=a[name],q=b[name],travel=Math.hypot(p.x-q.x,p.z-q.z);
      return {x:mix(p.x,q.x,t),z:mix(p.z,q.z,t),y:name===movingFoot&&travel>.02?Math.sin(Math.PI*t)*.075:0};
    };
    return {left:foot('left'),right:foot('right'),weight:mix(a.weight,b.weight,t),turn:mix(a.turn,b.turn,t),bounce:0};
  }
  // One snapshot drives the count, action, tile, landing pulse and body pose.
  // The moving foot reaches the target on the event boundary (including half beats).
  function sample(frames,elapsed,beatSeconds,style) {
    // Pre-roll follows the preceding part of the same loop. Starting from a
    // separate neutral stance made the first entry differ from later entries.
    const ready=elapsed<0;
    const raw=elapsed/beatSeconds,nearest=Math.round(raw*2)/2;
    const absolute=Math.abs(raw-nearest)<1e-8?nearest:raw,cycle=Math.floor(absolute/8),phase=absolute-cycle*8;
    let index=0;
    for(let i=1;i<frames.length;i++)if(frames[i].at<=phase+1e-9)index=i;
    const current=frames[index],next=frames[(index+1)%frames.length];
    const nextAt=next.at+(index===frames.length-1?8:0),span=(nextAt-current.at)*beatSeconds;
    const move=Math.min(.18,beatSeconds*.4,span*.72),until=(nextAt-phase)*beatSeconds;
    const progress=clamp((move-until)/move,0,1);
    const movingFoot=next.kind==='replace'||!next.foot?null:next.foot==='L'?'left':'right';
    const pose=between(poseOf(current,style),poseOf(next,style),progress,movingFoot);
    pose.bounce=.009*Math.sin(phase*Math.PI*2);
    const age=(phase-current.at)*beatSeconds;
    return {frame:ready?frames[0]:current,ready,key:ready?'ready':`${cycle}:${current.at}`,pose,pulse:!ready&&current.foot?clamp(1-age/.14,0,1):0,phase,cycle};
  }
  function outputTime(context,now) {
    if(typeof context.getOutputTimestamp==='function') {
      const stamp=context.getOutputTimestamp();
      if(stamp.contextTime>0&&stamp.performanceTime>0&&now-stamp.performanceTime>=-10&&now-stamp.performanceTime<1000)
        return Math.min(context.currentTime,stamp.contextTime+(now-stamp.performanceTime)/1000);
    }
    return Math.max(0,context.currentTime-(context.outputLatency||0)-(context.baseLatency||0));
  }
  const api={sample,poseOf,outputTime};
  if(typeof window!=='undefined')window.salsaTimeline=api;
  if(typeof module!=='undefined')module.exports=api;
})();
