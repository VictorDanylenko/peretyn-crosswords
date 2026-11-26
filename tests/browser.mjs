import { chromium } from '../../match3-alchemist/node_modules/playwright/index.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const browser = await chromium.launch({channel:'msedge',headless:true});
const local = 'http://127.0.0.1:5188/';
const offline = pathToFileURL(path.resolve('peretyn.html')).href;
fs.mkdirSync('artifacts',{recursive:true});
const entries = [
  {id:1,word:'КАРТА',clue:'Зображення місцевості.'},
  {id:2,word:'АТЛАС',clue:'Збірник карт.'}
];
try {
  for (const [name,width,url] of [['desktop',1440,local],['tablet',768,local],['mobile',390,local],['offline',1024,offline]]) {
    const page = await browser.newPage({viewport:{width,height:900}});
    const errors = [];
    page.on('pageerror',error => errors.push(error.message));
    await page.goto(url);
    assert(await page.locator('#empty-preview').isVisible());
    assert.equal(await page.locator('#word-count').innerText(),'0');
    assert(await page.locator('#export-top').isDisabled());
    assert(await page.locator('#generate').isDisabled());
    const favicon = await page.locator('link[rel=icon]').getAttribute('href');
    assert.equal(favicon,await page.locator('.brand img').getAttribute('src'));
    assert(await page.locator('.brand img').evaluate(img => img.complete && img.naturalWidth > 0));
    if (url === local) {
      const mark = await page.request.get(new URL(favicon,local).href);
      assert(mark.ok() && mark.headers()['content-type'].startsWith('image/svg+xml'));
    }
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({path:'artifacts/'+name+'-creator.png',fullPage:true});
    await page.locator('#title').fill('Географія');
    for (const [i,row] of entries.entries()) {
      if (i) await page.locator('#add').click();
      await page.locator('.entry[open] input').fill(row.word);
      await page.locator('.entry[open] textarea').fill(row.clue);
    }
    await page.locator('#generate').click();
    await page.locator('.cell').first().waitFor();
    assert.equal(await page.locator('.cell').count(),9);
    assert.equal(await page.locator('#grid input').count(),0);
    assert.equal(await page.locator('#preview-clues li').count(),2);
    await page.reload();
    assert.equal(await page.locator('.cell').count(),9);
    assert.equal(await page.locator('#title').inputValue(),'Географія');
    await page.locator('#larger').click();
    await page.locator('#smaller').click();
    await page.locator('#export-top').click();
    await page.locator('#with-answers').check();
    const pdfNames = ['peretyn-crossword.pdf','peretyn-answers.pdf'];
    const downloads = Promise.all(pdfNames.map(filename => page.waitForEvent('download',{predicate:d=>d.suggestedFilename()===filename})));
    await page.locator('#download-pdf').click();
    for (const file of await downloads) {
      const out = 'artifacts/'+name+'-'+file.suggestedFilename();
      await file.saveAs(out);
      assert(fs.readFileSync(out).subarray(0,8).toString().startsWith('%PDF-1.4'));
    }
    const json = page.waitForEvent('download');
    await page.locator('#json').click();
    const jsonPath = 'artifacts/'+name+'-dictionary.json';
    await (await json).saveAs(jsonPath);
    assert.deepEqual(JSON.parse(fs.readFileSync(jsonPath)).entries,entries);
    await page.locator('#new').click();
    await page.locator('#cancel').click();
    assert.equal(await page.locator('.cell').count(),9);
    await page.locator('#new').click();
    await page.locator('#confirm').click();
    await page.reload();
    assert.equal(await page.locator('#word-count').innerText(),'0');
    await page.locator('#import-file').setInputFiles(jsonPath);
    await page.locator('.cell').first().waitFor();
    await page.locator('.entry[open] input').fill('ЗМІНА');
    assert(await page.locator('#export-top').isDisabled());
    assert(await page.locator('#empty-preview').isVisible());
    await page.reload();
    assert.equal(await page.locator('.entry input').first().inputValue(),'ЗМІНА');
    assert.deepEqual(errors,[]);
    console.log(name+' creation, shared logo/favicon, PDF, JSON and draft restore passed');
    await page.close();
  }
  const migrated = await browser.newPage();
  await migrated.addInitScript(old => localStorage.setItem('peretyn-v1',JSON.stringify(old)),
    {entries,title:'Власна робота',puzzle:{seed:42},values:{'0,0':'А'}});
  await migrated.goto(local);
  assert.equal(await migrated.locator('#title').inputValue(),'Власна робота');
  assert.equal(await migrated.locator('.cell').count(),9);
  console.log('Previous user dictionary and seed restored');
} finally { await browser.close(); }
