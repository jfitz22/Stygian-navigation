const names=['fog','skiff','tower','ice0','ice1','ice2'];
export const art=Object.fromEntries(names.map(n=>{const i=new Image();i.src=new URL('../assets/'+n+(n==='fog'?'.jpg':'.png'),import.meta.url);return [n,i]}));
export const artOn=()=>!document.body.classList.contains('asset-off');
export function sprite(ctx,name,x,y,w,h,crop){const i=art[name];if(!artOn()||!i?.complete||!i.naturalWidth)return false;ctx.drawImage(i,...(crop||[0,0,i.width,i.height]),x,y,w,h);return true;}
