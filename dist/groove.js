(() => {
  // Original 2–3 son-clave practice arrangement. Positions are zero-based beats.
  const instruments=['clave','cowbell','congas','piano','bass','timbales','guiro','bongos','maracas'];
  const chords=[
    {root:36,fifth:43,third:63,top:60,inside:[63,67]},
    {root:41,fifth:48,third:65,top:65,inside:[65,68]},
    {root:31,fifth:38,third:62,top:59,inside:[62,65]},
    {root:36,fifth:43,third:63,top:60,inside:[63,67]}
  ];
  const clave=[1,2,4,5.5,7];
  const bell=[0,1.5,2,3.5,4,4.5,5.5,6,7];
  const rim=[0,1,1.5,2.5,3,4,4.5,5.5,6,6.5,7.5];
  const montuno=[
    [0,'octave',.16],[1,'inside',.19],[1.5,'octave',.15],
    [2,'inside',.18],[2.5,'octave',.16],[3.5,'anticipate',.20],
    [4,'inside',.16],[4.5,'octave',.19],[5.5,'inside',.19],
    [6,'octave',.15],[6.5,'inside',.18],[7.5,'anticipate',.21]
  ];
  const pianoBases=[48,56,60,64,68,72,76,80];
  function pianoEvent(at,midi,gain,duration){
    const base=pianoBases.reduce((a,b)=>Math.abs(b-midi)<Math.abs(a-midi)?b:a,60);
    return {instrument:'piano',at,name:`piano-${base}`,gain,rate:2**((midi-base)/12),duration};
  }
  function events(cycle) {
    const result=[],chord=chords[cycle%4],next=chords[(cycle+1)%4];
    const add=(instrument,at,name,gain,extra={})=>result.push({instrument,at,name,gain,rate:1,...extra});
    for(const at of clave)add('clave',at,at===4?'clave-a':'clave-b',at===4?.21:.17);
    for(const at of bell)add('cowbell',at,Number.isInteger(at)&&at%2===0?'mambo-mouth':'mambo-body',Number.isInteger(at)&&at%2===0?.17:.11);
    for(let b=0;b<8;b++){
      // Heel/toe ghost notes, slap on 2, open tones on 4 and 4&.
      const phase=b%4;
      if(phase===0||phase===2){add('congas',b,'conga-slap-a',.042);add('congas',b+.5,'conga-slap-b',.053);}
      if(phase===1){add('congas',b,'conga-slap-a',.19);add('congas',b+.5,'conga-slap-b',.04);}
      if(phase===3){add('congas',b,'conga-open-a',.21);add('congas',b+.5,'conga-open-b',.18);}
      add('maracas',b,'maraca-a',.060);add('maracas',b+.5,'maraca-b',.048);
      if(b%2===0)add('guiro',b,'guiro-long',.068,{duration:.8});
      else {add('guiro',b,'guiro-short',.066,{duration:.36});add('guiro',b+.5,'guiro-short',.057,{duration:.36});}
      add('bongos',b,phase===3?'bongo-low':'bongo-muted',phase===3?.14:.07);
      add('bongos',b+.5,'bongo',phase===1?.095:.075);
    }
    for(const at of rim)add('timbales',at,'timbale-rim',Number.isInteger(at)?.065:.049,{duration:.35});
    if(cycle%4===3){
      // A restrained fill at the end of the harmonic phrase.
      add('timbales',6.5,'timbale-high',.13);add('timbales',7,'timbale-high',.14);add('timbales',7.5,'timbale-low',.17);
    }
    for(const [at,part,gain] of montuno){
      const c=part==='anticipate'&&at===7.5?next:chord;
      const notes=part==='inside'?c.inside:[c.top,c.top+12];
      for(const midi of notes)result.push(pianoEvent(at,midi,gain,part==='anticipate'?.70:.40));
      // Lower octave punctuates the syncopated phrase, without block-chord padding.
      if(part==='anticipate'||at===1||at===5.5)result.push(pianoEvent(at,c.root+12,gain*.8,.52));
    }
    // Bass tumbao: offbeat fifth, root on 4; final offbeat anticipates the next chord.
    for(const at of [1.5,5.5])add('bass',at,'bass-c2',.25,{midi:chord.fifth,duration:.85});
    for(const at of [3,7])add('bass',at,'bass-c2',.29,{midi:chord.root,duration:.7});
    add('bass',7.5,'bass-c2',.24,{midi:next.root,duration:.9});
    return result.sort((a,b)=>a.at-b.at);
  }
  function calls(pattern){
    // Break counts are the same for both roles; the foot and direction come from that role's frames.
    return pattern.frames.filter(f=>f.break).map(f=>({at:f.at,count:Number(f.count),foot:f.foot,action:f.action,forward:['forward','open-forward'].includes(f.kind)}));
  }
  const sampleNames=[...new Set(events(0).concat(events(3)).map(e=>e.name)),...pianoBases.map(n=>`piano-${n}`),'bass-f1','bass-g1',...Array.from({length:8},(_,i)=>`voice-${i+1}`)];
  window.salsaGroove={instruments,events,calls,sampleNames};
  if(typeof module!=='undefined'&&module.exports)module.exports=window.salsaGroove;
})();
