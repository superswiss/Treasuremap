// Optional: make Playwright available and start the local server first.
import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,readFile} from 'node:fs/promises';
const {chromium}=createRequire(import.meta.url)(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({headless:true,...(process.env.BROWSER_CHANNEL?{channel:process.env.BROWSER_CHANNEL}:{})});
const context=await browser.newContext({viewport:{width:390,height:844}});
await context.addInitScript(()=>{
  navigator.geolocation.watchPosition=callback=>{
    const sendFix=()=>callback({coords:{latitude:window.testLatitude??28.6865,longitude:-81.2443,accuracy:5},timestamp:Date.now()});
    queueMicrotask(sendFix);
    return window.setInterval(sendFix,1000);
  };
  navigator.geolocation.clearWatch=id=>window.clearInterval(id);
  const getUserMedia=navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices);
  navigator.mediaDevices.getUserMedia=async constraints=>{
    if(!constraints.video||constraints.audio)return getUserMedia(constraints);
    const canvas=document.createElement('canvas');
    canvas.width=320;canvas.height=240;
    const context=canvas.getContext('2d');
    const stream=canvas.captureStream(15);
    const track=stream.getVideoTracks()[0];
    const frames=setInterval(()=>{
      if(track.readyState==='ended'){clearInterval(frames);return;}
      context.fillRect(0,0,320,240);
    },50);
    return stream;
  };
});
const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
const click=name=>page.getByRole('button',{name,exact:true}).click();
const expectText=text=>page.getByText(text,{exact:true}).waitFor();
const close=()=>page.locator('#modal form[method="dialog"] button').click();
async function dismissArrival(name){
  const alert=page.locator('#arrival-alert');
  await alert.getByRole('heading',{name:`You have arrived at ${name}`,exact:true}).waitFor();
  await page.mouse.click(4,4);
  await alert.waitFor({state:'hidden'});
}
async function verifyNarration(file){
  await click('Read aloud');
  const recording=page.locator('#briefing-audio');
  await page.waitForFunction(()=>{const audio=document.querySelector('#briefing-audio');return !audio.paused&&audio.currentTime>0;});
  assert.ok((await recording.getAttribute('src')).endsWith(file));
  await click('Stop reading');
  assert.equal(await recording.evaluate(audio=>audio.paused),true);
}
const deployed=JSON.parse(await readFile('content/hunt-settings.json','utf8'));
const fragmentWords=deployed.howell.shutdownPhrase.split(/\s+/);
async function verifyFragmentNotice(word){
  const notice=page.locator('#notice');
  await notice.waitFor();
  assert.equal(await notice.textContent(),`Transmission fragment recovered — “${word}”. Open the Journal tab to see what you’ve collected so far.`);
}
const palette=()=>page.locator('meta[name="theme-color"]').getAttribute('content');
try{
  await page.goto('http://localhost:4173');
  const firstMission=page.getByRole('heading',{name:'An agent is born',exact:true});
  await firstMission.waitFor();
  assert.equal(await page.locator('.howell-game-mode').textContent(),'Field hunt');
  assert.equal(await page.locator('#app .mission-head').count(),0);
  await page.setViewportSize({width:320,height:720});
  assert.ok((await firstMission.boundingBox()).y<250);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await click('Overview');
  await page.locator('#modal').getByRole('heading',{name:'Operation STEVE: Agents of Howell Sneak',exact:true}).waitFor();
  await close();
  await click('Journal');
  await page.locator('#commander-briefing summary').click();
  await page.locator('#commander-briefing p').filter({hasText:'received a rogue transmission'}).waitFor();
  assert.doesNotMatch(await page.locator('#commander-briefing').textContent(),/shutdown passphrase/i);
  await expectText('Rogue transmission fragments');
  await click('Mission');
  await firstMission.waitFor();
  await page.setViewportSize({width:390,height:844});
  await click('← All adventures');await expectText('Choose your adventure');
  await page.goBack();await firstMission.waitFor();
  await click('← All adventures');await expectText('Choose your adventure');
  await mkdir('test-results',{recursive:true});await page.screenshot({path:'test-results/home-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await page.getByRole('button',{name:'Play in the field',exact:true}).last().click();await expectText('This trail needs its final bearings.');await close();
  await page.getByRole('button',{name:'Try the demo →',exact:true}).first().click();
  await click('New message from STEVE');
  assert.equal(await page.locator('#mission-message-title').evaluate(title=>document.activeElement===title),true);
  assert.equal(await page.locator('#mission-message-notification').isVisible(),false);
  const openingPalette=await palette();assert.equal(openingPalette,'#f3f7ee');
  await verifyNarration('01-mission-activation.wav');await click('Map');
  assert.deepEqual(await page.locator('#map .sensor-pin').allTextContents(),['1','2','3']);
  assert.equal(await page.locator('#map .checkpoint-pin.complete').count(),0);
  for(const label of ['Sensor Alpha','Sensor Bravo','Sensor Charlie','Pool Data Center · Sensor sweep','Pool control cell · Rogue processor']){
    await page.locator('#map').getByTitle(label,{exact:true}).click();
    const popup=page.locator('#map .leaflet-popup').filter({hasText:label});
    await popup.getByText(label,{exact:true}).waitFor();
    await popup.getByRole('button',{name:'Close popup'}).click();
    await popup.waitFor({state:'detached'});
  }
  const pinColor=selector=>page.locator(selector).first().evaluate(pin=>getComputedStyle(pin).backgroundColor);
  assert.equal(await pinColor('#map .sensor-pin'),'rgb(98, 106, 116)');
  assert.equal(await pinColor('#map .house-marker'),'rgb(180, 40, 62)');
  await click('Mission');await click('Simulate marker scan');await expectText('Nosy T Security Center');
  await click('Map');assert.equal(await pinColor('#map .house-marker'),'rgb(36, 101, 167)');await click('Mission');
  await page.evaluate(()=>{
    window.confirmationNotes=[];
    const createOscillator=AudioContext.prototype.createOscillator;
    AudioContext.prototype.createOscillator=function(){
      const tone=createOscillator.call(this);
      const start=tone.start;
      tone.start=function(...args){window.confirmationNotes.push(Math.round(tone.frequency.value));start.apply(tone,args);};
      return tone;
    };
  });
  await click('Simulate arrival');
  await page.waitForFunction(()=>window.confirmationNotes.length===3);
  assert.deepEqual(await page.evaluate(()=>window.confirmationNotes),[659,784,1047]);
  await click('Simulate arrival');
  assert.equal(await page.evaluate(()=>window.confirmationNotes.length),3);
  await click('Black');await expectText('Nosy T Security Center');await click('White');
  await expectText('Correct! Heat signature unlocked.');await click('Open Heat Scanner');
  assert.equal(await page.getByRole('button',{name:'Initiate cooling procedure',exact:true}).count(),0);
  await click('Simulate heat signature');await click('Initiate cooling procedure');
  await page.locator('#modal').getByText('Cooling complete. Well done, agents!',{exact:true}).waitFor();await close();
  await click('Continue to Lake Mystery →');
  await verifyFragmentNotice(fragmentWords[0]);
  await expectText('Lake Mystery');
  assert.equal(await palette(),'#cfe0d4');
  assert.equal(await page.locator('.tabs').evaluate(tabs=>{const rect=tabs.getBoundingClientRect();return rect.top>=-1&&rect.bottom<=innerHeight;}),true);
  await click('View fragments');
  assert.equal(await page.locator('#passphrase-fragments code').count(),1);
  assert.equal(await page.locator('#assembled-passphrase').count(),0);
  await click('Mission');
  await expectText('Checkpoint complete · Nosy T Security Center');
  await click('New message from STEVE');
  assert.equal(await page.getByRole('button',{name:'Perform scan',exact:true}).count(),0);
  await click('Simulate arrival');await click('Perform scan');
  assert.equal(await page.getByRole('button',{name:'Continue the mission →',exact:true}).count(),0);
  await page.waitForFunction(()=>document.querySelector('.scan-waveform path').getAttribute('d')!=='M0 36 H320');
  await page.locator('#arrived-challenge audio').evaluate(audio=>audio.playbackRate=8);
  await page.locator('.briefing').filter({hasText:'named Phoenix'}).waitFor({timeout:35000});
  assert.equal(await page.locator('.scan-waveform path').getAttribute('d'),'M0 36 H320');
  await click('New message from STEVE');
  assert.equal(await page.locator('#mission-message-title').textContent(),'Lake Mystery scan result');
  await verifyNarration('02b-lake-scan-complete.wav');
  await click('Perform scan again');await click('Stop scan');
  assert.equal(await page.locator('.scan-waveform path').getAttribute('d'),'M0 36 H320');
  await expectText('Replay stopped. You can replay it or continue the mission.');
  await click('Perform scan again');await click('Continue the mission →');
  await expectText('Checkpoint complete · Lake Mystery');
  await click('Continue the mission →');await click('Open sensor map');
  assert.deepEqual(await page.locator('#sensor-map .sensor-pin').allTextContents(),['1','2','3']);
  await click('Hide sensor map');await click('Simulate arrival');await click('Begin sensor sweep');
  for(let i=0;i<3;i++)await page.getByRole('button',{name:'Activate sensor',exact:true}).first().click();
  await verifyFragmentNotice(fragmentWords[1]);
  await click('Simulate arrival');await click('Blue');assert.equal(await palette(),'#020403');
  await verifyFragmentNotice(fragmentWords[2]);
  await click('View fragments');await expectText('Rogue transmission fragments');
  assert.deepEqual(await page.locator('#passphrase-fragments code').allTextContents(),fragmentWords);
  assert.equal(await page.locator('#assembled-passphrase').count(),0);
  await click('Mission');
  assert.match(await page.locator('.briefing').textContent(),/BWA HA HA HA!$/);
  await click('Continue the mission →');await expectText('The independent signal');await verifyNarration('06a-independent-signal.wav');
  await click('Open Journal');assert.equal(await page.locator('#assembled-passphrase').textContent(),deployed.howell.shutdownPhrase);
  await click('Return to shutdown mission');
  await click('Open CipherWave');await click('Decode Agency signal');await expectText(deployed.howell.shutdownPhrase);
  await page.evaluate(async()=>{
    const {encodeSignal}=await import('/lib/cipher.js');
    const mic=navigator.mediaDevices;
    const getUserMedia=mic.getUserMedia.bind(mic);
    mic.getUserMedia=async constraints=>{
      if(!constraints.audio)return getUserMedia(constraints);
      const audio=new AudioContext();
      await audio.resume();
      const destination=audio.createMediaStreamDestination();
      const silence=audio.createConstantSource();
      silence.offset.value=0;
      silence.connect(destination);silence.start();
      window.playTestSignal=()=>{
        const {samples,sampleRate}=encodeSignal('TEST');
        const source=audio.createBufferSource();
        source.buffer=audio.createBuffer(1,samples.length,sampleRate);
        source.buffer.copyToChannel(samples,0);
        source.connect(destination);
        source.onended=()=>{window.testSignalComplete=true;};
        source.start();
      };
      return destination.stream;
    };
  });
  await click('Record microphone');
  const monitor=page.locator('#record-monitor');
  await monitor.waitFor();
  assert.equal(await page.locator('.record-stop-icon').isVisible(),true);
  assert.equal(await page.locator('.record-microphone-icon').isVisible(),false);
  assert.equal(await monitor.locator('path').getAttribute('d'),'M0 36 H320');
  await page.evaluate(()=>window.playTestSignal());
  await page.waitForFunction(()=>document.querySelector('#record-monitor path').getAttribute('d')!=='M0 36 H320');
  await page.waitForFunction(()=>window.testSignalComplete);
  await page.waitForFunction(()=>document.querySelector('#record-monitor path').getAttribute('d')==='M0 36 H320');
  await click('Stop & decode');
  await page.waitForFunction(()=>document.querySelector('#decoded').textContent==='TEST');
  assert.equal(await monitor.isVisible(),false);
  assert.equal(await page.locator('.record-microphone-icon').isVisible(),true);
  const [download]=await Promise.all([page.waitForEvent('download'),click('Download Agency signal (.wav)')]);await download.saveAs('test-results/agency-signal.wav');
  await page.locator('#audio-file').setInputFiles('test-results/agency-signal.wav');await expectText(deployed.howell.shutdownPhrase);await click('Mission');
  await page.locator('#phrase').fill(deployed.howell.shutdownPhrase.toLowerCase());await click('Break the override →');assert.equal(await palette(),openingPalette);
  await click('Simulate arrival');await click('Simulate marker scan');await expectText('Agency restored. Treasure recovered.');
  await click('Open your journal →');await page.locator('#note').fill('Team Ω found the signal 🗺️');await click('Save note');await page.getByText('Team Ω found the signal 🗺️').waitFor();
  await page.locator('#photo').setInputFiles('test-results/home-mobile.png');await page.locator('.note-photo').waitFor();await click('Delete photo');await page.locator('.note-photo').waitFor({state:'detached'});
  await page.reload();await expectText('Agency restored. Treasure recovered.');
  assert.equal(new URL(page.url()).hash,'#/play/howell/demo');
  await click('Field kit');await click('Export / restore progress');
  const code=await page.locator('#export-code').inputValue();assert.equal(code.length,10);
  const [backup]=await Promise.all([page.waitForEvent('download'),click('Download full backup')]);await backup.saveAs('test-results/progress-backup.json');
  await page.locator('#restore-code').fill(code.toLowerCase());await click('Review restore');await click('Replace save & restore');await expectText('Agency restored. Treasure recovered.');
  await click('Journal');await page.getByText('Team Ω found the signal 🗺️').waitFor();
  await click('Field kit');await click('Export / restore progress');await click('Reset game');await click('Cancel');
  assert.equal(await page.locator('#export-code').inputValue(),code);
  await click('Reset game');await click('Reset this save');await expectText('An agent is born');
  await click('Field kit');await click('Export / restore progress');
  await page.locator('#backup-file').setInputFiles('test-results/progress-backup.json');
  await click('Replace save & restore');await expectText('Agency restored. Treasure recovered.');
  await click('Journal');await page.getByText('Team Ω found the signal 🗺️').waitFor();
  await click('← All adventures');await page.getByRole('button',{name:'Try the demo →',exact:true}).click();await verifyNarration('01-opening.wav');
  for(let i=0;i<5;i++){await click('Simulate arrival');await click('Skull and crossbones');}
  await click('Simulate arrival');await click('Simulate marker scan');await expectText('A treasure worthy of a captain.');
  await click('← All adventures');
  // Exercise the field workflow with a controlled target detection from the camera module.
  await page.route('**/lib/heat-ar/hologram.js',route=>route.fulfill({contentType:'text/javascript',body:`
    export function startHeatTracking(video, view, signal, {chipState,onTracking}) {
      if(chipState()==='hot')onTracking('Mega AI Chip 01 detected · 200°F',true);
    }
  `}));
  const settings=JSON.parse(await readFile('content/hunt-settings.json','utf8'));for(const config of [settings.howell,settings.pirate])for(const id of Object.keys(config.locations))config.locations[id]={lat:28.6865,lng:-81.2443};settings.howell.fenceAnswer='White';settings.howell.fizzAnswer='Blue';settings.pirate.clues=settings.pirate.clues.map(c=>({...c,question:'Choose the approved answer',options:['Yes','No'],answer:'Yes'}));
  await page.evaluate(s=>localStorage.setItem('hidden-trails:settings',JSON.stringify(s)),settings);await page.reload();await page.getByRole('button',{name:'Play in the field',exact:true}).first().click();await page.locator('#unlock').fill('wrong');await click('Unlock checkpoint →');await expectText('An agent is born');await page.locator('#unlock').fill('HS-A1-4J7K');await click('Unlock checkpoint →');
  assert.equal(await page.getByRole('button',{name:'White',exact:true}).count(),0);
  await page.evaluate(()=>{window.testLatitude=28.68685;});
  await click('Enable location');await expectText('You’re near Nosy T Security Center. Keep heading toward the map pin.');
  assert.equal(await page.locator('#arrival-alert').isVisible(),false);
  await page.evaluate(()=>{window.testLatitude=28.6865;});
  await dismissArrival('Nosy T Security Center');await click('White');
  await expectText('Correct! Heat signature unlocked.');await click('Open Heat Scanner');await click('Initiate cooling procedure');
  await click('Continue to Lake Mystery →');
  await dismissArrival('Lake Mystery');
  await click('Perform scan');await page.locator('#arrived-challenge audio').evaluate(audio=>audio.playbackRate=8);
  await page.locator('.briefing').filter({hasText:'named Phoenix'}).waitFor({timeout:35000});await click('Continue the mission →');await click('Continue the mission →');
  await dismissArrival('Pool Data Center');await click('Begin sensor sweep');await page.getByRole('button',{name:'Activate sensor',exact:true}).first().click();
  await page.evaluate(()=>{const key='hidden-trails:v1:howell:field';const s=JSON.parse(localStorage.getItem(key));s.timer.deadline=Date.now()-1000;localStorage.setItem(key,JSON.stringify(s));});await page.reload();await expectText('The sensor sweep');await click('Enable location');await dismissArrival('Pool Data Center');await page.getByRole('button',{name:'Begin sensor sweep',exact:true}).waitFor();
  await click('Organizer access');await page.locator('#pin').fill('1980');await click('Open organizer tools');await click('Setup & readiness');await page.locator('#settings-json').waitFor();await close();
  await page.goto('http://localhost:4173/#/unlock/HS-FINAL-EZ-8P4R');await expectText('The sensor sweep');
  await page.screenshot({path:'test-results/mission-mobile.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  await click('Map');await page.getByRole('heading',{name:'Your field map',exact:true}).waitFor();await page.locator('.location-list').waitFor();
  await click('← All adventures');await page.setViewportSize({width:1366,height:900});await page.screenshot({path:'test-results/home-desktop.png',fullPage:true});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  assert.deepEqual(errors,[]);console.log('Browser checks passed: both demos, guided cooling, scan replay, WAV decode, Unicode notes, photos, restore, field GPS gate, expired timer, organizer, deep links, map, and responsive layouts.');
}finally{await browser.close();}

