import lighthouse from 'lighthouse';
import desktop from 'lighthouse/core/config/desktop-config.js';
import {launch} from 'chrome-launcher';
import fs from 'node:fs';
import path from 'node:path';
const out=path.join(path.resolve(process.env.REVIEW_PACKET_DIR || 'tmp/review'),'logs');
fs.mkdirSync(out,{recursive:true});
const BASE=process.env.TEST_BASE_URL || 'http://127.0.0.1:8091';
const chrome=await launch({...(process.env.CHROME_PATH ? {chromePath:process.env.CHROME_PATH} : {}),chromeFlags:['--headless=new','--disable-gpu','--no-first-run']});
const summary=[];
try {
 for(const mode of ['desktop','mobile'])for(const page of ['index','publications']){
  const url=`${BASE}/${page}.html`;
  const result=await lighthouse(url,{port:chrome.port,logLevel:'error',output:'json',onlyCategories:['performance','accessibility','best-practices','seo']},mode==='desktop'?desktop:undefined);
  fs.writeFileSync(path.join(out,`lighthouse_${page}_${mode}.json`),result.report);
  const lhr=result.lhr;
  const row={url,mode,fetchTime:lhr.fetchTime,lighthouseVersion:lhr.lighthouseVersion,categories:Object.fromEntries(Object.entries(lhr.categories).map(([k,v])=>[k,v.score])),metrics:Object.fromEntries(['first-contentful-paint','largest-contentful-paint','speed-index','total-blocking-time','cumulative-layout-shift'].map(k=>[k,lhr.audits[k].numericValue])),warnings:lhr.runWarnings,failedAudits:Object.entries(lhr.audits).filter(([k,v])=>v.score!==null&&v.score<1&&v.scoreDisplayMode==='binary').map(([k,v])=>({id:k,title:v.title,description:v.description}))};
  summary.push(row);console.log(JSON.stringify(row));
 }
 fs.writeFileSync(path.join(out,'lighthouse_summary.json'),JSON.stringify(summary,null,2));
}finally{await chrome.kill();}
