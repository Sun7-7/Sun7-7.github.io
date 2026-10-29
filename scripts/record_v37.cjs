const {chromium}=require('playwright');const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8097',OUT=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v37');
fs.mkdirSync(OUT+'/videos',{recursive:true});const actions=[];
(async()=>{const b=await chromium.launch({channel:'msedge'});try{for(const mobile of [false,true]){
 const viewport=mobile?{width:390,height:844}:{width:1440,height:900};
 const c=await b.newContext({viewport,isMobile:mobile,hasTouch:mobile,recordVideo:{dir:OUT+'/videos',size:viewport}}),p=await c.newPage(),started=Date.now();
 const mark=async label=>actions.push({label,mobile,...await p.evaluate(()=>({y:scrollY,height:document.documentElement.scrollHeight,paper:document.querySelector('#learning .focus-journey').dataset.activeIndex,figures:[...document.querySelectorAll('#learning .focus-figures')].map(s=>({primary:s.dataset.primaryIndex,state:s.dataset.mediaState}))}))});
 await p.goto(BASE+'/research.html');const j=p.locator('#learning .focus-journey');
 if(mobile)await j.scrollIntoViewIfNeeded();else await j.evaluate(e=>scrollTo(0,e.getBoundingClientRect().top+scrollY-24));await p.waitForTimeout(900);await mark('P1 default');
 if(mobile)await j.locator('.paper-trigger').nth(1).click();else await p.mouse.wheel(0,540);await p.waitForTimeout(1000);await mark('natural wheel / tap P2');
 const stage=j.locator('.is-active .focus-figures');const other=1-Number(await stage.getAttribute('data-primary-index'));
 if(!mobile){await stage.locator('.figure-select').nth(other).hover();await p.waitForTimeout(900);await mark('secondary hover');await p.mouse.move(2,2);await p.waitForTimeout(600);await mark('hover restores default');}
 await stage.locator('.figure-select').nth(other).click();await p.waitForTimeout(1100);await mark('secondary click pins');
 await stage.locator('.is-primary .figure-zoom').click();await p.waitForTimeout(1600);await mark('explicit viewer');await p.keyboard.press('Escape');await p.waitForTimeout(300);assert(await stage.locator('.is-primary .figure-zoom').evaluate(e=>e===document.activeElement));
 await stage.locator('.reset-figure').click();await p.waitForTimeout(700);await mark('reset primary');
 await j.locator('.paper-trigger').nth(2).click();await p.waitForTimeout(1100);await mark('click P3');
 await j.locator('.paper-trigger').nth(2).focus();await p.keyboard.press('ArrowUp');await p.waitForTimeout(1100);await mark('keyboard outer P2');
 await p.waitForTimeout(Math.max(0,18000-(Date.now()-started)));const video=p.video();await c.close();await video.saveAs(OUT+'/videos/'+(mobile?'v37-mobile-390':'v37-desktop-1440')+'.webm');await video.delete();
}}finally{await b.close();fs.writeFileSync(OUT+'/logs/recording_actions.json',JSON.stringify({environment:'Real headless Edge screen recording; no generated visual frames',actions},null,2));}})().catch(e=>{console.error(e);process.exit(1)});
