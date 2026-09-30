const fs=require('fs'),vm=require('vm'),assert=require('assert');const root=require('path').resolve(__dirname,'../dist')+'/';
class Element{
 constructor(tag='DIV'){this.tagName=tag;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.textContent='';this.value='';this.checked=false;this.style={setProperty(){}};this.classes=new Set();this.classList={add:n=>this.classes.add(n),remove:n=>this.classes.delete(n),toggle:(n,v)=>{if(v===undefined)v=!this.classes.has(n);if(v)this.classes.add(n);else this.classes.delete(n)}};}
 set className(v){this.classes=new Set(v.split(' '))}get className(){return [...this.classes].join(' ')}
 set innerHTML(v){this.children=[]}append(...e){this.children.push(...e)}appendChild(e){this.append(e)}setAttribute(k,v){this.attrs[k]=v}getAttribute(k){return this.attrs[k]}addEventListener(k,f){(this.listeners[k]??=[]).push(f)}async fire(k='click'){for(const f of this.listeners[k]||[])await f({target:this});}click(){return this.fire()}focus(){}showModal(){this.open=true}close(){this.open=false}
 querySelector(sel){return this.children.find(e=>e.classes.has(sel.slice(1)))||null}
}
const ids={};for(const match of fs.readFileSync(root+'index.html','utf8').matchAll(/<([a-z]+)[^>]*\bid="([^"]+)"[^>]*>/g)){const e=ids[match[2]]=new Element(match[1].toUpperCase());e.checked=/\bchecked\b/.test(match[0]);e.hidden=/\bhidden\b/.test(match[0]);}
ids.tempo.value='90';ids.song.currentTime=0;ids.song.pause=()=>{};ids.song.play=async()=>{};
const roles=['leader','follower'].map(r=>{const e=new Element('BUTTON');e.dataset.role=r;return e});
const all=()=>Object.values(ids).concat(roles,...ids.timingChoices.children,...ids.advancedChoices.children);
const document={baseURI:'https://test.local/',hidden:false,activeElement:null,getElementById:n=>ids[n],createElement:t=>new Element(t.toUpperCase()),addEventListener(){},querySelectorAll(sel){if(sel==='.role-button')return roles;if(sel==='.timing-choice')return [...ids.timingChoices.children,...ids.advancedChoices.children];return []},querySelector(sel){return [...ids.timingChoices.children,...ids.advancedChoices.children].find(e=>e.attrs['aria-pressed']==='true')}};
let context,timer,raf,lastPose,scheduled=[];
class AudioContext{
 constructor(){context=this;this.currentTime=0;this.state='running';this.destination={};this.outputLatency=.08;this.baseLatency=.005;this.sampleRate=1000;this.gains=[];}
 getOutputTimestamp(){return {contextTime:this.currentTime-.085,performanceTime:performance.now()}}
 createGain(){const values=[];const gain={value:1,setValueAtTime(v,t){this.value=v;values.push([v,t])},linearRampToValueAtTime(){}};const node={gain,values,connect(){},disconnect(){}};this.gains.push(node);return node}
 createBiquadFilter(){return {frequency:{},gain:{},connect(){}}}
 createMediaElementSource(){return {connect(){}}}
 createBufferSource(){const e=new Element();e.playbackRate={value:1};e.connect=()=>{};e.disconnect=()=>{};e.start=t=>{scheduled.push({name:e.buffer.name,t,rate:e.playbackRate.value})};e.stop=()=>{};return e}
 async resume(){} async decodeAudioData(data){return {name:data.name,sampleRate:1000,length:4,numberOfChannels:1,getChannelData:()=>new Float32Array([.2,.3,.2,0])}}
}
const sandbox={window:{AudioContext,addEventListener(){},createSalsaDancer:()=>({resetView(){},showStep(){},present(s){lastPose=s}})},document,URL,performance:{now:()=>context?context.currentTime*1000+100:100},setInterval:f=>(timer=f,1),clearInterval(){timer=null},requestAnimationFrame:f=>(raf=f,1),cancelAnimationFrame(){raf=null},alert:m=>{throw Error(m)},fetch:async url=>{const name=String(url).split('/').pop().replace(/\.(wav|mp3)$/,'');assert(fs.existsSync(root+'audio/'+String(url).split('/').pop()));return {ok:true,arrayBuffer:async()=>({name})}}};
vm.createContext(sandbox);for(const name of ['steps','timeline','groove','app'])vm.runInContext(fs.readFileSync(root+name+'.js','utf8'),sandbox);
(async()=>{
 assert.equal(ids.timingChoices.children.length,3);assert.equal(ids.advancedChoices.children.length,7);
 await ids.timingOpen.click();assert(!ids.timingPanel.hidden);assert(ids.musicPanel.hidden);assert.equal(ids.timingOpen.getAttribute('aria-expanded'),'true');
 await ids.musicOpen.click();assert(ids.timingPanel.hidden);assert(!ids.musicPanel.hidden);await ids.musicOpen.click();assert(ids.musicPanel.hidden);
 await ids.timingOpen.click();await ids.timingClose.click();assert(ids.timingPanel.hidden);
 await ids.breakdown.click();assert(ids.beatsSection.classes.has('expanded'));await ids.breakdown.click();assert(!ids.beatsSection.classes.has('expanded'));
 await ids.tempoUp.click();assert.equal(ids.tempo.value,'95');await ids.tempoDown.click();assert.equal(ids.tempo.value,'90');
 await ids.percussionBand.click();assert(!ids.piano.checked&&!ids.bass.checked&&ids.congas.checked);await ids.fullBand.click();assert(ids.piano.checked&&ids.bass.checked);
 const {make,definitions}=sandbox.window.salsaSteps,{calls}=sandbox.window.salsaGroove,{sample}=sandbox.window.salsaTimeline;
 let checks=0;
 for(const key of Object.keys(definitions))for(const role of ['leader','follower'])for(const bpm of [70,140,210]){
  await roles.find(e=>e.dataset.role===role).click();await [...ids.timingChoices.children,...ids.advancedChoices.children].find(e=>e.dataset.timing===key).click();ids.tempo.value=String(bpm);scheduled=[];await ids.play.click();
  assert.equal(ids.count.textContent,'–');const start=context.currentTime+.18,spb=60/bpm;
  const advance=until=>{while(context.currentTime<until){context.currentTime=Math.min(until,context.currentTime+.025);if(timer)timer();if(raf)raf();}};
  advance(start+8*spb+.1);
  const spoken=scheduled.filter(e=>e.name.startsWith('voice-'));
  for(const c of calls(make(key,role))){const event=spoken.find(e=>e.name==='voice-'+c.count&&Math.abs(e.t-(start+c.at*spb))<1e-6);assert(event,`${key}/${role}: missing voice ${c.count}`);assert.equal(event.rate,1);}
  const boundary=start+12*spb+.085;advance(boundary);
  assert.equal(ids.count.textContent,lastPose.frame.count);assert.equal(ids.action.textContent,lastPose.frame.action);
  const tile=ids.beatGrid.children[Math.floor(lastPose.frame.at)];assert(tile.classes.has('active'));assert.equal(tile.querySelector('.n').textContent,lastPose.frame.count);
  // Expanding page sections must preserve playback and the current count.
  const timeBefore=context.currentTime,poseBefore=lastPose;await ids.musicOpen.click();assert(timer&&raf);assert.equal(lastPose,poseBefore);assert.equal(context.currentTime,timeBefore);await ids.timingOpen.click();assert(timer&&raf);assert.equal(lastPose,poseBefore);await ids.timingClose.click();assert(timer&&raf);
  // Live mute must preserve the current count and audio origin.
  const before=ids.count.textContent;ids.piano.checked=false;await ids.piano.fire('change');assert.equal(ids.count.textContent,before);assert.equal(context.gains[4].gain.value,0);ids.piano.checked=true;await ids.piano.fire('change');
  await ids.play.click();assert.equal(timer,null);
  for(const f of make(key,role).frames)for(const cycle of [0,1,999,10000]){const snap=sample(make(key,role).frames,(cycle*8+f.at)*spb,spb,key);assert.equal(snap.frame.count,f.count);assert.equal(snap.pose.left.y,0);assert.equal(snap.pose.right.y,0);checks++;}
 }
 ids.instructor.checked=true;await ids.instructor.fire('change');assert.equal(context.gains[10].gain.value,1);ids.instructor.checked=false;await ids.instructor.fire('change');assert.equal(context.gains[10].gain.value,0);
 await ids.trackMode.click();ids.song.src='blob:test';scheduled=[];await ids.play.click();assert(timer);context.currentTime+=.1;ids.song.currentTime=.1;timer();raf();await ids.play.click();
 console.log('PASS: inline timing/music/breakdown controls, band presets, tempo buttons; 10 timings, 60 timing/role/BPM playback cases, '+checks+' landing boundaries, exact scheduled voice times, live stem mutes, instructor switch, and song mode.');
})().catch(e=>{console.error(e);process.exit(1)});
