// Optional regression suite for an explicitly browser-capable development runtime.
// Not used as a workaround for an unavailable supported cloud browser.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true });
const page = await browser.newPage({ viewport:{ width:1440,height:1000 },acceptDownloads:true });
const errors=[];page.on('pageerror',e=>errors.push(e.message));
try {
  await page.goto(process.env.TEST_URL || 'http://localhost:5173');
  await page.getByRole('heading',{name:'Your retirement plan',exact:true}).waitFor();
  await page.locator('#plan-years').fill('');
  await page.getByRole('alert').filter({hasText:'Complete years'}).waitFor();
  await page.locator('#plan-years').fill('45');
  await page.locator('#plan-spending').fill('');
  await page.locator('#plan-mode').selectOption('percent');
  assert.equal(await page.getByRole('alert').count(),0);
  await page.locator('#plan-mode').selectOption('spending');
  await page.locator('#plan-spending').fill('40000');
  await page.getByRole('button',{name:'Savings growth',exact:true}).click();
  await page.getByRole('button',{name:'Reset horizon',exact:true}).click();
  await page.getByRole('button',{name:'Retirement cashflow',exact:true}).click();
  assert.equal(await page.locator('#plan-years').inputValue(),'45');
  const configure=page.getByRole('button',{name:'Configure accounts (1)',exact:true});
  await configure.click();await page.getByRole('dialog').waitFor();
  await page.getByLabel('Current balance ($)',{exact:true}).fill('12345');
  await page.getByRole('button',{name:'Cancel',exact:true}).click();
  await configure.click();assert.equal(await page.getByLabel('Current balance ($)',{exact:true}).inputValue(),'50000');
  await page.keyboard.press('Escape');assert.equal(await page.getByRole('dialog').count(),0);
  assert.equal(await configure.evaluate(e=>e===document.activeElement),true);
  // Download is explicitly user-triggered; roundtrip previews before replacement.
  const downloadPromise=page.waitForEvent('download');await page.getByRole('button',{name:'Export scenario JSON',exact:true}).click();
  const download=await downloadPromise,file=await download.path();assert.ok(file);
  await page.locator('#plan-salary').fill('123456');
  await page.locator('#scenario-import').setInputFiles(file);
  await page.getByRole('button',{name:'Replace with imported scenario',exact:true}).waitFor();
  assert.equal(await page.locator('#plan-salary').inputValue(),'123456');
  await page.getByRole('button',{name:'Cancel import',exact:true}).click();
  await page.locator('#scenario-import').setInputFiles(file);
  await page.getByRole('button',{name:'Replace with imported scenario',exact:true}).click();
  assert.equal(await page.locator('#plan-salary').inputValue(),'80000');
  await page.locator('#scenario-import').setInputFiles({name:'bad.json',mimeType:'application/json',buffer:Buffer.from('{')});
  await page.getByRole('status').filter({hasText:'valid JSON'}).waitFor();
  assert.equal(await page.locator('#plan-salary').inputValue(),'80000');
  for(const width of [320,390,768,1440]) {
    await page.setViewportSize({width,height:1000});
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  }
  await page.setViewportSize({width:1440,height:1000});
  await page.evaluate(()=>document.documentElement.style.fontSize='200%');
  assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
  await page.evaluate(()=>document.documentElement.style.fontSize='');
  assert.equal(await page.evaluate(()=>localStorage.length),0);
  await page.reload();assert.equal(await page.locator('#plan-years').inputValue(),'50');
  assert.deepEqual(errors,[]);console.log('Browser regression suite passed.');
} finally {await browser.close();}
