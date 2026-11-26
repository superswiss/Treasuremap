import {createRequire} from 'node:module';
import {readFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL||'msedge'});
const page=await browser.newPage({viewport:{width:1366,height:950}});const errors=[];page.on('pageerror',e=>errors.push(e.stack));
try{
  await page.goto('http://localhost:4173/setup.html');await page.locator('.leaflet-container').waitFor();
  await page.locator('#planner-map').click({position:{x:240,y:200}});
  const lat=Number(await page.locator('#latitude').inputValue()),lng=Number(await page.locator('#longitude').inputValue());assert.ok(lat>28&&lng< -81);
  await page.locator('[data-path="howell.fenceAnswer"]').selectOption('White');
  await page.getByRole('button',{name:/Sensor Alpha/}).click();await page.locator('#latitude').fill('28.7');await page.locator('#longitude').fill('-81.25');await page.getByRole('button',{name:'Apply coordinates',exact:true}).click();
  await page.reload();await page.locator('[data-point="alpha"]').click();assert.equal(await page.locator('#latitude').inputValue(),'28.7');
  await page.locator('#adventure').selectOption('pirate');await page.locator('#question-0').fill('What color is the flag?');await page.locator('#options-0').fill('Red\nBlue');await page.locator('[data-path="pirate.clues.0.answer"]').selectOption('Blue');
  const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Download configuration',exact:true}).click()]);await mkdir('test-results',{recursive:true});await download.saveAs('test-results/setup-export.json');
  const config=JSON.parse(await readFile('test-results/setup-export.json','utf8'));assert.equal(config.howell.locations.security.lat,lat);assert.equal(config.howell.locations.security.lng,lng);assert.equal(config.howell.fenceAnswer,'White');assert.equal(config.pirate.clues[0].answer,'Blue');
  page.once('dialog',dialog=>dialog.accept());await page.locator('#import-config').setInputFiles('test-results/setup-export.json');await page.getByText('Imported configuration. Review your points and answers before using it.',{exact:true}).waitFor();
  await page.getByRole('button',{name:'Use in this browser',exact:true}).click();assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('hidden-trails:settings')).howell.locations.alpha.lat),28.7);
  await page.locator('#adventure').selectOption('howell');await page.screenshot({path:'test-results/setup-desktop.png',fullPage:true});await page.setViewportSize({width:390,height:844});await page.screenshot({path:'test-results/setup-mobile.png',fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
  console.log('Setup checks passed: map click, manual coordinates, draft reload, answers, exact export, reimport, local apply, responsive layout.');
}finally{await browser.close();}

