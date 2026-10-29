const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const OUT=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v36'),BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8096';
fs.mkdirSync(OUT+'/videos',{recursive:true});
const logs=[];
async function pause(p,ms){await p.waitForTimeout(ms);}
async function mark(p,label){logs.push({label,...await p.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight,states:[...document.querySelectorAll('.focus-journey')].map(e=>({area:e.closest('section').id,index:e.dataset.activeIndex,mode:e.dataset.mode}))}))});}
(async()=>{const b=await chromium.launch({channel:'msedge',headless:true});try{
 for(const mobile of [false,true]){
  const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
  const c=await b.newContext({viewport,isMobile:mobile,hasTouch:mobile,recordVideo:{dir:OUT+'/videos',size:viewport}}),p=await c.newPage();
  await p.goto(BASE+'/research.html');const j=p.locator('#learning .focus-journey');
  if(!mobile)await j.evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-24));else await j.scrollIntoViewIfNeeded();
  // The ring annotates the test pointer only; all page content is real rendering.
  await p.evaluate(()=>{const ring=document.createElement('div');ring.id='qa-pointer';Object.assign(ring.style,{position:'fixed',width:'16px',height:'16px',border:'2px solid #bc6543',borderRadius:'50%',pointerEvents:'none',zIndex:'9999',display:'none'});document.body.append(ring);addEventListener('pointermove',e=>{ring.style.display='block';ring.style.left=(e.clientX-8)+'px';ring.style.top=(e.clientY-8)+'px';});});
  await p.mouse.move(5,5);await pause(p,1500);await mark(p,'initial-'+(mobile?'mobile':'desktop'));
  if(!mobile){
   await p.mouse.wheel(0,540);await pause(p,1800);await mark(p,'natural-wheel-P2');
   await p.mouse.wheel(0,540);await pause(p,1800);await mark(p,'natural-wheel-P3');
   await p.mouse.wheel(0,-1080);await pause(p,1500);
   const box=await j.locator('.focus-paper').nth(1).boundingBox();await p.mouse.move(box.x+box.width-30,box.y+box.height/2,{steps:15});await pause(p,1800);await mark(p,'row-blank-hover-P2');
   await p.mouse.move(5,5,{steps:15});await pause(p,1500);await mark(p,'hover-leave-restore-P1');
   await j.locator('.paper-trigger').nth(2).click();await pause(p,1800);await mark(p,'click-P3');
   await j.locator('.paper-trigger').nth(2).focus();await p.keyboard.press('ArrowUp');await pause(p,1800);await mark(p,'keyboard-Up-P2');
  }else{
   for(const i of [1,2,0]){await j.locator('.paper-trigger').nth(i).click();await pause(p,2500);await mark(p,'mobile-click-P'+(i+1));}
  }
  const zoom=j.locator('.is-active .figure-zoom').first();await zoom.click();await pause(p,2300);await mark(p,'figure-viewer');await p.keyboard.press('Escape');await pause(p,1300);assert(await zoom.evaluate(e=>e===document.activeElement));await mark(p,'Escape-focus-return');
  const target=mobile?'mobile-390-click-viewer.webm':'desktop-1440-wheel-hover-keyboard.webm';
  const v=p.video();await c.close();await v.saveAs(OUT+'/videos/'+target);await v.delete();
 }
}finally{await b.close();fs.writeFileSync(OUT+'/logs/recording_actions.json',JSON.stringify({pointerRing:'Test-only annotation over actual browser capture',actions:logs},null,2));}})().catch(e=>{console.error(e);process.exitCode=1});
