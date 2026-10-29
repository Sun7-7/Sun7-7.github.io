// Playwright owns the Edge CDP session; avoids chrome-launcher port discovery
// issues on Windows. QA tooling; never a runtime site dependency.
import {chromium} from 'playwright';
import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import fs from 'node:fs';
import path from 'node:path';
const root=path.resolve(process.env.REVIEW_PACKET_DIR||'tmp/v36');
const base=process.env.TEST_BASE_URL||'http://127.0.0.1:8096';
const port=Number(process.env.LIGHTHOUSE_CDP_PORT||9226);
if(!Number.isInteger(port)||port<1024||port>65535)throw new Error('Invalid local debugging port');
fs.mkdirSync(root+'/logs',{recursive:true});
const context=await chromium.launchPersistentContext(fs.mkdtempSync(root+'/lh-profile-'),{
  channel:'msedge',headless:true,args:[`--remote-debugging-port=${port}`]
});
const summary=[];
try {
  const version=await (await fetch(`http://127.0.0.1:${port}/json/version`)).json();
  fs.writeFileSync(root+'/logs/lighthouse_engine.json',JSON.stringify(version,null,2));
  for(const mode of ['desktop','mobile']) {
    const result=await lighthouse(base+'/research.html',{
      port,logLevel:'error',output:'json',onlyCategories:['performance','accessibility','best-practices','seo']
    },mode==='desktop'?desktop:undefined);
    fs.writeFileSync(root+`/logs/lighthouse_research_${mode}.json`,result.report);
    const lhr=result.lhr;
    const row={url:lhr.finalDisplayedUrl,mode,fetchTime:lhr.fetchTime,lighthouseVersion:lhr.lighthouseVersion,
      categories:Object.fromEntries(Object.entries(lhr.categories).map(([key,value])=>[key,value.score])),
      metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift'].map(key=>[key,lhr.audits[key].numericValue])),
      warnings:lhr.runWarnings};
    summary.push(row);console.log(JSON.stringify(row));
  }
  fs.writeFileSync(root+'/logs/lighthouse_summary.json',JSON.stringify(summary,null,2));
} finally {await context.close();}
