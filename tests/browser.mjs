// Optional: make Playwright available and start the local server first.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:390,height:844},permissions:['geolocation'],geolocation:{latitude:28.6865,longitude:-81.2443,accuracy:5}});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=name=>page.getByRole('button',{name,exact:true}).click();
const expectText=text=>page.getByText(text,{exact:true}).waitFor();
const close=()=>page.locator('#modal form[method="dialog"] button').click();
const deployed=JSON.parse(await readFile('content/hunt-settings.json','utf8'));
try{
  await page.goto('http://localhost:4173');await expectText('Choose your adventure');
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'Play in the field',exact:true}).last().click();await expectText('This trail needs its final bearings.');await close();
  await page.getByRole('button',{name:'Try the demo →',exact:true}).first().click();await click('Simulate marker scan');await expectText('Nosy T Security Center');
  await click('Simulate arrival');await click('Black');await expectText('Nosy T Security Center');await click('White');
  await click('Continue the mission →');await click('Simulate arrival');await click('Begin sensor sweep');
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Capture',exact:true}).first().click();
  await click('Simulate arrival');await click('Blue');await click('Continue the mission →');await expectText('The independent signal');
  await click('Open CipherWave');const [download]=await Promise.all([page.waitForEvent('download'),click('Download Agency signal (.wav)')]);await download.saveAs('test-results/agency-signal.wav');
  await page.locator('#audio-file').setInputFiles('test-results/agency-signal.wav');await expectText(deployed.howell.shutdownPhrase);await click('Mission');
  await page.locator('#phrase').fill(deployed.howell.shutdownPhrase.toLowerCase());await click('Break the override →');await click('Simulate arrival');await click('Simulate marker scan');await expectText('Agency restored. Treasure recovered.');
  await click('Open your journal →');await page.locator('#note').fill('Team Ω found the signal 🗺️');await click('Save note');await page.getByText('Team Ω found the signal 🗺️').waitFor();
  await page.locator('#photo').setInputFiles('test-results/home-mobile.png');await page.locator('.note-photo').waitFor();await click('Delete photo');await page.locator('.note-photo').waitFor({state:'detached'});
  await page.reload();await page.getByRole('button',{name:'Resume demo →',exact:true}).first().click();await expectText('Agency restored. Treasure recovered.');
  await click('Field kit');await click('Export / restore progress');const code=await page.locator('#export-code').inputValue();assert.ok(code.startsWith('HT1.'));await page.locator('#restore-code').fill(code);await click('Review restore');await click('Replace save & restore');await expectText('Agency restored. Treasure recovered.');
  await click('← All adventures');await page.getByRole('button',{name:'Try the demo →',exact:true}).click();
  for(let i=0;i<5;i++){await click('Simulate arrival');await click('Skull and crossbones');}
  await click('Simulate arrival');await click('Simulate marker scan');await expectText('A treasure worthy of a captain.');
  await click('← All adventures');
  const settings=JSON.parse(await readFile('content/hunt-settings.json','utf8'));for(const config of [settings.howell,settings.pirate])for(const id of Object.keys(config.locations))config.locations[id]={lat:28.6865,lng:-81.2443};settings.howell.fenceAnswer='White';settings.howell.fizzAnswer='Blue';settings.pirate.clues=settings.pirate.clues.map(c=>({...c,question:'Choose the approved answer',options:['Yes','No'],answer:'Yes'}));
  await page.evaluate(s=>localStorage.setItem('hidden-trails:settings',JSON.stringify(s)),settings);await page.reload();await page.getByRole('button',{name:'Play in the field',exact:true}).first().click();await page.locator('#unlock').fill('wrong');await click('Unlock checkpoint →');await expectText('An agent is born');await page.locator('#unlock').fill('HS-A1-4J7K');await click('Unlock checkpoint →');
  assert.equal(await page.getByRole('button',{name:'White',exact:true}).count(),0);await click('Enable location');await click('White');await click('Continue the mission →');await click('Begin sensor sweep');await page.getByRole('button',{name:'Capture',exact:true}).first().click();
  await page.evaluate(()=>{const key='hidden-trails:v1:howell:field';const s=JSON.parse(localStorage.getItem(key));s.timer.deadline=Date.now()-1000;localStorage.setItem(key,JSON.stringify(s));});await page.reload();await page.getByRole('button',{name:'Resume field hunt',exact:true}).first().click();await click('Enable location');await page.getByRole('button',{name:'Begin sensor sweep',exact:true}).waitFor();
  await click('Organizer access');await page.locator('#pin').fill('1980');await click('Open organizer tools');await click('Setup & readiness');await page.locator('#settings-json').waitFor();await close();
  await page.goto('http://localhost:4173/#/unlock/HS-FINAL-EZ-8P4R');await expectText('The sensor sweep');
  await page.screenshot({path:'test-results/mission-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await click('Map');await page.getByRole('heading',{name:'Your field map',exact:true}).waitFor();await page.locator('.location-list').waitFor();
  await click('← All adventures');await page.setViewportSize({width:1366,height:900});await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('Browser checks passed: both demos, WAV decode, Unicode notes, photos, restore, field GPS gate, expired timer, organizer, deep links, map, mobile and desktop layouts.');
}finally{await browser.close();}

