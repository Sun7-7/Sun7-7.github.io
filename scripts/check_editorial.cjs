/* V3.2 focused regression: dark detail views and Unicode language labels. */
const {chromium}=require('playwright');
const fs=require('fs'),path=require('path'),assert=require('assert/strict');
const BASE=process.env.TEST_BASE_URL||'http://127.0.0.1:8091';
const out=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/review');
const scenes=[];
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:process.platform==='win32'?{channel:'msedge'}:{})});
 for(const width of [1440,390])for(const lang of ['zh','en']){
  const page=await browser.newPage({viewport:{width,height:width===1440?900:844}});
  await page.addInitScript(()=>localStorage.setItem('theme','dark'));
  await page.goto(`${BASE}/${lang==='en'?'en/':''}papers/mte-ste-continuous-temporal-signal-classification.html`,{waitUntil:'networkidle'});
  await page.evaluate(async()=>{for(const i of document.images)i.loading='eager';await Promise.all([...document.images].map(i=>i.decode()));});
  assert.equal(await page.locator('html').getAttribute('data-theme'),'dark');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),width);
  const text=await page.locator('.language-switch').innerText(),label=await page.locator('.language-switch').getAttribute('aria-label');
  assert(label.includes(text));
  await page.addScriptTag({path:require.resolve('axe-core/axe.min.js')});
  const axe=await page.evaluate(async()=>{const r=await axe.run({runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21a','wcag21aa','best-practice']}});return {violations:r.violations,incomplete:r.incomplete.map(v=>({id:v.id,nodes:v.nodes.map(n=>({target:n.target,html:n.html,failureSummary:n.failureSummary}))})),passes:r.passes.length};});
  assert.equal(axe.violations.length,0);
  await page.screenshot({path:path.join(out,'screenshots',`paper_detail_${lang}_${width}x${width===1440?900:844}_dark_full.png`),fullPage:true});
  scenes.push({url:page.url(),width,theme:'dark',visibleLanguageText:text,accessibleLanguageName:label,visibleTextIncludedInName:true,...axe});
  await page.close();
 }
 await browser.close();
 fs.writeFileSync(path.join(out,'logs/editorial_regression.json'),JSON.stringify({scenes,violations:scenes.reduce((n,s)=>n+s.violations.length,0)},null,2));
 console.log(JSON.stringify({additionalDarkDetailScenes:scenes.length,axeViolations:0,unicodeLanguageLabels:'visible text confirmed in accessible name'}));
})().catch(e=>{console.error(e);process.exit(1)});
