/* Identical absolute mouse coordinates, same viewport and title anchor, two areas. */
const {chromium}=require('playwright'),fs=require('fs');
const version=process.argv[2],base=process.argv[3],out='tmp/v35';
(async()=>{const browser=await chromium.launch({headless:true,channel:'msedge'}),records=[];
for(const area of ['learning','signals']){
 const context=await browser.newContext({viewport:{width:1440,height:900},recordVideo:{dir:out+'/videos',size:{width:1440,height:900}}});
 const p=await context.newPage();await p.goto(base+'/research.html');await p.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode().catch(()=>{})));});
 await p.evaluate(area=>{const title=document.querySelector('#'+area+' .research-paper-title');scrollTo(0,scrollY+title.getBoundingClientRect().top-220);window.__calls=[];for(const n of ['scrollBy','scrollTo']){const f=window[n];window[n]=function(...a){__calls.push({name:n,args:a,time:performance.now()});return f.apply(this,a);};}const cursor=document.createElement('div');cursor.style.cssText='position:fixed;width:14px;height:14px;border:2px solid #b73f40;border-radius:50%;z-index:99999;pointer-events:none';document.body.append(cursor);addEventListener('mousemove',e=>{cursor.style.left=(e.clientX-7)+'px';cursor.style.top=(e.clientY-7)+'px';});},area);
 const points=[{x:185,y:205},{x:300,y:240},{x:185,y:420},{x:300,y:470},{x:185,y:650},{x:300,y:240},{x:300,y:470},{x:40,y:160}];const timeline=[];
 for(const point of points){await p.mouse.move(point.x,point.y,{steps:8});await p.waitForTimeout(500);timeline.push({...point,scrollY:await p.evaluate(()=>scrollY)});}
 const record={version,area,viewport:{width:1440,height:900},firstTitleTop:220,absolutePoints:points,timeline,applicationScrollCalls:await p.evaluate(()=>__calls),annotation:'A test-only fixed-position pointer ring is included in the real browser recording; it is not product UI.'};records.push(record);
 const video=p.video();await context.close();await video.saveAs(`${out}/videos/fixed_${version}_${area}.webm`);
}
await browser.close();fs.writeFileSync(`${out}/logs/fixed_${version}_comparison.json`,JSON.stringify(records,null,2));console.log(records.map(x=>({version,area:x.area,scrollCalls:x.applicationScrollCalls.length})));})().catch(e=>{console.error(e);process.exit(1)});
