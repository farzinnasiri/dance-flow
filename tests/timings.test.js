const assert=require('node:assert/strict'),test=require('node:test');
global.window={};const {make}=require('../dist/steps.js');const {calls}=require('../dist/groove.js');
// Expected counts independently transcribed from the requested Dance Dojo taxonomy.
const timings={
 la:{steps:[1,2,3,5,6,7],breaks:[1,5]},casino:{steps:[1,2,3,5,6,7],breaks:[1,5]},
 ny:{steps:[1,2,3,5,6,7],breaks:[2,6]},power2:{steps:[2,3,4,6,7,8],breaks:[2,6]},
 on3:{steps:[1,3,4,5,7,8],breaks:[3,7]},on4:{steps:[1,2,4,5,6,8],breaks:[4,8]},
 sync:{steps:[2,3,4.5,6,7,8.5],breaks:[2,6]},clave:{steps:[2,3,4,6,7,8],breaks:[2,6]},
 strikes:{steps:[2,3,5,6,6.5,8],breaks:[2,6]},chacha:{steps:[1,2,3,4,4.5,5,6,7,8,8.5],breaks:[2,6]}
};
const invert={forward:'back',back:'forward','prep-forward':'prep-back','prep-back':'prep-forward','side-left':'side-right','side-right':'side-left','close-left':'close-right','close-right':'close-left'};
for(const [style,expected] of Object.entries(timings)){
 test(`${style}: exact counts, breaks, alternating feet and role mapping`,()=>{
  const lead=make(style,'leader'),follow=make(style,'follower');
  for(const pattern of [lead,follow]){
   const steps=pattern.frames.filter(f=>f.foot);
   assert.deepEqual(steps.map(f=>f.at+1),expected.steps);
   assert.deepEqual(steps.filter(f=>f.break).map(f=>f.at+1),expected.breaks);
   assert.deepEqual(calls(pattern).map(f=>f.count),expected.breaks);
   for(const cue of calls(pattern)){
    const frame=steps.find(f=>f.at===cue.at);
    assert.equal(cue.forward,['forward','open-forward'].includes(frame.kind),'voice emphasis follows the movement, independent of display wording');
   }
   for(let i=0;i<steps.length;i++)assert.notEqual(steps[i].foot,steps[(i+1)%steps.length].foot,'feet must alternate including wraparound');
   for(let i=0;i<pattern.frames.length;i++){
    const f=pattern.frames[i],previous=pattern.frames[(i+pattern.frames.length-1)%pattern.frames.length];
    if(!f.foot){assert.deepEqual(f.item.slice(3),previous.item.slice(3),'hold must retain both feet');assert.equal(f.supportFoot,previous.supportFoot);continue;}
    const moving=f.foot==='L'?3:4,planted=f.foot==='L'?4:3;
    assert.deepEqual(f.item[planted],previous.item[planted],`${f.count}: supporting foot must not slide`);
    if(f.kind!=='replace')assert.notDeepEqual(f.item[moving],previous.item[moving],`${f.count}: travelling step must move the named foot`);
   }
  }
  for(let i=0;i<lead.frames.length;i++){
   const a=lead.frames[i],b=follow.frames[i];assert.equal(a.at,b.at);assert.equal(a.break,b.break);
   assert.equal(b.foot,a.foot?(a.foot==='L'?'R':'L'):null);
   assert.equal(b.kind,style==='casino'?a.kind:invert[a.kind]||a.kind);
  }
 });
}
test('cha-cha chasses: side-close-side with reversed direction and no net travel',()=>{
 for(const role of ['leader','follower']){
  const {frames}=make('chacha',role),at=n=>frames.find(f=>f.at===n-1);
  for(const [first,and,last] of [[4,4.5,5],[8,8.5,1]]){
   const a=at(first),b=at(and),c=at(last);assert(a.kind.startsWith('side-'));assert(b.kind.startsWith('close-'));assert.equal(a.kind,c.kind);
   const gap=f=>Math.abs(f.item[3][0]-f.item[4][0]);assert(gap(b)<gap(a));assert(gap(b)<gap(c));
  }
 }
});
