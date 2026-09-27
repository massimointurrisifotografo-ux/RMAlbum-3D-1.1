const {buildSync}=require('esbuild'),vm=require('node:vm'),assert=require('node:assert/strict');
function load(file){const r=buildSync({entryPoints:[file],bundle:true,platform:'node',format:'cjs',write:false});const c={module:{exports:{}},console};vm.runInNewContext(r.outputFiles[0].text,c);return c.module.exports;}
const render=load('src/lib/photoRender.ts'),cover=load('src/lib/cover.ts'),art=load('src/lib/artigiano.ts'),cfg=load('src/lib/config3d.ts');
let tests=0;
for(const [iw,ih] of [[4000,6000],[6000,4000],[1000,1000]])for(const [w,h] of [[300,100],[100,300],[200,200]])for(const a of [-45,-20,0,20,45])for(const ox of [-1,0,1])for(const oy of [-1,0,1]){
 const t=render.photoTransform(iw,ih,w,h,1.3,ox,oy,a),rad=-a*Math.PI/180;
 for(const [x,y] of [[0,0],[w,0],[0,h],[w,h]]){
  const dx=x-t.x,dy=y-t.y,ix=dx*Math.cos(rad)-dy*Math.sin(rad),iy=dx*Math.sin(rad)+dy*Math.cos(rad);
  assert.ok(Math.abs(ix)<=t.w/2+1e-6 && Math.abs(iy)<=t.h/2+1e-6,'Angolo foto scoperto');
 }
 assert.ok(Math.abs(t.w/t.h-iw/ih)<1e-8,'Foto deformata');tests++;
}
const p={id:'test',name:'Test',settings:{widthCm:61,heightCm:30.5,dpi:300},spreads:[{id:'s',cells:[]}]};
for(const preset of art.ARTIGIANO){
 if(!preset.front)continue;
 const c=art.artisanCover(preset.id,'front',p),g=cover.coverGeometry(c),r=cfg.coverRegions(c);
 assert.equal(c.wrap,1.5);assert.equal(c.safe,1);
 assert.equal(g.width,preset.front[0]);assert.equal(g.height,preset.front[1]);
 assert.equal(r.front.x1-r.front.x0,preset.front[0]-3);
 const legacy={...c,wrap:2.5};assert.equal(cfg.coverRegions(legacy).front.x0,1.5);
 assert.equal(cover.coverGeometry(legacy).width,g.width);tests++;
}
const custom={...art.artisanCover('artigiano3030','front',p),artisanId:undefined,wrap:2.5};
assert.equal(cover.normalizeCover(custom).wrap,2.5);
assert.equal(render.photoAngle(-90),-45);assert.equal(render.photoAngle(90),45);
const withCover={...p,spreads:[...p.spreads,{cover:art.artisanCover('artigiano3030','front',p)}]};
assert.equal(cfg.deriveAlbum(withCover,cfg.deriveAlbum(p)).frontBandCm,2.5);
assert.equal(cfg.deriveAlbum(withCover,{...cfg.deriveAlbum(withCover),frontBandCm:0}).frontBandCm,0);
assert.equal(cfg.deriveAlbum(withCover,{...cfg.deriveAlbum(withCover),frontBandCm:3}).frontBandCm,3);
console.log(tests+' casi superati: proporzioni, rotazione, angoli coperti, formati stampa, migrazione risvolti.');
const fs=require('node:fs'),{transformSync}=require('esbuild');
const editor=fs.readFileSync('src/components/Editor.tsx','utf8');
const dragSource=editor.slice(editor.indexOf('  const beginDrag ='),editor.indexOf('  const finishTransform ='));
const dragJS=transformSync(dragSource+'\nglobalThis.handlers={beginDrag,dragGroup};',{loader:'ts'}).code;
const cells=[{id:'a',photoId:'pa',x:.1,y:.1,w:.3,h:.6},{id:'b',photoId:'pb',x:.6,y:.1,w:.3,h:.6}];
let ghost=null,swaps=[],pointer={x:150,y:150};
const context={clearSnap:()=>{},useStore:{getState:()=>({selectedCellIds:['a']})},spread:{cells},dragState:{current:null},altHeld:{current:false},spreadW:1000,spreadH:500,
 stageRef:{current:{getPointerPosition:()=>pointer,container:()=>({getBoundingClientRect:()=>({left:0,top:0})})}},
 layerRef:{current:{findOne:()=>({position:()=>{}})}},photos:{pa:{thumbUrl:'test'}},setSwapGhost:g=>{ghost=g;},swapPhotos:(a,b)=>swaps.push([a,b])};
vm.runInNewContext(dragJS,context);
let position;const node={position:p=>{position=p;}};
context.handlers.beginDrag('a',false);assert.equal(context.handlers.dragGroup('a',node,false),false);
context.altHeld.current=true;pointer={x:700,y:200};context.handlers.dragGroup('a',node,false);
assert.ok(ghost);assert.equal(position.x,100);
context.handlers.dragGroup('a',node,true);assert.equal(ghost,null);assert.equal(swaps.length,1);assert.equal(swaps[0][1],'b');
swaps=[];context.altHeld.current=false;context.handlers.beginDrag('a',false);context.altHeld.current=true;pointer={x:1200,y:200};context.handlers.dragGroup('a',node,true);assert.equal(swaps.length,0);
console.log('OK Option dopo il clic: cella ferma, miniatura, scambio al rilascio; fuori foglio nessuno scambio.');
