(() => {
  // Counts, steps and accents follow Dance Dojo's timing taxonomy.
  // Positions are relative to the dancer's own forward direction.
  const definitions = {
    la: { title:'LA · On1', subtitle:'1–2–3 · 5–6–7', breaks:[1,5], events:[[1,'L','forward'],[2,'R','replace'],[3,'L','center'],[5,'R','back'],[6,'L','replace'],[7,'R','center']] },
    casino: { title:'Cuban · Guapea', subtitle:'1–2–3 · 5–6–7', breaks:[1,5], casino:true, events:[[1,'L','open-back'],[2,'R','replace'],[3,'L','center'],[5,'R','open-forward'],[6,'L','replace'],[7,'R','center']] },
    ny: { title:'ET · On2', subtitle:'1–2–3 · 5–6–7', breaks:[2,6], events:[[1,'L','prep-back'],[2,'R','back'],[3,'L','replace'],[5,'R','prep-forward'],[6,'L','forward'],[7,'R','replace']] },
    power2: { title:'Contratiempo · On2', subtitle:'2–3–4 · 6–7–8', breaks:[2,6], events:[[2,'L','forward'],[3,'R','replace'],[4,'L','center'],[6,'R','back'],[7,'L','replace'],[8,'R','center']] },
    on3: { title:'On3', subtitle:'3–4–5 · 7–8–1', breaks:[3,7], events:[[3,'L','forward'],[4,'R','replace'],[5,'L','center'],[7,'R','back'],[8,'L','replace'],[1,'R','center']] },
    on4: { title:'On4', subtitle:'8–1–2 · 4–5–6', breaks:[4,8], events:[[8,'L','forward'],[1,'R','replace'],[2,'L','center'],[4,'R','back'],[5,'L','replace'],[6,'R','center']] },
    sync: { title:'Syncopated · On2', subtitle:'2–3–4& · 6–7–8&', breaks:[2,6], events:[[2,'L','forward'],[3,'R','replace'],[4.5,'L','center'],[6,'R','back'],[7,'L','replace'],[8.5,'R','center']] },
    clave: { title:'On clave · 2-side', subtitle:'2–3–4 · 6–7–8', breaks:[2,6], note:'Lead front break on the 2-side of the clave.', events:[[2,'L','forward'],[3,'R','replace'],[4,'L','center'],[6,'R','back'],[7,'L','replace'],[8,'R','center']] },
    strikes: { title:'On clave · strikes', subtitle:'2–3–5 · 6–6&–8', breaks:[2,6], events:[[2,'L','forward'],[3,'R','replace'],[5,'L','center'],[6,'R','back'],[6.5,'L','replace'],[8,'R','center']] },
    chacha: { title:'Cha-cha · On2', subtitle:'2–3–4&5 · 6–7–8&1', breaks:[2,6], note:'For the cha-cha rhythm, choose a cha-cha song.', events:[[2,'L','forward',[40,37]],[3,'R','replace'],[4,'L','side-left',[30,62]],[4.5,'R','close-left',[40,62]],[5,'L','side-left',[20,62]],[6,'R','back',[40,79]],[7,'L','replace'],[8,'R','side-right',[50,62]],[8.5,'L','close-right',[40,62]],[1,'R','side-right',[60,62]]] }
  };
  const switchDirection = kind => ({forward:'back',back:'forward','prep-forward':'prep-back','prep-back':'prep-forward','side-left':'side-right','side-right':'side-left','close-left':'close-right','close-right':'close-left'})[kind] || kind;
  const xOf = foot => foot==='L'?40:60;
  const labels = {
    forward:['{Foot} forward break','forward break'], back:['{Foot} back break','back break'], replace:['Shift onto {foot} foot','shift weight'],
    center:['Bring {foot} foot to center','center'], 'prep-back':['Small {foot} step back','small step back'],
    'prep-forward':['Small {foot} step forward','small step forward'],
    'open-back':['{Foot} foot back and out','back and out'], 'open-forward':['{Foot} foot forward and out','forward and out'],
    'side-left':['{Foot} foot to your left','side left'], 'side-right':['{Foot} foot to your right','side right'],
    'close-left':['Close {foot} toward your left foot','close left'], 'close-right':['Close {foot} toward your right foot','close right']
  };
  const displayCount = n => Number.isInteger(n)?String(n):`${Math.floor(n)}&`;
  const clone = p => [p[0],p[1]];

  function landing(event) {
    if(!event)return null;
    const {foot,kind}=event;
    if(kind==='replace')return null; // Change the supporting leg; keep both soles planted.
    if(event.target)return clone(event.target);
    const target=[xOf(foot),62];
    if(kind==='forward')target[1]=37;
    else if(kind==='back')target[1]=79;
    else if(kind==='prep-forward')target[1]=52;
    else if(kind==='prep-back')target[1]=70;
    else if(kind==='open-back'){target[0]=foot==='L'?28:72;target[1]=77;}
    else if(kind==='open-forward'){target[0]=foot==='L'?28:72;target[1]=35;}
    return target;
  }

  function make(key,role) {
    const definition=definitions[key];
    if(!definition || !['leader','follower'].includes(role)) throw Error('Unknown salsa timing or role');
    const events=definition.events.map(([count,foot,kind,target]) => ({
      count,at:count-1,foot:role==='leader'?foot:foot==='L'?'R':'L',
      kind:role==='follower'&&!definition.casino?switchDirection(kind):kind,
      target:target?(role==='leader'?clone(target):[100-target[0],kind==='forward'?79:kind==='back'?37:target[1]]):undefined
    })).sort((a,b)=>a.at-b.at);
    // Start from the final landing of each foot in this closed eight-count cycle.
    // This is the same stance on the first loop and every later loop: no warm-up
    // simulation, accumulated translations, or reset disguised as a replacement.
    const lastLanding=foot=>landing(events.filter(e=>e.foot===foot&&e.kind!=='replace').at(-1))||[xOf(foot),62];
    let left=lastLanding('L'),right=lastLanding('R');
    const origin={left:clone(left),right:clone(right)};
    const cycle=[];
    for(const event of events) {
      const target=landing(event);
      if(target){if(event.foot==='L')left=target;else right=target;}
      cycle.push({...event,left:clone(left),right:clone(right)});
    }
    if(left.some((n,i)=>n!==origin.left[i])||right.some((n,i)=>n!==origin.right[i]))
      throw Error(`The ${key}/${role} footwork cycle does not close`);
    const start=cycle[cycle.length-1];
    const frames=[];
    for(let beat=1;beat<=8;beat++) {
      for(const count of [beat,beat+.5]) {
        const event=cycle.find(e=>e.count===count);
        if(!event && !Number.isInteger(count)) continue;
        const previous=cycle.filter(e=>e.at<=count-1).at(-1) || start;
        const state=event||previous;
        const foot=event?.foot||null;
        const footName=foot==='L'?'left':'right';
        const action=event?labels[event.kind][0].replace('{Foot}',footName.charAt(0).toUpperCase()+footName.slice(1)).replace('{foot}',footName):'Hold your weight';
        const short=event?`${foot} ${labels[event.kind][1]}`:'Hold';
        frames.push({count:displayCount(count),at:count-1,foot,kind:event?.kind||'hold',supportFoot:state.foot,action,short,break:!!event&&definition.breaks.includes(count),
          item:[foot,action,'',clone(state.left),clone(state.right)]});
      }
    }
    return { ...definition, frames, role };
  }
  window.salsaSteps={ definitions, make };
  if(typeof module!=='undefined' && module.exports) module.exports={definitions,make};
})();
