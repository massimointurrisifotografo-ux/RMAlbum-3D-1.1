import { CoverSettings, Preset, Project, DEFAULT_SETTINGS } from '../types';

export const ARTIGIANO = [
  {id:'artigiano3020',name:'Artigiano3020',width:61,height:20.3,front:[33,25]},
  {id:'artigiano2030',name:'Artigiano2030',width:40.6,height:30.5,front:null},
  {id:'artigiano2525',name:'Artigiano2525',width:50.8,height:25.4,front:[28,30.5]},
  {id:'artigiano3030',name:'Artigiano3030',width:61,height:30.5,front:[33,35.5]},
  {id:'artigiano3525',name:'Artigiano3525',width:71,height:25.4,front:[38,30.5]},
  {id:'artigiano4030',name:'Artigiano4030',width:81,height:30.5,front:[43,35.5]},
];
export const albumPresets: Preset[]=ARTIGIANO.map(p=>({id:p.id,name:p.name,settings:{...DEFAULT_SETTINGS,widthCm:p.width,heightCm:p.height,bleedCm:0,safeCm:0,gutterCm:0}}));
export const spineFor=(project:Project)=>project.spreads.filter(s=>!s.cover).length/10;
export function artisanCover(id:string,mode:'front'|'full',project:Project,unit:'cm'|'mm'='cm'):CoverSettings|null {
  const p=ARTIGIANO.find(p=>p.id===id);
  if(!p || (mode==='front' && !p.front))return null;
  return {mode,unit,sizing:'file',artisanId:id,frontWidth:mode==='front'?p.front![0]:p.width/2,
    height:mode==='front'?p.front![1]:p.height,spine:spineFor(project),hinge:0,
    wrap:mode==='front'?1.5:0,bleed:0,safe:1,dpi:project.settings.dpi};
}
