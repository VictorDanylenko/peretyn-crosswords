export const key=(x,y)=>`${x},${y}`;
export function normalize(word){return word.normalize('NFC').toLocaleUpperCase('uk-UA').replace(/[\s’'ʼ-]/gu,'');}
export function validate(entries){
 const errors=[], seen=new Set();
 if(entries.length<2)errors.push('Додайте щонайменше два слова для перетину.');
 if(entries.length>60)errors.push('В одному кросворді може бути до 60 слів.');
 for(const e of entries){const w=normalize(e.word);if(!/^[А-ЩЬЮЯЄІЇҐA-Z]{2,24}$/u.test(w))errors.push(`Рядок ${e.id}: слово має містити 2–24 літери без цифр.`);if(seen.has(w))errors.push(`Слово «${w}» повторюється.`);seen.add(w);if(!e.clue.trim())errors.push(`Додайте запитання до слова «${w}».`);}
 return errors;
}
function random(seed){return()=>{seed=(seed+0x6D2B79F5)>>>0;let t=seed;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return((t^t>>>14)>>>0)/4294967296;};}
function bounds(placed){let minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;for(const p of placed){minX=Math.min(minX,p.x);minY=Math.min(minY,p.y);maxX=Math.max(maxX,p.x+(p.dir==='across'?p.word.length-1:0));maxY=Math.max(maxY,p.y+(p.dir==='down'?p.word.length-1:0));}return{minX,minY,maxX,maxY,width:maxX-minX+1,height:maxY-minY+1};}
function fit(grid, word,x,y,dir){const dx=dir==='across'?1:0,dy=1-dx;if(grid.has(key(x-dx,y-dy))||grid.has(key(x+dx*word.length,y+dy*word.length)))return 0;let crosses=0;
 for(let i=0;i<word.length;i++){const cx=x+dx*i,cy=y+dy*i,c=grid.get(key(cx,cy));if(c){if(c.char!==word[i]||c.dirs.includes(dir))return 0;crosses++;}else if(grid.has(key(cx-dy,cy-dx))||grid.has(key(cx+dy,cy+dx)))return 0;}
 return crosses;
}
function put(grid,p){for(let i=0;i<p.word.length;i++){const x=p.x+(p.dir==='across'?i:0),y=p.y+(p.dir==='down'?i:0),k=key(x,y),old=grid.get(k);grid.set(k,{x,y,char:p.word[i],dirs:[...(old?.dirs||[]),p.dir]});}}
export function generate(input,{seed=Date.now(),attempts=180,maxDimension=45}={}){
 const errors=validate(input);if(errors.length)throw Error(errors.join('\n'));const entries=input.map(e=>({...e,word:normalize(e.word)})),rng=random(seed);let best;
 for(let attempt=0;attempt<attempts;attempt++){
  const sorted=[...entries].sort((a,b)=>b.word.length-a.word.length);const root=sorted[attempt%Math.min(sorted.length,8)];const placed=[{...root,x:0,y:0,dir:attempt%2?'down':'across'}],grid=new Map();put(grid,placed[0]);let remaining=entries.filter(e=>e.id!==root.id),stalled=false;
  while(remaining.length&&!stalled){let choice=null;
   for(const e of remaining){for(let i=0;i<e.word.length;i++){for(const c of grid.values()){if(c.char!==e.word[i]||c.dirs.length===2)continue;const dir=c.dirs[0]==='across'?'down':'across',x=c.x-(dir==='across'?i:0),y=c.y-(dir==='down'?i:0);const crosses=fit(grid,e.word,x,y,dir);if(!crosses)continue;const p={...e,x,y,dir},b=bounds([...placed,p]);if(b.width>maxDimension||b.height>maxDimension)continue;const score=crosses*35-b.width*b.height*.22-Math.abs(b.width-b.height)*2+rng()*20+e.word.length*.3;if(!choice||score>choice.score)choice={p,score};}}}
   if(choice){placed.push(choice.p);put(grid,choice.p);remaining=remaining.filter(e=>e.id!==choice.p.id);}else stalled=true;
  }
  const b=bounds(placed),intersections=[...grid.values()].filter(c=>c.dirs.length===2).length,quality=placed.length*10000-b.width*b.height+intersections*7-Math.abs(b.width-b.height)*3;
  if(!best||quality>best.quality)best={placed,remaining,b,quality};
 }
 const {b}=best,placed=best.placed.map(p=>({...p,x:p.x-b.minX,y:p.y-b.minY})).sort((a,b)=>a.y-b.y||a.x-b.x||a.dir.localeCompare(b.dir)),starts=new Map();let num=0;for(const p of placed){const k=key(p.x,p.y);if(!starts.has(k))starts.set(k,++num);p.number=starts.get(k);}
 const cells=new Map();placed.forEach(p=>put(cells,p));return{placed,omitted:best.remaining,width:b.width,height:b.height,cells:[...cells.values()].map(c=>({...c,number:starts.get(key(c.x,c.y))||null})),seed};
}
export function verify(puzzle){
 const seen=new Set([puzzle.placed[0]?.id]);let change=true;while(change){change=false;for(const a of puzzle.placed)if(seen.has(a.id))for(const b of puzzle.placed)if(!seen.has(b.id)&&a.dir!==b.dir){const h=a.dir==='across'?a:b,v=a.dir==='down'?a:b;if(v.x>=h.x&&v.x<h.x+h.word.length&&h.y>=v.y&&h.y<v.y+v.word.length&&h.word[v.x-h.x]===v.word[h.y-v.y]){seen.add(b.id);change=true;}}}
 return seen.size===puzzle.placed.length;
}
