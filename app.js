import {createHunts} from './adventures/hunts.js';
import {normalize,coordinates,distance,freshState,validateState,encodeProgress,decodeProgress,withinRange,settingsProblems} from './lib/core.js';
import {encodeSignal,decodeSignal,wavBytes} from './lib/cipher.js';
import {photosFor,addPhoto,deletePhoto} from './lib/photos.js';

const app=document.querySelector('#app'), modal=document.querySelector('#modal'), modalBody=document.querySelector('#modal-body');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=selector=>document.querySelector(selector);
const on=(selector,event,callback)=>{const element=$(selector);if(element)element.addEventListener(event,callback);};
let settings,source,hunts,hunt,state,tab='mission',position=null,watch=null,map=null,mapMarkers=[],timerTick=null,resources=[],organizerOpen=false,untimed=false;
let demoArrived=false,scannerStream=null,recorder=null,recordStream=null,recordStopTimer=null,signalAudio=null,signalUrl=null,uiGeneration=0;
let stopHeatScanner=null;
const storageKey=(id,mode)=>`hidden-trails:v1:${id}:${mode}`;
const stateKey=()=>storageKey(hunt.id,state.mode);
function notify(message){$('#notice').textContent=message;$('#notice').classList.add('visible');clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>$('#notice').classList.remove('visible'),6500);}
function showModal(html){stopMedia();modalBody.innerHTML=html;if(!modal.open)modal.showModal();}
function stopMedia(){stopHeatScanner?.();if(recorder?.state==='recording')recorder.stop();recorder=null;clearTimeout(recordStopTimer);recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;scannerStream?.getTracks().forEach(t=>t.stop());scannerStream=null;signalAudio?.pause();signalAudio=null;if(signalUrl){URL.revokeObjectURL(signalUrl);signalUrl=null;}}
modal.addEventListener('close',stopMedia);
function save(){try{localStorage.setItem(stateKey(),JSON.stringify(state));return true;}catch{notify('Progress could not be saved. Export a progress code before leaving this page.');return false;}}
function load(h,mode){try{const saved=localStorage.getItem(storageKey(h.id,mode));return saved?validateState(JSON.parse(saved),hunts):freshState(h.id,mode);}catch{notify('The previous save could not be read. You can restore an exported progress code.');return freshState(h.id,mode);}}
function cleanup(){uiGeneration++;clearInterval(timerTick);timerTick=null;if(map){map.remove();map=null;}mapMarkers=[];resources.forEach(URL.revokeObjectURL);resources=[];stopMedia();window.speechSynthesis?.cancel();document.querySelectorAll('audio').forEach(a=>a.pause());}
function stopLocation(){if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;position=null;}
function stage(){return hunt?.stages[state.completed.length];}
function answerFor(s){return state.mode==='demo'?(s.demoAnswer||s.answer):s.answer;}
function complete(){
  const s=stage();
  if(!s)return;
  state.completed.push(s.id);
  state.timer=null;
  demoArrived=false;
  save();
  const messages=[s.completionMessage,s.artifact&&`Recovered: ${s.artifact}`].filter(Boolean);
  notify(messages.join(' ')||'Checkpoint complete.');
  renderGame();
}
function backHome(){cleanup();stopLocation();hunt=null;state=null;organizerOpen=false;untimed=false;renderHome();}
function safeRun(fn){return async(...args)=>{try{await fn(...args);}catch(error){notify(error.message||'Something went wrong. Please try again.');}};}
function download(name,data,type='application/json'){const url=URL.createObjectURL(new Blob([data],{type}));const a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);}

