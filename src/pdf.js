// Browser-local PDF export: high-resolution JPEG pages embedded in a valid PDF.
// Rendering text through Canvas preserves Ukrainian glyphs without external fonts.
export async function makePDF(puzzle,title,{answers=false}={}){
 const pages=[],W=1240,H=1754,M=85;
 function page(label){const c=document.createElement('canvas');c.width=W;c.height=H;const x=c.getContext('2d');x.fillStyle='#fff';x.fillRect(0,0,W,H);x.fillStyle='#19483e';x.font='bold 19px Arial';x.fillText('ПЕРЕТИН / МАЙСТЕРНЯ КРОСВОРДІВ',M,65);x.fillStyle='#162b27';x.font='bold 34px Arial';wrap(x,title,M,125,W-2*M,43);x.font='18px Arial';x.fillStyle='#64736e';x.fillText(label,M,190);pages.push(c);return x;}
 let x=page(answers?'Аркуш із відповідями':'Заповніть сітку за описами на наступних сторінках.');
 const s=Math.min(52,(W-2*M)/puzzle.width,(H-410)/puzzle.height),left=(W-puzzle.width*s)/2,top=250;
 const cells=new Map(puzzle.cells.map(c=>[`${c.x},${c.y}`,c]));
 for(let r=0;r<puzzle.height;r++)for(let col=0;col<puzzle.width;col++){const c=cells.get(`${col},${r}`),px=left+col*s,py=top+r*s;x.fillStyle=c?'#ffffff':'#f0f2f0';x.fillRect(px,py,s,s);if(!c)continue;x.strokeStyle='#344b43';x.lineWidth=1.2;x.strokeRect(px,py,s,s);if(c.number){x.font=`${Math.max(8,s*.23)}px Arial`;x.fillStyle='#2c4e40';x.fillText(c.number,px+s*.09,py+s*.27);}if(answers){x.font=`bold ${s*.51}px Arial`;x.fillStyle='#142e25';x.textAlign='center';x.fillText(c.char,px+s*.52,py+s*.77);x.textAlign='left';}}
 x.font='20px Arial';x.fillStyle='#64736e';x.fillText(`${puzzle.placed.length} слів  ·  ${puzzle.width} × ${puzzle.height} клітинок`,M,H-125);
 x=page('Запитання до кросворда');let y=255;
 for(const [dir,label]of[['across','За горизонталлю'],['down','За вертикаллю']]){if(y>H-250){x=page('Запитання · продовження');y=255;}x.font='bold 27px Arial';x.fillStyle='#19483e';x.fillText(label,M,y);y+=48;
  for(const p of puzzle.placed.filter(p=>p.dir===dir)){x.font='21px Arial';const text=`${p.number}. ${p.clue} (${p.word.length})${answers?' — '+p.word:''}`,lines=linesFor(x,text,W-2*M);if(y+lines.length*31>H-135){x=page(label+' · продовження');y=255;x.font='21px Arial';}x.fillStyle='#203b32';for(const line of lines){x.fillText(line,M,y);y+=31;}y+=20;}y+=25;
 }
 pages.forEach((c,i)=>{const cx=c.getContext('2d');cx.strokeStyle='#dbe2dd';cx.beginPath();cx.moveTo(M,H-80);cx.lineTo(W-M,H-80);cx.stroke();cx.font='17px Arial';cx.fillStyle='#77867c';cx.fillText('Перетин · '+(answers?'Відповіді':'Навчальний кросворд'),M,H-49);cx.textAlign='right';cx.fillText(`${i+1} / ${pages.length}`,W-M,H-49);});
 const enc=new TextEncoder(),chunks=[],offsets=[0];let length=0;
 function add(v){const bytes=typeof v==='string'?enc.encode(v):v;chunks.push(bytes);length+=bytes.length;}
 function obj(n,v){offsets[n]=length;add(`${n} 0 obj\n`);add(v);add('\nendobj\n');}
 add('%PDF-1.4\n');obj(1,'<< /Type /Catalog /Pages 2 0 R >>');obj(2,`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
 for(let i=0;i<pages.length;i++){const n=3+i*3,raw=atob(pages[i].toDataURL('image/jpeg',.96).split(',')[1]),jpeg=Uint8Array.from(raw,c=>c.charCodeAt(0));obj(n,`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im0 ${n+1} 0 R >> >> /Contents ${n+2} 0 R >>`);offsets[n+1]=length;add(`${n+1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${W} /Height ${H} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);add(jpeg);add('\nendstream\nendobj\n');const stream='q 595.28 0 0 841.89 0 0 cm /Im0 Do Q';obj(n+2,`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);}
 const start=length,count=3+pages.length*3;add(`xref\n0 ${count}\n0000000000 65535 f \n`);for(let i=1;i<count;i++)add(`${String(offsets[i]).padStart(10,'0')} 00000 n \n`);add(`trailer\n<< /Size ${count} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);return new Blob(chunks,{type:'application/pdf'});
}
function linesFor(ctx,text,width){const out=[];let line='';for(const word of text.split(/\s+/)){if(line&&ctx.measureText(line+' '+word).width>width){out.push(line);line=word;}else line+=(line?' ':'')+word;}if(line)out.push(line);return out;}
function wrap(ctx,text,x,y,width,lineHeight){for(const line of linesFor(ctx,text,width)){ctx.fillText(line,x,y);y+=lineHeight;}}
export function download(blob,name){const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}
