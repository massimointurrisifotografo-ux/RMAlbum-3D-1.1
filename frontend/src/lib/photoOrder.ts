import { Photo } from '../types';
const names = new Intl.Collator('it', { numeric:true, sensitivity:'base' });
export function sortPhotos(photos: Photo[], order: 'name'|'time' = 'name') {
  return [...photos].sort((a,b) => {
    if (order==='time') {
      const delta=(a.capturedAt || a.fileModifiedAt || Infinity)-(b.capturedAt || b.fileModifiedAt || Infinity);
      if (delta && !Number.isNaN(delta)) return delta;
    }
    return names.compare(a.name,b.name) || a.name.localeCompare(b.name) || a.id.localeCompare(b.id);
  });
}

// JPEG APP1/TIFF DateTimeOriginal; files without usable EXIF use lastModified.
export function exifTime(buffer: ArrayBuffer): number | undefined {
  try {
    const v=new DataView(buffer);
    if(v.getUint16(0)!==0xffd8)return;
    let p=2;
    while(p+4<=v.byteLength) {
      if(v.getUint8(p)!==255)return;
      const marker=v.getUint8(p+1), len=v.getUint16(p+2), end=p+2+len;
      if(marker===0xda || marker===0xd9 || len<2 || end>v.byteLength)return;
      if(marker===0xe1 && v.getUint32(p+4)===0x45786966 && v.getUint16(p+8)===0) {
        const base=p+10, le=v.getUint16(base)===0x4949;
        if(v.getUint16(base+2,le)!==42)return;
        const read=(off:number, tag:number): number|string|undefined => {
          const pos=base+off;
          if(pos<base || pos+2>end)return;
          const count=v.getUint16(pos,le);
          for(let i=0;i<count;i++) {
            const e=pos+2+i*12;
            if(e+12>end)return;
            if(v.getUint16(e,le)!==tag)continue;
            const type=v.getUint16(e+2,le), n=v.getUint32(e+4,le), value=v.getUint32(e+8,le);
            if(type===4 && n===1)return value;
            if(type===2 && n>=19 && n<=64 && base+value>=base && base+value+n<=end)
              return String.fromCharCode(...new Uint8Array(buffer,base+value,19));
          }
        };
        const ifd=v.getUint32(base+4,le), exif=read(ifd,0x8769);
        const date=typeof exif==='number' ? read(exif,0x9003) : undefined;
        if(typeof date!=='string')return;
        const m=/^(\d{4}):(\d{2}):(\d{2}) (\d{2}):(\d{2}):(\d{2})$/.exec(date);
        if(!m)return;
        const [y,mo,d,h,mi,s]=m.slice(1).map(Number);
        const dt=new Date(y,mo-1,d,h,mi,s);
        if(dt.getFullYear()===y && dt.getMonth()===mo-1 && dt.getDate()===d && h<24 && mi<60 && s<60)return dt.getTime();
        return;
      }
      p=end;
    }
  } catch { return; }
}
