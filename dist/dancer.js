(() => {
  const clamp=(v,a,b)=>Math.min(b,Math.max(a,v));
  const mix=(a,b,t)=>a+(b-a)*t;
  const sub=(a,b)=>a.map((v,i)=>v-b[i]);
  const add=(a,b)=>a.map((v,i)=>v+b[i]);
  const mul=(a,n)=>a.map(v=>v*n);
  const dot=(a,b)=>a.reduce((v,n,i)=>v+n*b[i],0);
  const cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
  const norm=a=>mul(a,1/(Math.hypot(...a)||1));
  const light=norm([-.45,.8,-.7]);
  const palette={shirt:'#ece8df',pants:'#465463',skin:'#c69979',hair:'#3d302a',left:'#6399d0',right:'#a183c4',sole:'#dad9d2'};
  const colorCache=new Map();
  function shade(color,n) {
    let rgb=colorCache.get(color);
    if(!rgb){rgb=[1,3,5].map(i=>parseInt(color.slice(i,i+2),16));colorCache.set(color,rgb);}
    const value=.84+.15*Math.abs(dot(n,light));
    return `rgb(${rgb.map(v=>Math.round(v*value)).join(',')})`;
  }
  window.createSalsaDancer=canvas=>{
    const g=canvas?.getContext('2d');if(!g)return null;
    let yaw=0,pitch=.12,distance=3.45,width=1,height=1,drag=null,state={frame:{foot:null},pulse:0,pose:{left:{x:-.19,z:0,y:0},right:{x:.19,z:0,y:0},weight:0,turn:0,bounce:0}};
    function camera(){
      const target=[0,.92,0],eye=[distance*Math.sin(yaw)*Math.cos(pitch),.92+distance*Math.sin(pitch),-distance*Math.cos(yaw)*Math.cos(pitch)];
      const forward=norm(sub(target,eye)),right=norm(cross([0,1,0],forward)),up=cross(forward,right);
      return {eye,forward,right,up,f:Math.min(width*.9,height)*1.48};
    }
    function project(point,cam){const v=sub(point,cam.eye),depth=Math.max(.2,dot(v,cam.forward));return {x:width/2+dot(v,cam.right)*cam.f/depth,y:height*.49-dot(v,cam.up)*cam.f/depth,depth,k:cam.f/depth};}
    function floor(cam){
      const points=[];for(let i=0;i<48;i++){const a=i/48*Math.PI*2;points.push(project([Math.cos(a)*.76,-.022,Math.sin(a)*.76],cam));}
      g.beginPath();points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle='rgba(25,45,53,0.035)';g.fill();
      const foot=state.frame.foot==='L'?state.pose.left:state.frame.foot==='R'?state.pose.right:null;
      if(foot&&state.pulse>0){
        const radius=.11+state.pulse*.07;g.beginPath();
        for(let i=0;i<=32;i++){const a=i/32*Math.PI*2,p=project([foot.x+Math.cos(a)*radius,.004,foot.z+.035+Math.sin(a)*radius*1.3],cam);i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y);}
        g.fillStyle=state.frame.foot==='L'?`rgba(140,186,255,${state.pulse*.2})`:`rgba(190,165,255,${state.pulse*.2})`;g.fill();
      }
    }
    function render(){
      if(width<2||height<2)return;
      g.clearRect(0,0,width,height);const cam=camera();floor(cam);const faces=[],labels=[];
      function face(vertices,color){
        const normal=norm(cross(sub(vertices[1],vertices[0]),sub(vertices[2],vertices[0]))),points=vertices.map(p=>project(p,cam));
        faces.push({points,depth:points.reduce((sum,p)=>sum+p.depth,0)/points.length,color:shade(color,normal)});
      }
      const triangle=(a,b,c,color)=>face([a,b,c],color);
      const quad=(a,b,c,d,color)=>face([a,b,c,d],color);
      function ellipsoid(center,radii,color,segments=20,rings=12,startAngle=0,endAngle=Math.PI){
        const points=[];
        for(let j=0;j<=rings;j++){const a=startAngle+j/rings*(endAngle-startAngle);const row=[];for(let i=0;i<segments;i++){const b=i/segments*Math.PI*2;row.push([center[0]+Math.sin(a)*Math.cos(b)*radii[0],center[1]+Math.cos(a)*radii[1],center[2]+Math.sin(a)*Math.sin(b)*radii[2]]);}points.push(row);}
        for(let j=0;j<rings;j++)for(let i=0;i<segments;i++){const n=(i+1)%segments;quad(points[j][i],points[j+1][i],points[j+1][n],points[j][n],color);}
      }
      function tube(a,b,ra,rb,color){
        const axis=norm(sub(b,a)),u=norm(cross(axis,Math.abs(axis[1])>.9?[1,0,0]:[0,1,0])),v=cross(axis,u),ar=[],br=[];
        for(let i=0;i<18;i++){const t=i/18*Math.PI*2,unit=add(mul(u,Math.cos(t)),mul(v,Math.sin(t)));ar.push(add(a,mul(unit,ra)));br.push(add(b,mul(unit,rb)));}
        for(let i=0;i<18;i++){const n=(i+1)%18;quad(ar[i],br[i],br[n],ar[n],color);triangle(a,ar[n],ar[i],color);triangle(b,br[i],br[n],color);}
      }
      function knee(hip,ankle){
        const delta=sub(ankle,hip),d=Math.min(.949,Math.hypot(...delta)),axis=norm(delta),upper=.48,lower=.47;
        const along=(upper*upper-lower*lower+d*d)/(2*d),bend=Math.sqrt(Math.max(.001,upper*upper-along*along));
        const front=[0,0,1],direction=norm(sub(front,mul(axis,dot(front,axis))));
        return add(add(hip,mul(axis,along)),mul(direction,bend));
      }
      const pose=state.pose,l=pose.left,r=pose.right;
      const bodyX=(l.x+r.x)*.15+pose.weight*.052,bodyZ=(l.z+r.z)*.22,bounce=pose.bounce,turn=pose.turn+pose.weight*.025;
      const body=(x,y,z)=>[bodyX+x*Math.cos(turn)+z*Math.sin(turn),y+bounce,bodyZ-x*Math.sin(turn)+z*Math.cos(turn)];
      const rings=[[.98,.155,.112],[1.06,.145,.104],[1.18,.154,.11],[1.31,.18,.12],[1.40,.21,.118],[1.445,.193,.103],[1.48,.075,.058]];
      const torso=rings.map(([y,rx,rz])=>Array.from({length:24},(_,i)=>{const a=i/24*Math.PI*2;return body(Math.cos(a)*rx,y,Math.sin(a)*rz);}));
      for(let j=0;j<torso.length-1;j++)for(let i=0;i<24;i++){const n=(i+1)%24;quad(torso[j][i],torso[j+1][i],torso[j+1][n],torso[j][n],palette.shirt);}
      ellipsoid(body(0,.94,0),[.15,.09,.108],palette.pants);
      tube(body(0,1.46,0),body(0,1.54,0),.047,.045,palette.skin);
      ellipsoid(body(0,1.625,.002),[.108,.14,.10],palette.skin,24,14);
      ellipsoid(body(0,1.64,-.001),[.111,.13,.103],palette.hair,24,10,0,Math.PI*.57);
      ellipsoid(body(0,1.615,.098),[.018,.024,.025],palette.skin,12,8);
      for(const [side,foot,color,letter] of [[-1,l,palette.left,'L'],[1,r,palette.right,'R']]){
        const hip=body(side*.095,.965,0),ankle=[foot.x,.10+foot.y,foot.z],joint=knee(hip,ankle);
        tube(hip,joint,.076,.057,palette.pants);ellipsoid(joint,[.058,.058,.059],palette.pants,10,6);tube(joint,ankle,.056,.038,palette.pants);
        const shoulder=body(side*.20,1.40,0),elbow=body(side*.275,1.18,.085),wrist=body(side*.265,1.235,.285),sleeve=body(side*.242,1.29,.045);
        ellipsoid(shoulder,[.062,.065,.064],palette.shirt);tube(shoulder,sleeve,.062,.054,palette.shirt);tube(sleeve,elbow,.046,.037,palette.skin);ellipsoid(elbow,[.039,.042,.04],palette.skin);tube(elbow,wrist,.037,.027,palette.skin);ellipsoid(body(side*.265,1.242,.32),[.034,.032,.055],palette.skin);
        // Rounded toe and heel; the ankle meets the shoe instead of floating above it.
        const shape=[[-.058,-.10],[.058,-.10],[.080,-.045],[.085,.13],[.050,.205],[0,.221],[-.05,.205],[-.085,.13],[-.08,-.045]];
        const bottom=shape.map(([x,z])=>[foot.x+x,.023+foot.y,foot.z+z]),top=shape.map(([x,z])=>[foot.x+x*.85,.082+foot.y-(z>.10?.02:0),foot.z+z]);
        const center=[foot.x,.10+foot.y,foot.z+.04];
        for(let i=0;i<shape.length;i++){const n=(i+1)%shape.length;quad(bottom[i],top[i],top[n],bottom[n],palette.sole);triangle(center,top[i],top[n],color);}
        labels.push({point:[foot.x,.092+foot.y,foot.z+.145],letter});
      }
      faces.sort((a,b)=>b.depth-a.depth);
      for(const face of faces){g.beginPath();face.points.forEach((p,i)=>i?g.lineTo(p.x,p.y):g.moveTo(p.x,p.y));g.closePath();g.fillStyle=face.color;g.fill();}
      for(const label of labels){const p=project(label.point,cam);g.font=`700 ${clamp(p.k*.04,8,11)}px system-ui`;g.textAlign='center';g.textBaseline='middle';g.fillStyle='#252730';g.fillText(label.letter,p.x,p.y);}
    }
    function resize(){const rect=canvas.getBoundingClientRect(),ratio=Math.min(window.devicePixelRatio||1,2);width=Math.max(1,Math.round(rect.width*ratio));height=Math.max(1,Math.round(rect.height*ratio));canvas.width=width;canvas.height=height;render();}
    function setView(view){yaw=view==='front'?Math.PI:view==='side'?Math.PI/2:0;pitch=.12;distance=3.45;render();}
    function resetView(){setView('back');}
    canvas.addEventListener('pointerdown',e=>{drag={x:e.clientX,y:e.clientY};canvas.setPointerCapture(e.pointerId);});
    canvas.addEventListener('pointermove',e=>{if(!drag)return;yaw+=(e.clientX-drag.x)*.008;pitch=clamp(pitch+(e.clientY-drag.y)*.005,-.22,.8);drag={x:e.clientX,y:e.clientY};render();});
    canvas.addEventListener('pointerup',()=>drag=null);canvas.addEventListener('pointercancel',()=>drag=null);canvas.addEventListener('dblclick',resetView);
    canvas.addEventListener('wheel',e=>{e.preventDefault();distance=clamp(distance+e.deltaY*.003,2.7,4.7);render();},{passive:false});
    canvas.addEventListener('keydown',e=>{if(e.key==='ArrowLeft')yaw-=.12;else if(e.key==='ArrowRight')yaw+=.12;else if(e.key==='ArrowUp')pitch=clamp(pitch-.08,-.22,.8);else if(e.key==='ArrowDown')pitch=clamp(pitch+.08,-.22,.8);else if(e.key==='Home')return resetView();else return;e.preventDefault();e.stopPropagation();render();});
    if('ResizeObserver'in window)new ResizeObserver(resize).observe(canvas);else window.addEventListener('resize',resize);resize();
    return {resetView,setView,present(snapshot){state=snapshot;render();},showStep(frame,style){state={frame,pulse:0,pose:window.salsaTimeline.poseOf(frame,style)};render();}};
  };
})();
