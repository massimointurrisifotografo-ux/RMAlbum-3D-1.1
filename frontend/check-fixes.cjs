const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const esbuild = require('esbuild');
async function load(file) {
 const r=await esbuild.build({entryPoints:[file],bundle:true,platform:'node',format:'cjs',write:false,define:{'import.meta.env':'{}'},external:['react','react-dom/server']});
 const m={exports:{}};vm.runInNewContext(r.outputFiles[0].text,{module:m,exports:m.exports,require,console});return m.exports;
}
(async()=>{
 const g=await load('src/lib/config3d.ts');
 const cover={mode:'front',sizing:'file',frontWidth:33,height:35.5,spine:2,hinge:0,wrap:2.5,bleed:0,safe:1,dpi:300};
 const region=g.coverRegions(cover,30.5);
 assert.equal(region.front.x0,2.5);assert.equal(region.front.x1,30.5);
 assert.equal(region.front.y0,2.5);assert.equal(region.front.y1,33);
 assert.equal(region.spineSideNoWrap,false);
 console.log('OK risvolto 2,5 su tutti i lati: fronte visibile 28 x 30,5');
 const project={settings:{widthCm:61,heightCm:30.5},spreads:[{cover}]};
 const album=g.deriveAlbum(project);
 assert.equal(album.frontBandCm,2.5);assert.equal(album.boardWidthCm,30.5);assert.equal(album.boardHeightCm,30.5);
 assert.equal(album.orientation,'quadrato');assert.equal(g.boxCAvailable(album),true);
 const edited=g.withFrontBand(album,3);
 assert.equal(edited.boardWidthCm-edited.frontBandCm,28);
 assert.equal(g.deriveAlbum(project,edited).frontBandCm,3);
 assert.equal(g.deriveAlbum(project,edited).boardWidthCm,31);
 assert.equal(g.withFrontBand(album,0).boardWidthCm,28);
 assert.equal(g.deriveAlbum({...project,spreads:[{cover:{...cover,mode:'full',frontWidth:30.5,height:30.5,wrap:0}}]}).frontBandCm,0);
 assert.equal(g.boxDims(album,g.defaultBox()).innerW,31.5);
 assert.equal(cover.frontWidth,33);assert.equal(cover.wrap,2.5);
 console.log('OK fascia aggiuntiva: 28 + 2,5 = 30,5 quadrato; Box C abilitato; foto invariata; valore regolabile e persistente; completa senza aggiunta');
 const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
 const {Summary}=await load('src/components/ConfigPanel.tsx');
 const cfg={album:{coverModel:'material'},box:{type:'C',cInterior:'fabric'},materials:{boxCInterior:{code:'A'},boxCLidInterior:{code:'B'}}};
 const catalog={families:[{id:'one',name:'Vano-test'},{id:'two',name:'Coperchio-test'}],variants:[{code:'A',familyId:'one'},{code:'B',familyId:'two'}]};
 const html=renderToStaticMarkup(React.createElement(Summary,{cfg,catalog}));
 assert.match(html,/Vano-test/);assert.match(html,/Coperchio-test/);
 delete cfg.materials.boxCLidInterior;
 assert.equal((renderToStaticMarkup(React.createElement(Summary,{cfg,catalog})).match(/Vano-test/g)||[]).length,2);
 console.log('OK materiali distinti e compatibilità configurazioni precedenti');
 // Execute the current local save handlers, including failure behavior.
 const src=fs.readFileSync('src/components/Preview3D.tsx','utf8');
 const persist=src.slice(src.indexOf('  const persistLocal ='),src.indexOf('  useEffect(() => {',src.indexOf('  const persistLocal =')));
 const handlers=src.slice(src.indexOf('  const onChange ='),src.indexOf('  const photoList ='));
 const js=await esbuild.transform(persist+handlers+'\nglobalThis.localHandlers={onChange,doSave};',{loader:'ts'});
 let projectLocal={id:'p',name:'Test',spreads:[]},written=null,status='',fail=false;
 const context={cfg:{album:{},box:{type:'G'},materials:{}},setCfg:v=>{context.cfg=v;},setLocalStatus:v=>{status=v;},setBusy:()=>{},show:()=>{},
 deriveAlbum:(p,a)=>a,useStore:{getState:()=>({project:projectLocal,save:async()=>{if(fail)throw Error('quota');written=JSON.parse(JSON.stringify(projectLocal));}}),setState:s=>{projectLocal=s.project;}}};
 vm.runInNewContext(js.code,context);
 context.localHandlers.onChange({notes:'persistente'});
 assert.equal(projectLocal.productConfig.notes,'persistente');
 assert.equal(await context.localHandlers.doSave(),true);
 assert.equal(written.productConfig.notes,'persistente');
 fail=true;context.localHandlers.onChange({notes:'modifica da conservare'});
 assert.equal(await context.localHandlers.doSave(),false);
 assert.equal(projectLocal.productConfig.notes,'modifica da conservare');
 assert.equal(status,'Salvataggio non riuscito');
 console.log('OK configurazione nel progetto, salvataggio locale e conservazione in memoria se il disco fallisce');
})().catch(e=>{console.error(e);process.exit(1);});
