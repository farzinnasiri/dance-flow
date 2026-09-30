(() => {
  const $ = (id) => document.getElementById(id);
  const { definitions, make } = window.salsaSteps;
  const { sample, outputTime } = window.salsaTimeline;
  const { instruments, events:grooveEvents, calls:breakCalls, sampleNames } = window.salsaGroove;

  const beatGrid = $('beatGrid');
  let preset = 'ny', role = 'leader', pattern = make(preset,role), displayed = 0, selectedAt = 0, playing = false, mode = 'groove', lastCueKey = '';
  let ctx, master, nextScheduled = 0, startAt = 0, schedulerId, rafId, objectURL;
  let lastSnapshot, lastOutputTime = 0;
  let samplesPromise, starting = false, startRequest = 0;
  const samples = {};
  const stemGains = {};
  let songSource, songAudioAnchor = 0, currentArrangement, arrangementCycle = -1;
  let songAnchor = 0;
  const song = $('song');
  const nodes = new Set();
  const secondsPerBeat = () => 60 / Number($('tempo').value);
  const frameAt = (beat) => pattern.frames.filter(f=>f.at<=((beat%8+8)%8)+1e-7).at(-1);
  const mainFrame = (beat) => pattern.frames.find(f=>f.at===beat) || frameAt(beat);
  const displayFrame = (beat) => pattern.frames.find(f=>f.at>=beat && f.at<beat+1 && f.foot) || mainFrame(beat);
  const dancer = window.createSalsaDancer?.($('dancerCanvas'));
  $('resetView').addEventListener('click', () => { dancer?.resetView();$('view').value='back'; });
  $('view').addEventListener('change',()=>dancer?.setView($('view').value));

  function buildGrid() {
    beatGrid.innerHTML = '';
    for(let beat=0;beat<8;beat++) {
      const frame=displayFrame(beat), button=document.createElement('button');
      const stepsHere=pattern.frames.filter(f=>Math.floor(f.at)===beat&&f.foot);
      button.type='button';button.className='beat-card';button.dataset.index=String(beat);
      button.setAttribute('aria-label',stepsHere.map(f=>`Count ${f.count}: ${f.action}`).join('; ')||`Count ${beat+1}: hold`);
      const number=document.createElement('span');number.className='n';number.textContent=String(beat+1);
      const label=document.createElement('span');label.className='verb';label.textContent=(frame.count.includes('&')?frame.count+' · ':'')+frame.short;
      button.append(number,label);button.dataset.count=String(beat+1);button.dataset.short=(frame.count.includes('&')?frame.count+' · ':'')+frame.short;
      if(stepsHere.length>1){const extra=document.createElement('span');extra.className='extra';extra.textContent=`${stepsHere[1].count} ${stepsHere[1].short}`;button.append(extra);}
      if(frame.break) button.classList.add('break');
      if(!stepsHere.length) button.classList.add('hold');
      button.addEventListener('click',()=>{stop();const next=stepsHere.length>1&&$('count').textContent===stepsHere[0].count&&displayed===beat?stepsHere[1]:frame;render(next);});
      beatGrid.appendChild(button);
    }
  }
  function render(frame) {
    displayed=Math.floor(frame.at);selectedAt=frame.at;
    $('count').textContent=frame.count;$('count').classList.toggle('half-count',frame.count.includes('&'));
    $('action').textContent=frame.action;
    const next=pattern.frames[(pattern.frames.findIndex(f=>f.at===frame.at)+1)%pattern.frames.length];
    $('nextCue').textContent=`Next: ${next.count} · ${next.kind==='hold'?'Hold':next.action}`;
    $('footChip').textContent=frame.foot?(frame.foot==='L'?'LEFT FOOT':'RIGHT FOOT'):'NO STEP';
    $('cue').className='cue '+(frame.foot==='L'?'left-cue':frame.foot==='R'?'right-cue':'hold-cue');
    Array.from(beatGrid.children).forEach((button,index)=>{
      const active=index===displayed;
      button.classList.toggle('active',active);button.setAttribute('aria-current',active?'step':'false');
      button.querySelector('.n').textContent=active?frame.count:button.dataset.count;
      button.querySelector('.verb').textContent=active?frame.short:button.dataset.short;
      const extra=button.querySelector('.extra');if(extra)extra.hidden=active&&frame.count.includes('&');
      button.style.setProperty('--landing-scale','1');
    });
    if(!playing)dancer?.showStep(frame,preset);
  }
  function paint(snapshot) {
    lastSnapshot=snapshot;
    if(snapshot.ready){
      if(lastCueKey!=='ready'){
        lastCueKey='ready';$('count').textContent='–';$('action').textContent='Listen for 1';$('footChip').textContent='READY';$('cue').className='cue hold-cue';$('nextCue').textContent='Start on the next musical 1';
        Array.from(beatGrid.children).forEach(button=>{button.classList.remove('active');button.setAttribute('aria-current','false');});
      }
    }else{
      if(snapshot.key!==lastCueKey){lastCueKey=snapshot.key;render(snapshot.frame);}
      beatGrid.children[Math.floor(snapshot.frame.at)]?.style.setProperty('--landing-scale',String(1+snapshot.pulse*.08));
    }
    dancer?.present(snapshot);
  }
  function setPreset(key) {
    stop();preset=key;pattern=make(preset,role);lastCueKey='';$('timingLabel').textContent=timingNames[key][1]+(key==='la'?' · On1':key==='ny'?' · On2':'');
    document.querySelectorAll('.timing-choice').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.timing===key)));
    $('voiceHint').textContent='Count aloud calls '+breakCalls(pattern).map(f=>f.count).join(' & ')+'.';
    $('patternNote').textContent='Step counts: '+pattern.subtitle+'.'+(pattern.note?' '+pattern.note:'');
    if(!['la','casino','ny'].includes(key))$('moreTimings').open=true;
    buildGrid();render(mainFrame(0));
  }
  function setRole(value) {
    if(role===value)return;
    role=value;
    document.querySelectorAll('.role-button').forEach(button=>{const active=button.dataset.role===role;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
    setPreset(preset);
  }
  function setPlayUI() { $('playText').textContent = starting ? 'Loading sounds…' : playing ? 'Pause' : 'Start practice'; $('playIcon').textContent = starting ? '♫' : playing ? '❚❚' : '▶'; $('play').setAttribute('aria-label',starting?'Cancel loading sounds':playing?'Pause practice':'Start practice'); }
  function track(source) { nodes.add(source); source.addEventListener('ended',()=>nodes.delete(source)); }
  function ensureAudio() {
    if (ctx) {if (ctx.state==='suspended') ctx.resume();return true;}
    const Ctor=window.AudioContext||window.webkitAudioContext;if(!Ctor) return false;
    ctx=new Ctor({latencyHint:'interactive'});master=ctx.createGain();master.gain.value=.68;
    master.connect(ctx.destination);
    for(const id of [...instruments,'instructor']){const gain=ctx.createGain();gain.gain.value=$(id).checked?1:0;gain.connect(master);stemGains[id]=gain;}
    const presence=ctx.createBiquadFilter();presence.type='highshelf';presence.frequency.value=2600;presence.gain.value=3;presence.connect(stemGains.piano);stemGains.pianoInput=presence;
    return true;
  }
  function trimStart(buffer) {
    const data=buffer.getChannelData(0),limit=Math.min(data.length,Math.floor(buffer.sampleRate*.06));
    let peak=0;for(let i=0;i<data.length;i++)peak=Math.max(peak,Math.abs(data[i]));
    let first=0;while(first<limit&&Math.abs(data[first])<peak*.035)first++;
    const cut=Math.max(0,first-Math.round(buffer.sampleRate*.002));
    if(!cut||first===limit)return buffer;
    const result=ctx.createBuffer(buffer.numberOfChannels,buffer.length-cut,buffer.sampleRate);
    for(let channel=0;channel<buffer.numberOfChannels;channel++)result.copyToChannel(buffer.getChannelData(channel).subarray(cut),channel);
    return result;
  }
  function loadSamples() {
    if(!samplesPromise) samplesPromise = Promise.all(sampleNames.map(async name => {
      const response = await fetch(new URL(`audio/${name}.${name.startsWith('voice-')?'wav':'mp3'}`, document.baseURI));
      if(!response.ok) throw new Error(`Could not load ${name}`);
      const buffer=await ctx.decodeAudioData(await response.arrayBuffer());
      samples[name] = name.startsWith('voice-')?buffer:trimStart(buffer);
    })).catch(error => { samplesPromise = null; throw error; });
    return samplesPromise;
  }
  function hit(name,t,volume,rate=1,instrument='instructor',duration) {
    const source=ctx.createBufferSource(),gain=ctx.createGain();
    source.buffer=samples[name];source.playbackRate.value=rate;
    gain.gain.setValueAtTime(volume,t);
    source.connect(gain);gain.connect(instrument==='piano'?stemGains.pianoInput:stemGains[instrument]);
    track(source);source.addEventListener('ended',()=>{source.disconnect();gain.disconnect();});source.start(t);
    if(duration){
      const end=t+duration;gain.gain.setValueAtTime(volume,Math.max(t,end-.025));gain.gain.linearRampToValueAtTime(0,end);source.stop(end+.005);
    }
  }
  function scheduleMusic(slot,t) {
    const cycle=Math.floor(slot/16),at=slot%16/2,interval=secondsPerBeat();
    if(cycle!==arrangementCycle){currentArrangement=grooveEvents(cycle);arrangementCycle=cycle;}
    for(const e of currentArrangement.filter(e=>e.at===at)){
      let name=e.name,rate=e.rate;
      if(e.instrument==='bass'){
        const midi=e.midi,base=midi<34?31:midi<39?36:midi<43?41:midi<46?31:36;
        name=base===31?'bass-g1':base===36?'bass-c2':'bass-f1';rate=2**((midi-base)/12);
      }
      hit(name,t,e.gain,rate,e.instrument,e.duration?e.duration*interval:undefined);
    }
  }
  function scheduleInstructor(slot,t){
    const cue=breakCalls(pattern).find(f=>f.at===slot%16/2);
    if(cue)hit(`voice-${cue.count}`,t,cue.forward?.78:.68,1,'instructor');
  }
  function scheduleAhead() {
    if(!playing)return;
    const interval=secondsPerBeat(),horizon=ctx.currentTime+.16;
    if(mode==='song'){
      // Map the song's processing position to the AudioContext; both voices and the
      // display then use the device's output timestamp, including speaker latency.
      songAudioAnchor=ctx.currentTime-(song.currentTime-songAnchor);
      startAt=songAudioAnchor;
    }
    while(startAt+nextScheduled*.5*interval<horizon) {
      const when=startAt+nextScheduled*.5*interval;
      if(when>=ctx.currentTime+.002){
        if(mode==='groove')scheduleMusic(nextScheduled,when);
        scheduleInstructor(nextScheduled,when);
      }
      nextScheduled++;
    }
  }
  function frame() {
    if(!playing)return;
    const interval=secondsPerBeat();
    let elapsed;
    if(mode==='groove'){
      lastOutputTime=Math.max(lastOutputTime,outputTime(ctx,performance.now()));
      elapsed=lastOutputTime-startAt;
    }else elapsed=outputTime(ctx,performance.now())-songAudioAnchor;
    if(mode==='song'&&song.ended){stop();return;}
    paint(sample(pattern.frames,elapsed,interval,preset));
    rafId=requestAnimationFrame(frame);
    if(mode==='song')updateSeek();
  }
  async function start() {
    if(playing||starting)return;
    $('status').hidden=true;
    if(mode==='song'){
      if(!song.src){expandPanel('music');$('ownSong').open=true;$('songFile').click();return;}
      if(!ensureAudio())return;
      const request=++startRequest;starting=true;setPlayUI();
      try{await loadSamples();await ctx.resume();}catch(error){if(request===startRequest){starting=false;setPlayUI();showStatus('The count recordings could not load. Try again.');}return;}
      if(request!==startRequest||mode!=='song')return;
      if(!songSource){songSource=ctx.createMediaElementSource(song);songSource.connect(master);}
      songAnchor=song.currentTime;lastCueKey='';playing=true;starting=false;nextScheduled=0;setPlayUI();
      try{await song.play();}catch(e){stop();return;}
      if(request!==startRequest||!playing||mode!=='song')return;
      songAudioAnchor=ctx.currentTime-(song.currentTime-songAnchor);startAt=songAudioAnchor;
      paint(sample(pattern.frames,outputTime(ctx,performance.now())-songAudioAnchor,secondsPerBeat(),preset));
      scheduleAhead();schedulerId=setInterval(scheduleAhead,25);rafId=requestAnimationFrame(frame);return;
    }
    if(!ensureAudio()){showStatus('Audio playback is unavailable in this browser.');return;}
    starting=true;const request=++startRequest;setPlayUI();
    try { await loadSamples(); await ctx.resume(); }
    catch(error) { if(request===startRequest){starting=false;setPlayUI();showStatus('The instrument recordings could not load. Try again.');}return; }
    if(request!==startRequest||mode!=='groove')return;
    starting=false;
    playing=true;setPlayUI();nextScheduled=0;arrangementCycle=-1;lastCueKey='';startAt=ctx.currentTime+.18;lastOutputTime=0;
    paint(sample(pattern.frames,-.18,secondsPerBeat(),preset));scheduleAhead();schedulerId=setInterval(scheduleAhead,25);rafId=requestAnimationFrame(frame);
  }
  function stop() {
    if(!playing&&!starting)return;
    startRequest++;starting=false;playing=false;setPlayUI();clearInterval(schedulerId);cancelAnimationFrame(rafId);
    for(const node of nodes){try{node.stop();}catch(e){/* already ended */}}nodes.clear();
    if(mode==='song')song.pause();
    if(lastSnapshot)render(lastSnapshot.frame);
  }
  function modeChange(value){stop();mode=value;$('groovePanel').hidden=value!=='groove';$('trackPanel').hidden=value!=='song';$('grooveMode').classList.toggle('active',value==='groove');$('trackMode').classList.toggle('active',value==='song');$('grooveMode').setAttribute('aria-pressed',String(value==='groove'));$('trackMode').setAttribute('aria-pressed',String(value==='song'));$('musicStatus').textContent=value==='groove'?'Practice groove':'Your audio file';syncBandSelection();}
  function showStatus(message){$('status').textContent=message;$('status').hidden=false;}
  const fmt=(sec)=>`${Math.floor(sec/60)}:${String(Math.floor(sec%60)).padStart(2,'0')}`;
  function updateSeek(){if(Number.isFinite(song.duration)&&song.duration>0){$('songSeek').value=String(Math.round(song.currentTime/song.duration*1000));$('songTime').textContent=fmt(song.currentTime);}}

  const timingNames={la:['1','Los Angeles'],casino:['1','Cuban · Guapea'],ny:['2','New York · ET'],power2:['2','Contratiempo'],on3:['3','On3'],on4:['4','On4'],sync:['2','Syncopated On2'],clave:['2','Clave · 2-side'],strikes:['2','Clave · strikes'],chacha:['2','Cha-cha']};
  for(const [key,[badge,name]] of Object.entries(timingNames)){
    const button=document.createElement('button');button.type='button';button.className='timing-choice';button.dataset.timing=key;button.setAttribute('aria-pressed','false');
    const detail=document.createElement('span');detail.className='timing-detail';
    const title=document.createElement('span');title.className='timing-name';title.textContent=name;
    const counts=document.createElement('span');counts.className='timing-counts';counts.textContent=`On${badge} · Break on ${definitions[key].breaks.join(' & ')}`;
    const check=document.createElement('span');check.className='selected-mark';check.setAttribute('aria-hidden','true');
    detail.append(title,counts);button.append(detail,check);button.addEventListener('click',()=>setPreset(key));
    $(['la','casino','ny'].includes(key)?'timingChoices':'advancedChoices').appendChild(button);
  }
  let openPanel=null;
  function expandPanel(value){
    openPanel=value;
    $('workspace').classList.toggle('with-panel',!!value);
    for(const kind of ['timing','music']){
      $(`${kind}Panel`).hidden=kind!==value;
      $(`${kind}Open`).setAttribute('aria-expanded',String(kind===value));
    }
  }
  for(const kind of ['timing','music']){
    $(`${kind}Open`).addEventListener('click',()=>expandPanel(openPanel===kind?null:kind));
    $(`${kind}Close`).addEventListener('click',()=>{expandPanel(null);$(`${kind}Open`).focus();});
  }
  $('breakdown').addEventListener('click',()=>{
    const expanded=$('breakdown').getAttribute('aria-expanded')!=='true';
    $('breakdown').setAttribute('aria-expanded',String(expanded));$('beatsSection').classList.toggle('expanded',expanded);
  });
  function syncBandSelection(){
    const full=instruments.every(id=>$(id).checked),percussion=instruments.every(id=>$(id).checked===!['piano','bass'].includes(id));
    $('fullBand').setAttribute('aria-pressed',String(mode==='groove'&&full));$('percussionBand').setAttribute('aria-pressed',String(mode==='groove'&&percussion));
  }
  function setBand(percussion){
    if(mode!=='groove')modeChange('groove');
    for(const id of instruments){$(id).checked=!percussion||!['piano','bass'].includes(id);if(ctx)stemGains[id].gain.setValueAtTime($(id).checked?1:0,ctx.currentTime);}
    syncBandSelection();
  }
  $('fullBand').addEventListener('click',()=>setBand(false));$('percussionBand').addEventListener('click',()=>setBand(true));
  document.querySelectorAll('.role-button').forEach(b=>b.addEventListener('click',()=>setRole(b.dataset.role)));
  $('play').addEventListener('click',()=>playing||starting?stop():start());
  $('reset').addEventListener('click',()=>{stop();render(mainFrame(0));});
  $('back').addEventListener('click',()=>{stop();const index=pattern.frames.findIndex(f=>f.at===selectedAt);render(pattern.frames[(index-1+pattern.frames.length)%pattern.frames.length]);});
  $('next').addEventListener('click',()=>{stop();const index=pattern.frames.findIndex(f=>f.at===selectedAt);render(pattern.frames[(index+1)%pattern.frames.length]);});
  function changeTempo(value){$('tempo').value=String(Math.max(70,Math.min(210,value)));$('tempoValue').textContent=$('tempo').value;if(playing||starting){stop();start();}}
  $('tempo').addEventListener('input',()=>changeTempo(Number($('tempo').value)));
  $('tempoDown').addEventListener('click',()=>changeTempo(Number($('tempo').value)-5));
  $('tempoUp').addEventListener('click',()=>changeTempo(Number($('tempo').value)+5));
  for(const id of [...instruments,'instructor'])$(id).addEventListener('change',()=>{if(ctx)stemGains[id].gain.setValueAtTime($(id).checked?1:0,ctx.currentTime);syncBandSelection();});
  $('grooveMode').addEventListener('click',()=>modeChange('groove'));
  $('trackMode').addEventListener('click',()=>modeChange('song'));
  $('songFile').addEventListener('change',(e)=>{stop();if(objectURL)URL.revokeObjectURL(objectURL);const file=e.target.files&&e.target.files[0];if(!file)return;objectURL=URL.createObjectURL(file);song.src=objectURL;$('songControls').hidden=false;$('musicStatus').textContent=file.name;$('songSeek').value='0';$('songTime').textContent='0:00';});
  song.addEventListener('loadedmetadata',()=>{$('songSeek').max='1000';updateSeek();});
  $('songSeek').addEventListener('input',()=>{if(Number.isFinite(song.duration)){song.currentTime=Number($('songSeek').value)/1000*song.duration;if(playing)resetSongOne();updateSeek();}});
  function resetSongOne(){
    for(const node of nodes){try{node.stop();}catch(e){/* already ended */}}nodes.clear();
    songAnchor=song.currentTime;nextScheduled=0;lastCueKey='';songAudioAnchor=ctx?ctx.currentTime:0;startAt=songAudioAnchor;render(mainFrame(0));
  }
  $('markOne').addEventListener('click',()=>{if(!song.src)return;resetSongOne();});
  window.addEventListener('keydown',(e)=>{const focused=document.activeElement;if(e.key==='Escape'&&openPanel){const current=openPanel;expandPanel(null);$(`${current}Open`).focus();return;}if(['INPUT','BUTTON','SELECT','CANVAS','SUMMARY','TEXTAREA'].includes(focused?.tagName))return;if(e.code==='Space'){e.preventDefault();playing||starting?stop():start();}else if(e.code==='ArrowRight'){$('next').click();}else if(e.code==='ArrowLeft'){$('back').click();}});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)stop();});
  window.addEventListener('pagehide',()=>{stop();if(objectURL)URL.revokeObjectURL(objectURL);});
  if(document.modelContext?.registerTool){
    const register=(tool)=>{try{Promise.resolve(document.modelContext.registerTool(tool)).catch(()=>{});}catch(e){/* unsupported browser implementation */}};
    register({name:'configure_salsa_practice',title:'Configure salsa practice',description:'Select a salsa footwork style and tempo in the visible trainer.',inputSchema:{type:'object',properties:{style:{type:'string',enum:['la','casino','ny','power2','on3','on4','sync','clave','strikes','chacha']},bpm:{type:'integer',minimum:70,maximum:210,multipleOf:5},role:{type:'string',enum:['leader','follower']}},required:['style','bpm'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){if(!input||!Object.hasOwn(definitions,input.style)||!Number.isInteger(input.bpm)||input.bpm<70||input.bpm>210||input.bpm%5)throw new Error('Invalid style or tempo');if(input.role)setRole(input.role);setPreset(input.style);$('tempo').value=String(input.bpm);$('tempoValue').textContent=String(input.bpm);return{style:input.style,role,bpm:input.bpm,playing:false};}});
    register({name:'start_salsa_practice',title:'Start salsa practice',description:'Start the currently selected salsa style and music source in the visible trainer.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},async execute(){if(mode==='song'&&!song.src)throw new Error('Choose a song first');await start();return{style:preset,role,bpm:Number($('tempo').value),playing};}});
    register({name:'pause_salsa_practice',title:'Pause salsa practice',description:'Pause music and the follow-along count.',inputSchema:{type:'object',properties:{},additionalProperties:false},annotations:{readOnlyHint:false},execute(){stop();return{playing:false,currentCount:$('count').textContent};}});
  }
  setPreset('ny');
})();
