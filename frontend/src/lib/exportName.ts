export function zipFileName(name:string,quality:number) {
  const safe=name.replace(/[^\w\-]+/g,'_');
  return `RMAlbum_${safe}${quality<1?`_Jpg${Math.round(quality*100)}`:''}.zip`;
}
