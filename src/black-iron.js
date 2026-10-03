const ice=new Image();ice.src=new URL('../assets/black-iron/iceberg.png',import.meta.url);
export function textureIce(ctx,x,y,w,h,fog){
 if(!ice.complete||!ice.naturalWidth)return;
 ctx.save();ctx.clip();ctx.globalAlpha=.4*(1-fog);ctx.filter='saturate(.4) brightness(.85)';
 ctx.drawImage(ice,ice.naturalWidth*.12,ice.naturalHeight*.28,ice.naturalWidth*.70,ice.naturalHeight*.53,x,y-h*1.3,w,h*1.5);ctx.restore();
}
export function installBlackIron(world){
 for(const [id,label,arrow] of [['turnleft','PORT','◀'],['turnright','STARBOARD','▶']]){
 const b=document.getElementById(id);b.innerHTML='<span class="steer-arrow">'+arrow+'</span><span>'+label+'</span>';b.setAttribute('aria-label','Hold to turn '+label.toLowerCase());
 }
 document.getElementById('camopenhint').textContent='Hold PORT or STARBOARD to turn · release to stop · arrow keys also work';
 const cv=document.createElement('canvas');cv.width=280;cv.height=280;cv.id='fire-art';cv.setAttribute('aria-hidden','true');document.getElementById('furnacedoor').append(cv);const ctx=cv.getContext('2d');const reduce=matchMedia('(prefers-reduced-motion: reduce)');let last=0;
 function draw(ms){requestAnimationFrame(draw);if(document.hidden||ms-last<(reduce.matches?200:33))return;last=ms;const t=reduce.matches?0:ms/1000;ctx.clearRect(0,0,280,280);ctx.fillStyle='#080a09';ctx.fillRect(0,0,280,280);if(!world.furnace.lit)return;const heat=Math.min(1,world.furnace.heat/100);let g=ctx.createRadialGradient(140,235,5,140,205,155);g.addColorStop(0,'#e78029');g.addColorStop(.45,'#852c0d');g.addColorStop(1,'#100b08');ctx.fillStyle=g;ctx.fillRect(0,0,280,280);
 for(let i=0;i<13;i++){const x=22+i*19,w=16+8*Math.sin(i*2),h=(50+heat*100)*( .6+.25*Math.sin(t*3+i*1.8)+.12*Math.sin(t*7+i));const sway=13*Math.sin(t*2.5+i);g=ctx.createLinearGradient(x,250,x,250-h);g.addColorStop(0,'#ffe2a0');g.addColorStop(.3,'#ffac3f');g.addColorStop(.7,'#de5719');g.addColorStop(1,'#9a250000');ctx.fillStyle=g;ctx.beginPath();ctx.moveTo(x-w,252);ctx.bezierCurveTo(x-w*1.3,210,x+sway-w,250-h*.7,x+sway,250-h);ctx.bezierCurveTo(x+sway+5,250-h*.4,x+w,220,x+w,252);ctx.fill();}
 for(let i=0;i<22;i++){const x=(i*73)%260+10,y=242+(i%3)*10;ctx.fillStyle=i%3?'#2b1b12':'#9f3f15';ctx.beginPath();ctx.ellipse(x,y,16,9,i,0,Math.PI*2);ctx.fill();ctx.strokeStyle='#e07a2544';ctx.stroke();}for(let i=0;i<8;i++){let age=(t*.27+i*.139)%1;ctx.globalAlpha=(1-age)*.8;ctx.fillStyle='#ffcf79';ctx.fillRect(30+i*30+Math.sin(t+i)*10,240-age*190,2,3)}ctx.globalAlpha=1;}
 requestAnimationFrame(draw);
}
