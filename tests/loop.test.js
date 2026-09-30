const assert=require('node:assert/strict');
const test=require('node:test');
global.window={};
const {definitions,make}=require('../dist/steps.js');
const {sample}=require('../dist/timeline.js');
const near=(a,b,label)=>{
 if(typeof a==='number')return assert.ok(Math.abs(a-b)<1e-8,`${label}: ${a} != ${b}`);
 for(const key of Object.keys(a))near(a[key],b[key],`${label}.${key}`);
};
for(const style of Object.keys(definitions))for(const role of ['leader','follower']){
 const {frames}=make(style,role);
 test(`${style}/${role}: replacement transfers weight with both feet planted`,()=>{
  for(let i=0;i<frames.length;i++){
   const current=frames[i],previous=frames[(i+frames.length-1)%frames.length];
   if(current.kind==='replace')assert.deepEqual(current.item.slice(3),previous.item.slice(3),`count ${current.count}`);
  }
 });
 test(`${style}/${role}: cycle, entry and wraparound are identical at every tempo`,()=>{
  const original=JSON.stringify(frames);
  for(const bpm of [70,140,210]){
   const interval=60/bpm;
   for(let tick=0;tick<256;tick++){
    const phase=tick/32,first=sample(frames,phase*interval,interval,style);
    for(const cycle of [1,7,1000,10000]){
     const repeated=sample(frames,(8*cycle+phase)*interval,interval,style);
     near(repeated.pose,first.pose,`cycle ${cycle}, phase ${phase}`);
     assert.equal(repeated.frame.count,first.frame.count);
    }
   }
   for(const before of [-.18,-.10,-.02,-.00001]){
    const entry=sample(frames,before,interval,style),loop=sample(frames,8*interval+before,interval,style);
    assert.equal(entry.ready,true);near(entry.pose,loop.pose,'pre-roll');
   }
   const entry=sample(frames,0,interval,style),end=sample(frames,8*interval-1e-9,interval,style);
   near(entry.pose,end.pose,'seam');
  }
  assert.equal(JSON.stringify(frames),original,'playing must not mutate the cycle');
 });
}
test('Eddie Torres count 3 retains count 1 placement; count 7 retains count 5 placement',()=>{
 for(const role of ['leader','follower']){
  const {frames}=make('ny',role),one=frames.find(f=>f.count==='1'),three=frames.find(f=>f.count==='3'),five=frames.find(f=>f.count==='5'),seven=frames.find(f=>f.count==='7');
  const first=one.foot==='L'?3:4,second=five.foot==='L'?3:4;
  assert.deepEqual(three.item[first],one.item[first]);assert.deepEqual(seven.item[second],five.item[second]);
 }
});