async function boot(){
  try{
    const responses=await Promise.all(['content/steve-transmissions.json','content/hunt-settings.json'].map(url=>fetch(url).then(r=>{if(!r.ok)throw Error(`Could not load ${url} (${r.status}).`);return r.json();})));
    [source,settings]=responses;
    try{const local=localStorage.getItem('hidden-trails:settings');if(local)settings=JSON.parse(local);}catch{notify('Local settings could not be loaded. Using the supplied settings.');}
    hunts=createHunts(source,settings);
    window.addEventListener('hashchange',handleRoute);
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMedia();window.speechSynthesis?.cancel();document.querySelectorAll('audio').forEach(a=>a.pause());}});
    on('#help','click',showHelp);on('#organizer','click',openOrganizer);on('.brand','click',e=>{e.preventDefault();history.replaceState(null,'',location.pathname+location.search+'#/');backHome();});handleRoute();
  }catch(error){app.innerHTML=`<section class="panel"><h1>Let’s get connected.</h1><p>${esc(error.message)}</p><p>Open this app through its local server or GitHub Pages, rather than opening index.html directly.</p><pre>npm start</pre><p>Then visit <a href="http://localhost:4173">http://localhost:4173</a> on this computer.</p></section>`;}
}
function renderHome(){
  cleanup();delete document.documentElement.dataset.adventure;delete document.documentElement.dataset.signal;document.querySelector('meta[name="theme-color"]').content='#102b29';document.title='Hidden Trails · Field adventures';
  app.innerHTML=`${location.protocol==='file:'?'<div class="banner">Serve this folder over HTTP locally or HTTPS on GitHub Pages to play.</div>':''}
  <section class="hero"><div><span class="eyebrow">YOUR NEXT ADVENTURE IS OUT THERE</span><h1>Ordinary places.<br>Extraordinary<br>secrets.</h1><p>Follow the clues. Decode the unexpected. Turn a walk into a story worth telling.</p><span class="badge">REAL PLACES. REAL DISCOVERIES.</span></div><div class="hero-art" aria-hidden="true"><div class="compass">✧</div><span class="art-tag">TAKE THE PATH LESS ORDINARY ↗</span></div></section>
  <section><div class="section-head"><h2>Choose your adventure</h2><small>Two stories. A world to explore.</small></div><div class="grid">${hunts.map(h=>{
    const saved=load(h,'demo'), field=load(h,'field'), problems=settingsProblems(settings,h.id);
    return `<article class="adventure"><div class="scene ${h.theme}"><span class="eyebrow">${esc(h.subtitle)}</span><span class="scene-symbol" aria-hidden="true">${h.theme==='spy'?'⌖':'⚑'}</span><span class="badge ${h.theme==='spy'?'dark':'amber'}">${h.stages.length} CHECKPOINTS</span></div><div class="card-body"><small class="eyebrow">${esc(h.location)}</small><h3 style="margin-top:12px">${esc(h.title)}</h3><p>${esc(h.description)}</p><div class="meta"><span>◉ Story & discovery</span><span>↗ Play at your pace</span></div><div class="card-bottom"><button data-demo="${h.id}">${saved.completed.length?'Resume demo':'Try the demo'} →</button><button class="quiet" data-field="${h.id}">${field.completed.length?'Resume field hunt':'Play in the field'}</button></div><p class="fine" style="min-height:0;margin-bottom:0">${problems.length?'Field setup needed · demo is ready to explore.':'Field setup complete · organizer route check still required.'}</p></div></article>`;
  }).join('')}</div></section><div class="strip"><div><strong>A little preparation. A lot of discovery.</strong><p>Try a demo from your couch, or bring a configured adventure into the real world. No account needed.</p></div><button id="restore-home" class="quiet">Restore progress</button></div>`;
  document.querySelectorAll('[data-demo]').forEach(b=>b.onclick=()=>startHunt(b.dataset.demo,'demo'));
  document.querySelectorAll('[data-field]').forEach(b=>b.onclick=()=>startHunt(b.dataset.field,'field'));
  on('#restore-home','click',showTransfer);
}
function startHunt(id,mode){
  const h=hunts.find(h=>h.id===id);if(!h)return;
  const problems=settingsProblems(settings,id);
  if(mode==='field'&&problems.length){showModal(`<h2>This trail needs its final bearings.</h2><p>The demo is playable now. Before field play, supply these details in Organizer access → Setup.</p><ul class="checklist">${problems.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`);return;}
  cleanup();stopLocation();untimed=false;organizerOpen=false;hunt=h;state=load(h,mode);tab='mission';demoArrived=false;save();renderGame();
}
function handleRoute(){
  if(location.hash.startsWith('#/unlock/')){
    let token;try{token=decodeURIComponent(location.hash.slice(9));}catch{notify('This unlock link is malformed.');return;}
    const owner=hunts.find(h=>h.stages.some(s=>s.token===token));
    if(!owner){notify('This unlock marker is not part of either adventure.');if(!hunt)renderHome();return;}
    if(!hunt||hunt.id!==owner.id){if(!hunt)renderHome();startHunt(owner.id,'field');}
    if(hunt?.id===owner.id){if(state.mode==='demo'){notify('This link is open in your demo. Field progress is saved separately.');}tryUnlock(token);}
    history.replaceState(null,'',location.pathname+location.search+'#/');
  }else if(!hunt)renderHome();else if(location.hash==='#/'||!location.hash)backHome();
}
function renderGame(){
  cleanup();if(!hunt)return;const s=stage();document.title=hunt.title+' · Hidden Trails';
  document.documentElement.dataset.adventure=hunt.id;
  document.documentElement.dataset.signal=s?.interfaceMode||'agency';
  document.querySelector('meta[name="theme-color"]').content=hunt.id==='howell'?'#050b09':'#102b29';
  let missionMark='';
  if(hunt.id==='howell'){
    missionMark=s?.interfaceMode==='override'
      ? '<div class="steve-sigil" aria-hidden="true"><svg viewBox="0 0 160 130" fill="none"><path d="M20 38V16h24M116 16h24v22M140 92v22h-24M44 114H20V92"/><path d="M16 65 48 37h64l32 28-32 28H48Z"/><circle cx="80" cy="65" r="23"/><circle cx="80" cy="65" r="9" class="sigil-core"/><path d="M80 6v23M80 101v23M2 65h34M124 65h34"/></svg><span>S T E V E / AI–01</span></div>'
      : '<img class="agency-logo" src="assets/agents-of-howell-sneak.png" alt="Agents of Howell Sneak" width="1536" height="1024">';
  }
  app.innerHTML=`<button id="back" class="text-button">← All adventures</button>${state.mode==='demo'?'<div class="banner"><strong>DEMO EXERCISE</strong> · Locations and checkpoint scans are simulated. Nothing here confirms your physical location. Demo progress is separate from field progress.</div>':''}
    <section class="mission-head ${hunt.theme==='pirate'?'pirate':s?.interfaceMode||''}"><div class="row spread"><span class="eyebrow">${esc(hunt.subtitle)}</span><span class="badge dark">${state.mode==='demo'?'DEMO':'FIELD HUNT'}</span></div><div class="mission-title-grid"><div>${hunt.id==='howell'?'<p class="terminal-kicker">AGENCY OF HOWELL SNEAK / FIELD OPERATIONS</p>':''}<h1>${esc(hunt.title)}</h1>${hunt.id==='howell'?`<p class="terminal-subtitle">${s?.interfaceMode==='override'?'CONTROL TRANSFERRED // STEVE OVERRIDE':s?.interfaceMode==='unstable'?'SIGNAL ANOMALY // PROCEED WITH CAUTION':'YOUR EYES. MY INTELLIGENCE. OUR MISSION.'}</p>`:''}</div>${missionMark}</div><div class="row spread"><span>${s?`Checkpoint ${state.completed.length+1} of ${hunt.stages.length}`:'Adventure complete'}</span><span>${Math.round(state.completed.length/hunt.stages.length*100)}% discovered</span></div><div class="progress"><span style="width:${state.completed.length/hunt.stages.length*100}%"></span></div></section>
    <nav class="tabs" aria-label="Adventure tools">${[['mission','Mission'],['map','Map'],['kit','Field kit'],['journal','Journal']].map(([id,label])=>`<button data-tab="${id}" class="${tab===id?'active':''}" aria-current="${tab===id?'page':'false'}">${label}</button>`).join('')}</nav><div id="view"></div>`;
  on('#back','click',backHome);document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{tab=b.dataset.tab;renderGame();});
  if(tab==='mission')renderMission();if(tab==='map')renderMap();if(tab==='kit')renderKit();if(tab==='journal')renderJournal();
}
function renderMission(){
  const s=stage();const view=$('#view');
  if(!s){view.innerHTML=`<section class="panel narrow"><span class="eyebrow">THE STORY IS YOURS NOW</span><h2 style="margin-top:15px">${hunt.id==='howell'?'Agency restored. Treasure recovered.':'A treasure worthy of a captain.'}</h2><p>You followed every clue and completed ${hunt.stages.length} checkpoints. Your discoveries are saved in the journal.</p><button id="victory-journal">Open your journal →</button></section>`;on('#victory-journal','click',()=>{tab='journal';renderGame();});return;}
  const hintCount=state.hints[s.id]||0;
  view.innerHTML=`<section class="panel narrow"><span class="eyebrow">${esc(hunt.narrator)} / FIELD TRANSMISSION</span><h2 style="margin-top:12px">${esc(s.title)}</h2><p class="briefing">${esc(s.text)}</p>${s.audio&&s.id!=='processor'?`<audio controls preload="none" src="${esc(s.audio)}" aria-label="${esc(s.title)} narration"></audio>`:''}<button id="speak" class="quiet">Read aloud</button><div id="challenge" class="objective"></div><details><summary>Need a nudge? (${hintCount}/${s.hints.length} hints revealed)</summary><div>${s.hints.slice(0,hintCount).map(h=>`<p class="hint">${esc(h)}</p>`).join('')}</div>${hintCount<s.hints.length?'<button id="hint" class="quiet">Reveal next hint</button>':''}</details></section>`;
  on('#speak','click',()=>{if(!window.speechSynthesis){notify('Read aloud is unavailable. The full text is above.');return;}window.speechSynthesis.cancel();const utterance=new SpeechSynthesisUtterance($('.briefing').textContent);utterance.rate=s.interfaceMode==='override'?.82:.94;utterance.pitch=s.interfaceMode==='override'?.58:.92;window.speechSynthesis.speak(utterance);});
  on('#hint','click',event=>{
    const count=state.hints[s.id]||0;
    state.hints[s.id]=count+1;
    save();
    const details=event.currentTarget.closest('details');
    const hint=document.createElement('p');
    hint.className='hint';
    hint.textContent=s.hints[count];
    details.querySelector('div').append(hint);
    details.querySelector('summary').textContent=`Need a nudge? (${count+1}/${s.hints.length} hints revealed)`;
    if(count+1===s.hints.length)event.currentTarget.remove();
  });
  const challenge=$('#challenge');
  if(s.type==='continue'){challenge.innerHTML='<button id="continue">Continue the mission →</button>';on('#continue','click',complete);}
  if(['geo_quiz','geo_scan','geo_signal','nodes'].includes(s.type))renderLocation(challenge,s);
  else if(s.type==='scan')renderScan(challenge,s);
  else if(s.type==='audio'){
    challenge.innerHTML='<p>Recover the message in the Field kit, then submit the phrase here.</p><button id="open-cipher" class="quiet">Open CipherWave</button><form id="phrase-form"><label for="phrase">Shutdown phrase</label><input id="phrase" maxlength="120" autocomplete="off" required><button style="margin-top:12px">Break the override →</button></form>';
    on('#open-cipher','click',()=>{tab='kit';renderGame();});on('#phrase-form','submit',e=>{e.preventDefault();if(normalize($('#phrase').value)===normalize(answerFor(s)))complete();else notify('That phrase did not break the override. Check your decoded message or collected fragments.');});
  }
}
function isArrived(s){return state.mode==='demo'?demoArrived:withinRange(position,settings[hunt.id].locations[s.location],settings[hunt.id].arrivalRadiusMeters);}
function renderLocation(container,s){
  container.innerHTML=`<h3>Reach the checkpoint</h3><p class="fine">${state.mode==='demo'?'Use the arrival simulator to explore this stage.':'GPS confirms arrival before the challenge opens. Stay on the approved route.'}</p><p id="gps-status" role="status"></p><div class="row"><button id="gps" class="quiet">${state.mode==='demo'?'Simulate arrival':'Enable location'}</button><button id="stop-gps" class="text-button" ${state.mode==='demo'?'hidden':''}>Stop location</button></div><div id="arrived-challenge"></div>`;
  on('#gps','click',()=>{if(state.mode==='demo'){demoArrived=true;updateLocationUI();}else requestLocation();});on('#stop-gps','click',()=>{stopLocation();updateLocationUI();});updateLocationUI();
}
function updateLocationUI(){
  const s=stage();if(!s)return;
  const status=$('#gps-status');
  if(status){
    if(state.mode==='demo')status.textContent=demoArrived?'Simulated arrival confirmed.':'No GPS used in demo mode.';
    else if(!position)status.textContent=watch!==null?'Finding your location…':'Location is off. Enable it when ready.';
    else{const target=settings[hunt.id].locations[s.location];status.textContent=`${coordinates(target)?Math.round(distance(position,target)*1.09361)+' yd to checkpoint · ':''}GPS accuracy ±${Math.round(position.accuracy*1.09361)} yd${Date.now()-position.at>=20000?' · Waiting for a fresh fix':isArrived(s)?' · Arrival confirmed':' · Move closer or wait for a more accurate fix'}`;}
  }
  const container=$('#arrived-challenge');if(!container)return;
  if(s.type==='nodes'&&state.timer){if(!container.firstChild)renderNodes(container,s);return;}
  if(s.type==='geo_signal'&&container.dataset.scanStarted)return;
  if(!isArrived(s)){container.innerHTML='';return;}
  if(container.firstChild)return;
  if(s.type==='geo_quiz'){
    container.innerHTML=`<h3 style="margin-top:25px">${esc(s.question)}</h3>${state.mode==='demo'?`<p class="fine">Demo answer: ${esc(answerFor(s))}</p>`:''}<div class="choices">${s.options.map((option,i)=>`<button data-answer="${i}">${esc(option)}</button>`).join('')}</div>`;
    container.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{if(!isArrived(s)){updateLocationUI();notify('A fresh location fix within range is needed.');return;}if(normalize(s.options[Number(b.dataset.answer)])===normalize(answerFor(s)))complete();else notify('Take another look at the landmark and try again.');});
  }else if(s.type==='geo_scan')renderScan(container,s);
  else if(s.type==='geo_signal')renderAreaScan(container,s);
  else if(s.type==='nodes')renderNodes(container,s);
}
function renderAreaScan(container,s){
  container.innerHTML='<button id="perform-scan">Perform scan</button><audio hidden></audio><p role="status"></p>';
  const button=container.querySelector('button');
  const audio=container.querySelector('audio');
  const status=container.querySelector('[role="status"]');
  const briefing=$('.briefing');
  briefing.setAttribute('aria-live','polite');
  audio.addEventListener('ended',()=>{
    if(!audio.isConnected)return;
    briefing.textContent=s.result;
    status.textContent='';
    button.disabled=false;
    button.textContent='Continue the mission →';
    button.onclick=complete;
  });
  audio.addEventListener('pause',()=>{
    if(!audio.ended&&audio.isConnected){
      button.disabled=false;
      status.textContent='Scan paused. Tap Perform scan to resume.';
    }
  });
  button.onclick=async()=>{
    if(!container.dataset.scanStarted&&!isArrived(s)){updateLocationUI();return;}
    window.speechSynthesis?.cancel();
    button.disabled=true;
    status.textContent='Scanning…';
    container.dataset.scanStarted='true';
    try{
      if(!audio.src){
        const {samples,sampleRate}=encodeSignal(s.signal);
        const url=URL.createObjectURL(new Blob([wavBytes(samples,sampleRate)],{type:'audio/wav'}));
        resources.push(url);
        audio.src=url;
      }
      await audio.play();
    }catch{
      if(!audio.isConnected)return;
      button.disabled=false;
      status.textContent='The scan audio could not play. Tap Perform scan to try again.';
    }
  };
}
function requestLocation(){
  if(!window.isSecureContext){notify('Phone GPS requires HTTPS. Use the GitHub Pages address; localhost works only on this computer.');return;}
  if(!navigator.geolocation){notify('This browser does not support location. Ask the organizer for a manual checkpoint override.');return;}
  if(watch!==null)return;
  watch=navigator.geolocation.watchPosition(p=>{position={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,at:p.timestamp};updateLocationUI();updateNodeUI();updateMapPosition();},error=>{const messages={1:'Location denied. Allow location in your browser settings, then try again.',2:'Location unavailable. Move into an open area and try again.',3:'Location timed out. Try again outdoors.'};notify(messages[error.code]||error.message);stopLocation();updateLocationUI();},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  updateLocationUI();
}
function renderScan(container,s){
  container.innerHTML=`<h3 style="margin-top:20px">Find the access marker</h3><p>Scan the QR with your phone’s camera, tap the NFC tag, or enter the printed code below.</p><form id="unlock-form"><label for="unlock">Marker code or full unlock URL</label><input id="unlock" autocomplete="off" required><button style="margin-top:12px">Unlock checkpoint →</button></form><button id="camera" class="quiet" style="margin-top:12px">Scan with this browser</button>${state.mode==='demo'?`<p class="fine">Demo marker: <code>${esc(s.token)}</code></p><button id="demo-scan" class="quiet">Simulate marker scan</button>`:''}`;
  on('#unlock-form','submit',e=>{e.preventDefault();tryUnlock($('#unlock').value);});on('#demo-scan','click',()=>tryUnlock(s.token));on('#camera','click',safeRun(startScanner));
}
function tryUnlock(raw){
  let token=String(raw).trim();if(token.includes('#/unlock/')){try{token=decodeURIComponent(token.split('#/unlock/')[1]);}catch{notify('Malformed unlock URL.');return;}}
  const s=stage();if(!s){notify('This adventure is already complete.');return;}
  if(s.token!==token){notify('This marker does not match your current checkpoint. Complete the earlier clues first.');return;}
  if(s.location&&!isArrived(s)){notify('Enable location and reach this checkpoint before using its marker. You can enter the code again after arrival.');return;}
  complete();
}
async function startScanner(){
  if(!('BarcodeDetector' in window)){notify('This browser has no built-in QR detector. Use your phone camera app to open the marker link, or enter its printed code.');return;}
  const detector=new BarcodeDetector({formats:['qr_code']});showModal('<h2>Scan the access marker</h2><video id="scanner" autoplay playsinline muted></video><p>Point the camera at the QR code.</p>');
  const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:'environment'}});if(!modal.open){stream.getTracks().forEach(t=>t.stop());return;}scannerStream=stream;$('#scanner').srcObject=stream;
  const scan=async()=>{if(scannerStream!==stream||!modal.open)return;try{const codes=await detector.detect($('#scanner'));if(codes.length){modal.close();tryUnlock(codes[0].rawValue);return;}}catch{/* Wait for a complete frame. */}setTimeout(scan,250);};scan();
}
function renderNodes(container,s){
  const seconds=settings.howell.sensorSeconds;
  if(!state.timer){container.innerHTML=`<p>Capture Alpha, Bravo, and Charlie within ${seconds} seconds. Walk carefully. The timer starts when you tap Begin.</p><button id="begin-sweep">Begin sensor sweep</button>`;on('#begin-sweep','click',()=>{if(!isArrived(s)){notify('Confirm arrival before beginning the sweep.');return;}state.timer={deadline:Date.now()+seconds*1000,captured:[]};save();renderNodes(container,s);});return;}
  container.innerHTML=`<p class="timer" id="countdown" role="timer"></p><p class="fine">${untimed?'Organizer has disabled the timer for this session.':'Leaving this screen does not pause the timer. A failed attempt can be retried.'}</p>${['alpha','bravo','charlie'].map(id=>`<div class="node" id="node-${id}"><div><strong>Sensor ${id[0].toUpperCase()+id.slice(1)}</strong><p class="fine" id="distance-${id}"></p></div><button data-capture="${id}">Capture</button></div>`).join('')}<button id="restart-sweep" class="quiet">Restart sweep</button>`;
  container.querySelectorAll('[data-capture]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.capture;if(!state.timer)return;if(!untimed&&Date.now()>=state.timer.deadline){updateNodeUI();return;}
    if(state.mode!=='demo'&&!withinRange(position,settings.howell.locations[id],settings.howell.captureRadiusMeters)){notify('Move within range and wait for a fresh, accurate GPS fix.');return;}
    if(!state.timer.captured.includes(id))state.timer.captured.push(id);save();if(state.timer.captured.length===3){complete();return;}updateNodeUI();
  });
  on('#restart-sweep','click',()=>{state.timer=null;save();clearInterval(timerTick);renderNodes(container,s);});clearInterval(timerTick);timerTick=setInterval(()=>{updateLocationUI();updateNodeUI();},500);updateNodeUI();
}
function updateNodeUI(){
  if(!state?.timer||!$('#countdown'))return;
  const remaining=Math.max(0,Math.ceil((state.timer.deadline-Date.now())/1000));$('#countdown').textContent=untimed?'UNTIMED':`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  if(remaining===0&&!untimed){state.timer=null;save();clearInterval(timerTick);notify('The signal faded. Return to the pool checkpoint and start another sweep.');renderMission();return;}
  for(const id of ['alpha','bravo','charlie']){const captured=state.timer.captured.includes(id), target=settings.howell.locations[id];const b=$(`[data-capture="${id}"]`);if(!b)continue;
    const inRange=state.mode==='demo'||withinRange(position,target,settings.howell.captureRadiusMeters);
    b.disabled=captured||!inRange;b.textContent=captured?'Captured ✓':'Capture';$('#node-'+id).classList.toggle('captured',captured);$('#distance-'+id).textContent=state.mode==='demo'?'Simulated node · tap to capture':position&&coordinates(target)?`${Math.round(distance(position,target)*1.09361)} yd · ${inRange?'in range':'out of range / waiting for accuracy'}`:'Enable location to measure range.';
  }
}
function renderMap(){
  const locations=settings[hunt.id].locations;
  const entries=hunt.stages.map((s,i)=>({s,i,point:locations[s.location]})).filter(e=>coordinates(e.point));
  $('#view').innerHTML=`<section class="panel"><h2>Your field map</h2><p class="fine">Completed checkpoints are green. Your current destination is amber. Locked stops are gray. ${state.mode==='demo'?'This demo does not simulate real coordinates.':''}</p>${entries.length?'<div id="map" class="map" aria-label="Adventure location map"></div>':'<div class="banner">No real route has been configured. Add coordinates in Organizer access → Setup. Demo challenges work without a map.</div>'}<div class="row" style="margin-top:16px"><button id="map-gps" class="quiet">Enable location</button><button id="map-stop" class="text-button">Stop location</button></div><p id="map-status" class="fine"></p><ul class="location-list">${hunt.stages.map((s,i)=>`<li><span class="badge">${i<state.completed.length?'✓ COMPLETE':i===state.completed.length?'→ CURRENT':'LOCKED'}</span> ${esc(s.title)} ${locations[s.location]&&coordinates(locations[s.location])?`<small>· ${locations[s.location].lat.toFixed(5)}, ${locations[s.location].lng.toFixed(5)}</small>`:''}</li>`).join('')}</ul></section>`;
  on('#map-gps','click',()=>{if(state.mode==='demo'){notify('GPS is disabled in demo mode. Use field mode after configuring the route.');return;}requestLocation();});on('#map-stop','click',()=>{stopLocation();updateMapPosition();});
  if(!entries.length)return;
  if(!window.L){$('#map').innerHTML='<p style="padding:25px">The map library could not load. Check your connection. The checkpoint list below remains available.</p>';return;}
  map=L.map('map');L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(map);
  for(const {s,i,point} of entries){const marker=L.marker([point.lat,point.lng],{icon:L.divIcon({className:'',html:`<div class="pin ${i===state.completed.length?'current':i>state.completed.length?'locked':''}"></div>`,iconSize:[24,24]})}).addTo(map);marker.bindPopup(esc(s.title));if(i===state.completed.length)L.circle([point.lat,point.lng],{radius:settings[hunt.id].arrivalRadiusMeters,color:'#d68b35',weight:1}).addTo(map);}
  if(stage()?.type==='nodes')for(const id of ['alpha','bravo','charlie']){const p=locations[id];if(coordinates(p)){L.marker([p.lat,p.lng]).addTo(map).bindPopup('Sensor '+id);L.circle([p.lat,p.lng],{radius:settings.howell.captureRadiusMeters,color:'#75944c',weight:1}).addTo(map);}}
  map.fitBounds(entries.map(e=>[e.point.lat,e.point.lng]),{padding:[30,30],maxZoom:17});updateMapPosition();
}
function updateMapPosition(){
  const status=$('#map-status');if(status)status.textContent=position?`Location active · accuracy ±${Math.round(position.accuracy*1.09361)} yd. Map tiles require internet.`:'Location is off. Map tiles require internet.';
  if(!map)return;mapMarkers.forEach(m=>m.remove());mapMarkers=[];if(position){mapMarkers.push(L.marker([position.lat,position.lng],{icon:L.divIcon({className:'',html:'<div class="pin player"></div>',iconSize:[16,16]})}).addTo(map).bindPopup('Your latest position'));mapMarkers.push(L.circle([position.lat,position.lng],{radius:position.accuracy,color:'#3881b5',weight:1}).addTo(map));}
}
function renderKit(){
  $('#view').innerHTML=`<section class="panel narrow"><span class="eyebrow">FIELD EQUIPMENT / CW–01</span><h2 style="margin-top:12px">CipherWave</h2><p>Recover a message from an audible dual-tone signal. Every decoded message is checked for transmission errors.</p><div class="banner">Microphone reception is experimental. Start with a WAV upload. Keep the opening low tone and the entire message in your recording.</div><label for="audio-file">Decode an audio file</label><input id="audio-file" type="file" accept="audio/*"><div class="row" style="margin-top:18px"><button id="record" class="quiet">Record microphone</button><button id="stop-record" class="quiet" disabled>Stop & decode</button></div><p id="record-status" class="fine">Recording stays on this device. Maximum recording: 60 seconds.</p><pre id="decoded" aria-live="polite">Awaiting a signal…</pre>${hunt.id==='howell'?'<button id="sample" class="quiet">Download Agency signal (.wav)</button><p class="fine">Organizer: play this signal on a separate device at the audio checkpoint. A file upload also works as a fallback.</p>':'<p class="fine">This adventure does not currently require an audio cipher.</p>'}</section>
    <section class="panel narrow">
      <h2>Heat Scanner</h2>
      <p>View your surroundings through a red camera filter.</p>
      <button id="open-heat-scanner" class="quiet">Open Heat Scanner</button>
    </section>
    <section class="panel narrow"><h3>Take your progress with you</h3><p>Move your progress and text notes to another device with a copy-and-paste code. Photos remain on this device.</p><button id="transfer" class="quiet">Export / restore progress</button></section>`;
  on('#sample','click',safeRun(()=>{const encoded=encodeSignal(settings.howell.shutdownPhrase);download('agency-signal.wav',wavBytes(encoded.samples,encoded.sampleRate),'audio/wav');}));
  on('#audio-file','change',safeRun(async e=>{const file=e.target.files[0];if(!file)return;if(file.size>25*1024*1024)throw Error('Choose an audio file smaller than 25 MB.');await decodeBlob(file);}));
  on('#record','click',safeRun(startRecording));on('#stop-record','click',()=>{if(recorder?.state==='recording')recorder.stop();});on('#transfer','click',showTransfer);
  on('#open-heat-scanner','click',showHeatScanner);
}
function showHeatScanner(){
  const chipCooled=hunt.id==='howell'&&state.completed.includes('processor');
  showModal(`<h2>Heat Scanner</h2>
    <div class="heat-scanner-view">
      <video autoplay playsinline muted aria-label="Live camera preview"></video>
      <span class="heat-scanner-reticle" aria-hidden="true"></span>
      <div class="heat-scanner-label">
        <span>Howell Sneak</span>
        <span class="heat-scanner-prototype">Heat Visor - Nandina Prototype v0.4</span>
      </div>
    </div>
    <p class="fine" id="heat-scanner-status" role="status"></p>
    <button class="quiet" id="start-heat-camera">Start camera</button>`);

  const view=modalBody.querySelector('.heat-scanner-view');
  const video=view.querySelector('video');
  const status=$('#heat-scanner-status');
  const start=$('#start-heat-camera');

  async function startCamera(){
    if(!navigator.mediaDevices?.getUserMedia){
      status.textContent=window.isSecureContext
        ? 'Preview only. This browser does not provide camera access.'
        : 'Preview only. Open the HTTPS site to use the camera.';
      start.hidden=true;
      return;
    }

    let stream;
    const tracking=new AbortController();
    const stop=(message='Camera paused. Tap Start camera to resume.')=>{
      if(stopHeatScanner!==stop)return;
      stopHeatScanner=null;
      tracking.abort();
      stream?.getTracks().forEach(track=>track.stop());
      video.srcObject=null;
      view.classList.remove('live');
      start.hidden=false;
      status.textContent=message;
    };
    stopHeatScanner=stop;
    start.hidden=true;
    status.textContent='Waiting for camera access…';

    try{
      stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(stopHeatScanner!==stop||!modal.open){
        stream.getTracks().forEach(track=>track.stop());
        return;
      }
      stream.getVideoTracks()[0].addEventListener('ended',()=>stop('Camera disconnected. Tap Start camera to try again.'),{once:true});
      video.srcObject=stream;
      await video.play();
      if(stopHeatScanner!==stop||!modal.open)return;
      view.classList.add('live');
      status.textContent='Camera live';
      const updateTracking=message=>{
        if(tracking.signal.aborted)return;
        status.textContent=message===null?'Camera live · Image tracking unavailable.':
          message||'Camera live';
      };
      import('./lib/heat-ar/hologram.js')
        .then(({startHeatTracking})=>startHeatTracking(video,view,tracking.signal,{chipCooled,onTracking:updateTracking}))
        .catch(()=>updateTracking(null));
    }catch(error){
      stop(error.name==='NotAllowedError'
        ? 'Preview only. Allow camera access in your browser, then try again.'
        : 'Preview only. The camera could not start.');
    }
  }

  start.addEventListener('click',startCamera);
  startCamera();
}
async function decodeBlob(blob){
  const generation=uiGeneration,output=$('#decoded');if(output)output.textContent='Analyzing signal…';
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw Error('Audio processing is unavailable in this browser.');const context=new AudioContext();
  try{const buffer=await context.decodeAudioData(await blob.arrayBuffer());if(buffer.duration>65)throw Error('Use an audio clip no longer than 65 seconds.');const mono=new Float32Array(buffer.length);for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/buffer.numberOfChannels;}await new Promise(r=>setTimeout(r,25));const message=decodeSignal(mono,buffer.sampleRate);if(generation===uiGeneration&&output)output.textContent=message;}catch(error){if(generation===uiGeneration&&output)output.textContent=error.message;throw error;}finally{await context.close();}
}
async function startRecording(){
  if(!navigator.mediaDevices?.getUserMedia||!window.MediaRecorder)throw Error('Microphone recording is unavailable. Use an HTTPS page and supported browser, or upload a WAV.');
  const generation=uiGeneration;const stream=await navigator.mediaDevices.getUserMedia({audio:{echoCancellation:false,noiseSuppression:false,autoGainControl:false}});
  if(generation!==uiGeneration){stream.getTracks().forEach(t=>t.stop());return;}recordStream=stream;const chunks=[];recorder=new MediaRecorder(stream);const activeRecorder=recorder;
  activeRecorder.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
  activeRecorder.onstop=()=>{clearTimeout(recordStopTimer);stream.getTracks().forEach(t=>t.stop());if(generation===uiGeneration&&tab==='kit'&&!modal.open){$('#record').disabled=false;$('#stop-record').disabled=true;$('#record-status').textContent='Recording ended. You can record again.';safeRun(()=>decodeBlob(new Blob(chunks,{type:activeRecorder.mimeType})))();}};
  recorder.start();$('#record').disabled=true;$('#stop-record').disabled=false;$('#record-status').textContent='Recording… Play the full signal on the other device, then tap Stop & decode.';recordStopTimer=setTimeout(()=>{if(activeRecorder.state==='recording')activeRecorder.stop();},60000);
}
async function renderJournal(){
  const generation=uiGeneration;
  $('#view').innerHTML=`<section class="panel narrow"><h2>Your discoveries</h2>${state.completed.length?state.completed.map(id=>{const s=hunt.stages.find(s=>s.id===id);return `<article class="journal-entry"><span class="badge">${esc(s.artifact||'Checkpoint complete')}</span><h3 style="margin-top:12px">${esc(s.title)}</h3><p>${esc(s.text)}</p></article>`;}).join(''):'<p>Your first discovery is waiting. Complete a checkpoint to begin your journal.</p>'}</section><section class="panel narrow"><h3>Field notes</h3>${state.notes.map(n=>`<p>${esc(n.text)}<br><small>${new Date(n.at).toLocaleString()}</small></p>`).join('')}<form id="note-form"><label for="note">Add a note</label><textarea id="note" maxlength="3000" required></textarea><button style="margin-top:12px">Save note</button></form><label for="photo">Add a local photo (up to 8 MB)</label><input id="photo" type="file" accept="image/*"><p class="fine">Photos are journal memories, not checkpoint triggers. Export photos individually before clearing browser data.</p><div id="photos"></div></section>`;
  on('#note-form','submit',e=>{e.preventDefault();if(state.notes.length>=200){notify('This journal already has 200 notes.');return;}const text=$('#note').value.trim();if(!text)return;state.notes.push({text,at:Date.now()});save();renderGame();});
  on('#photo','change',safeRun(async e=>{const file=e.target.files[0];if(file){await addPhoto(stateKey(),file);renderGame();}}));
  try{const photos=await photosFor(stateKey());if(generation!==uiGeneration)return;$('#photos').innerHTML=photos.map(p=>{const url=URL.createObjectURL(p.blob);resources.push(url);return `<div class="journal-entry"><img class="note-photo" src="${url}" alt="Field journal photo"><div class="row"><a href="${url}" download="field-photo.jpg">Download photo</a><button class="text-button" data-delete-photo="${p.id}">Delete photo</button></div></div>`;}).join('');document.querySelectorAll('[data-delete-photo]').forEach(b=>b.onclick=safeRun(async()=>{await deletePhoto(b.dataset.deletePhoto);renderGame();}));}catch{if(generation===uiGeneration)$('#photos').textContent='Photo storage is unavailable in this browser. Text notes still work.';}
}
function showTransfer(){
  showModal(`<h2>Carry the story forward</h2><p>Codes contain this adventure’s progress and text notes. Photos and organizer settings are not included. Restoring replaces the save for the matching adventure and mode.</p>${state?'<label for="export-code">Your progress code</label><textarea id="export-code" readonly></textarea><button id="copy-code" class="quiet" style="margin-top:10px">Copy code</button><button id="download-code" class="quiet" style="margin:10px">Download code</button>':''}<form id="restore-form"><label for="restore-code">Restore a progress code</label><textarea id="restore-code" required maxlength="200000"></textarea><button style="margin-top:12px">Review restore</button></form><div id="restore-review"></div>`);
  if(state){$('#export-code').value=encodeProgress(state);on('#copy-code','click',safeRun(async()=>{if(navigator.clipboard){await navigator.clipboard.writeText($('#export-code').value);notify('Progress code copied.');}else{$('#export-code').select();notify('Select and copy the highlighted code.');}}));on('#download-code','click',()=>download('hidden-trails-progress.txt',$('#export-code').value,'text/plain'));}
  on('#restore-form','submit',safeRun(e=>{e.preventDefault();const restored=decodeProgress($('#restore-code').value.trim(),hunts),owner=hunts.find(h=>h.id===restored.hunt);$('#restore-review').innerHTML=`<p>Restore <strong>${esc(owner.title)}</strong> (${restored.mode}), ${restored.completed.length} completed checkpoints? This replaces its current saved progress.</p><button id="confirm-restore">Replace save & restore</button>`;on('#confirm-restore','click',()=>{cleanup();stopLocation();hunt=owner;state=restored;untimed=false;organizerOpen=false;demoArrived=false;tab='mission';save();modal.close();if(state.mode==='field'&&settingsProblems(settings,hunt.id).length)notify('This device still needs the field route settings. Ask the organizer to load them before continuing.');renderGame();});}));
}
function showHelp(){showModal(`<h2>A field guide for curious minds</h2><p>Choose an adventure and follow its current mission. The demo uses simulated arrivals and markers. Field play needs an organizer-configured route and a phone with location enabled.</p><h3>Permissions & privacy</h3><p>Location checks happen on this device. Camera access is optional for QR scanning; your phone camera can open the same links. Microphone access is optional for CipherWave. Recordings are processed in memory and are not uploaded.</p><p>Progress and text notes are stored in this browser. Photos use local IndexedDB. Clearing browser data removes these saves; export progress and download photos first. Codes include your text notes, so share them deliberately.</p><p>GitHub Pages serves the app. Fonts and the optional Leaflet map library load from external services; OpenStreetMap receives tile requests for the viewed area. This app has no analytics or game-data server. It needs a connection to load; offline play is not guaranteed.</p><h3>On the trail</h3><p>Walk, stay on approved paths, and look up from the screen. Children should play with an adult. The pool and processor are story locations: use organizer-prepared props in approved areas, away from water and real equipment. Never enter equipment enclosures or mix chemicals.</p><h3>Having trouble?</h3><p>GPS and microphone need HTTPS on a phone. A local Wi-Fi HTTP address does not provide that. If GPS is inaccurate, wait outdoors or ask the organizer for a checkpoint override. For QR trouble, enter the printed marker code.</p><p>Organizer access uses a convenience PIN, initially 1980. Because this is a static game, its answers and PIN are visible in the downloaded source.</p>`);}
function openOrganizer(){
  if(organizerOpen){renderOrganizer();return;}
  showModal('<h2>Organizer access</h2><p>Enter your four-digit organizer PIN. Hint: Saturday morning cartoons and Marty McFly’s decade.</p><form id="pin-form"><label for="pin">PIN</label><input id="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" type="password" required><button style="margin-top:12px">Open organizer tools</button></form>');
  on('#pin-form','submit',e=>{e.preventDefault();if($('#pin').value===String(settings.organizerPin)){organizerOpen=true;renderOrganizer();}else notify('That PIN did not match.');});
}
function renderOrganizer(){
  showModal(`<h2>Organizer’s desk</h2><p class="fine">Controls change this device only. Download settings and include them in your deployment to configure every player’s device.</p><div class="row"><button id="setup" class="quiet">Setup & readiness</button><button id="markers" class="quiet">Printable marker links</button><button id="encoder" class="quiet">Audio encoder</button></div>${hunt?`<h3 style="margin-top:25px">${esc(hunt.title)} · ${state.mode}</h3><p>Manual controls are for route problems and supervised testing.</p><div class="row"><button id="skip" class="quiet" ${!stage()?'disabled':''}>Complete current checkpoint</button><button id="untimed" class="quiet">${untimed?'Enable':'Disable'} sensor timer</button><button id="reset" class="danger">Reset this adventure save</button></div><label for="jump">Jump to checkpoint (changes saved progress)</label><select id="jump">${hunt.stages.map((s,i)=>`<option value="${i}" ${i===state.completed.length?'selected':''}>${i+1}. ${esc(s.title)}</option>`).join('')}</select><button id="jump-go" class="quiet" style="margin:10px">Jump</button>`:'<p>Open an adventure to access checkpoint overrides and reset controls.</p>'}<p><button id="lock" class="text-button">Lock organizer tools</button></p>`);
  on('#setup','click',renderSetup);on('#markers','click',renderMarkers);on('#encoder','click',renderEncoder);
  on('#skip','click',()=>{modal.close();complete();});on('#untimed','click',()=>{untimed=!untimed;notify(untimed?'Sensor timer disabled for this session.':'Sensor timer enabled.');modal.close();renderGame();});
  on('#jump-go','click',()=>{const index=Number($('#jump').value);state.completed=hunt.stages.slice(0,index).map(s=>s.id);state.timer=null;demoArrived=false;save();modal.close();renderGame();});
  on('#reset','click',()=>{showModal('<h2>Reset this adventure?</h2><p>This clears checkpoint progress and text notes for the current adventure and mode. Local photos stay in the journal and can be deleted individually.</p><button id="confirm-reset" class="danger">Reset this save</button>');on('#confirm-reset','click',()=>{state=freshState(hunt.id,state.mode);demoArrived=false;untimed=false;save();modal.close();renderGame();});});on('#lock','click',()=>{organizerOpen=false;modal.close();});
}
function renderSetup(){
  showModal(`<h2>Setup & readiness</h2><p><a class="setup-builder-link" href="setup.html">Open guided setup &amp; clickable map →</a></p><p class="fine">Place pins and answer questions without editing JSON. Download your configuration to attach in chat.</p>${hunts.map(h=>{const problems=settingsProblems(settings,h.id);return `<h3>${esc(h.title)}</h3>${problems.length?`<ul>${problems.map(p=>`<li>${esc(p)}</li>`).join('')}</ul>`:'<p>✓ Required fields are filled. Walk the route and verify permissions before inviting players.</p>'}`;}).join('')}<details><summary>How to fill the settings</summary><p>Replace each null location with {"lat": 28.12345, "lng": -81.12345} using your actual approved point. Set fenceAnswer and fizzAnswer to one of their existing color options. Supply all five pirate questions, options, and matching answers. The original pirate coordinates were not included in your summaries.</p><p>Download the result as content/hunt-settings.json for deployment. A local browser save is only for testing this device.</p></details><label for="settings-json">Hunt settings JSON</label><textarea id="settings-json" rows="15" spellcheck="false"></textarea><div class="row" style="margin-top:12px"><button id="save-settings">Save on this device</button><button id="download-settings" class="quiet">Download settings</button><button id="clear-settings" class="quiet">Use deployed settings</button></div><p id="settings-result" role="status"></p>`);
  $('#settings-json').value=JSON.stringify(settings,null,2);
  const parse=()=>{const value=JSON.parse($('#settings-json').value);if(!/^\d{4}$/.test(String(value.organizerPin)))throw Error('Organizer PIN must contain four digits.');if(!value.howell||!value.pirate||!Array.isArray(value.pirate.clues)||value.pirate.clues.length!==5||value.pirate.clues.some(c=>!Array.isArray(c.options)))throw Error('Keep both adventure sections and five pirate clue objects with options arrays.');createHunts(source,value);return value;};
  on('#save-settings','click',safeRun(()=>{const value=parse();localStorage.setItem('hidden-trails:settings',JSON.stringify(value));settings=value;hunts=createHunts(source,settings);if(hunt)hunt=hunts.find(h=>h.id===hunt.id);$('#settings-result').textContent='Saved on this device. Reopen Setup to refresh the readiness list. Download and deploy this file to share it with players.';if(hunt)renderGame();else renderHome();}));
  on('#download-settings','click',safeRun(()=>download('hunt-settings.json',JSON.stringify(parse(),null,2))));
  on('#clear-settings','click',safeRun(async()=>{const response=await fetch('content/hunt-settings.json',{cache:'reload'});if(!response.ok)throw Error('Could not reload deployed settings.');const deployed=await response.json();const next=createHunts(source,deployed);localStorage.removeItem('hidden-trails:settings');settings=deployed;hunts=next;if(hunt)hunt=hunts.find(h=>h.id===hunt.id);renderSetup();if(hunt)renderGame();else renderHome();}));
}
function renderMarkers(){
  const base=new URL('./',location.href);base.hash='';base.search='';
  showModal(`<h2>Access markers</h2><p>Encode these exact URLs into QR codes or NFC tags. Print the plain code under each QR as a fallback. Both paths use the same unlock route.</p>${hunts.map(h=>`<h3>${esc(h.title)}</h3>${h.stages.filter(s=>s.token).map(s=>`<p><strong>${esc(s.title)}</strong><br><code>${esc(s.token)}</code><br><a class="code" href="${esc(base.href+'#/unlock/'+s.token)}">${esc(base.href+'#/unlock/'+s.token)}</a></p>`).join('')}`).join('')}<p class="fine">Generate final QR labels from the deployed HTTPS address, not localhost. Sensor captures use GPS and do not require QR labels in this version.</p>`);
}
function renderEncoder(){
  showModal('<h2>CipherWave encoder</h2><p>Creates an audible signal with an opening synchronization tone, repeated characters, and a checksum. This is a game cipher, not encryption.</p><label for="message">Message (printable ASCII, up to 120 characters)</label><textarea id="message" maxlength="120"></textarea><div class="row" style="margin-top:12px"><button id="encode-download">Download WAV</button><button id="encode-preview" class="quiet">Play preview</button></div><p class="fine">Start at a comfortable volume. Allow a second of recording before playback and capture the complete signal. Very long messages may exceed the 60-second microphone recording limit; use a file upload.</p>');$('#message').value=settings.howell.shutdownPhrase;
  const encode=()=>{const signal=encodeSignal($('#message').value);return wavBytes(signal.samples,signal.sampleRate);};on('#encode-download','click',safeRun(()=>download('cipherwave-signal.wav',encode(),'audio/wav')));on('#encode-preview','click',safeRun(async()=>{signalAudio?.pause();if(signalUrl)URL.revokeObjectURL(signalUrl);signalUrl=URL.createObjectURL(new Blob([encode()],{type:'audio/wav'}));signalAudio=new Audio(signalUrl);await signalAudio.play();}));
}
boot();

