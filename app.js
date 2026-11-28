import {createHunts} from './adventures/hunts.js';
import {normalize,coordinates,distance,freshState,validateState,encodeShortProgress,decodeProgress,withinRange,settingsProblems} from './lib/core.js';
import {encodeSignal,encodeRepeatedSignal,decodeSignal,wavBytes} from './lib/cipher.js';
import {photosFor,addPhoto,deletePhoto} from './lib/photos.js';

const app=document.querySelector('#app'), modal=document.querySelector('#modal'), modalBody=document.querySelector('#modal-body');
const arrivalAlert=document.querySelector('#arrival-alert');
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const $=selector=>document.querySelector(selector);
const on=(selector,event,callback)=>{const element=$(selector);if(element)element.addEventListener(event,callback);};
let settings,source,hunts,hunt,state,tab='mission',position=null,watch=null,map=null,mapMarkers=[],timerTick=null,resources=[],organizerOpen=false,untimed=false;
let demoArrived=false,scannerStream=null,recorder=null,recordStream=null,recordStopTimer=null,signalAudio=null,signalUrl=null,uiGeneration=0;
let stopHeatScanner=null;
let stopMissionNarration=null;
let checkpointProximity=null, gameAudio=null, lastSweepTick=null, failedSweep=null;
const sweepSensors=[['alpha','Sensor Alpha'],['bravo','Sensor Bravo'],['charlie','Sensor Charlie']];
const howellMissionBackgrounds=['#f3f7ee','#e1ece1','#cfe0d4','#bad0c3','#a5bfb1','#90aa9a'];
const storageKey=(id,mode)=>`hidden-trails:v1:${id}:${mode}`;
const stateKey=()=>storageKey(hunt.id,state.mode);
function notify(message){$('#notice').textContent=message;$('#notice').classList.add('visible');clearTimeout(notify.timeout);notify.timeout=setTimeout(()=>$('#notice').classList.remove('visible'),6500);}
function showModal(html){stopMedia();modalBody.innerHTML=html;if(!modal.open)modal.showModal();}
function stopMedia(){stopHeatScanner?.();if(recorder?.state==='recording')recorder.stop();recorder=null;clearTimeout(recordStopTimer);recordStream?.getTracks().forEach(t=>t.stop());recordStream=null;scannerStream?.getTracks().forEach(t=>t.stop());scannerStream=null;signalAudio?.pause();signalAudio=null;if(signalUrl){URL.revokeObjectURL(signalUrl);signalUrl=null;}}
modal.addEventListener('close',stopMedia);
modal.addEventListener('close',updateCheckpointProximity);
arrivalAlert.addEventListener('click',()=>arrivalAlert.close());
arrivalAlert.addEventListener('close',updateCheckpointProximity);
function save(){try{localStorage.setItem(stateKey(),JSON.stringify(state));return true;}catch{notify('Progress could not be saved. Export a progress code before leaving this page.');return false;}}
function load(h,mode){try{const saved=localStorage.getItem(storageKey(h.id,mode));return saved?validateState(JSON.parse(saved),hunts):freshState(h.id,mode);}catch{notify('The previous save could not be read. You can restore an exported progress code.');return freshState(h.id,mode);}}
function clearMap(){map?.remove();map=null;mapMarkers=[];}
function cleanup(){uiGeneration++;stopSweepUpdates();clearMap();resources.forEach(URL.revokeObjectURL);resources=[];stopMedia();stopMissionNarration?.();stopMissionNarration=null;document.querySelectorAll('audio').forEach(a=>a.pause());}
function stopLocation(){if(watch!==null)navigator.geolocation?.clearWatch(watch);watch=null;position=null;if(arrivalAlert.open)arrivalAlert.close();}
function stage(){return hunt?.stages[state.completed.length];}
function answerFor(s){return state.mode==='demo'?(s.demoAnswer||s.answer):s.answer;}
function complete(){
  const s=stage();
  if(!s)return;
  state.completed.push(s.id);
  delete state.cooling;
  delete state.scanComplete;
  failedSweep=null;
  state.timer=null;
  demoArrived=false;
  save();
  $('#notice').classList.remove('visible');
  if(tab!=='mission')notify([`Checkpoint complete · ${s.title}`,s.completionMessage,s.artifact&&`Recovered: ${s.artifact}`].filter(Boolean).join(' '));
  renderGame();
  $('#mission-confirmation')?.focus({preventScroll:true});
  $('.tabs')?.scrollIntoView({block:'start',behavior:'instant'});
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
    document.addEventListener('visibilitychange',()=>{if(document.hidden){stopMedia();stopMissionNarration?.();document.querySelectorAll('audio').forEach(a=>a.pause());}});
    on('#help','click',showHelp);on('#organizer','click',openOrganizer);on('.brand','click',e=>{e.preventDefault();history.replaceState(null,'',location.pathname+location.search+'#/');backHome();});handleRoute();
  }catch(error){app.innerHTML=`<section class="panel"><h1>Let’s get connected.</h1><p>${esc(error.message)}</p><p>Open this app through its local server or GitHub Pages, rather than opening index.html directly.</p><pre>npm start</pre><p>Then visit <a href="http://localhost:4173">http://localhost:4173</a> on this computer.</p></section>`;}
}
function renderHome(){
  cleanup();delete document.documentElement.dataset.adventure;delete document.documentElement.dataset.signal;updateMissionPalette();document.title='Hidden Trails · Field adventures';
  app.innerHTML=`${location.protocol==='file:'?'<div class="banner">Serve this folder over HTTP locally or HTTPS on GitHub Pages to play.</div>':''}
  <section class="hero"><div><span class="eyebrow">YOUR NEXT ADVENTURE IS OUT THERE</span><h1>Ordinary places.<br>Extraordinary<br>secrets.</h1><p>Follow the clues. Decode the unexpected. Turn a walk into a story worth telling.</p><span class="badge">REAL PLACES. REAL DISCOVERIES.</span></div><div class="hero-art" aria-hidden="true"><div class="compass">✧</div><span class="art-tag">TAKE THE PATH LESS ORDINARY ↗</span></div></section>
  <section><div class="section-head"><h2>Choose your adventure</h2><small>Two stories. A world to explore.</small></div><div class="grid">${hunts.map(h=>{
    const saved=load(h,'demo'), field=load(h,'field'), problems=settingsProblems(settings,h.id);
    return `<article class="adventure"><div class="scene ${h.theme}"><span class="eyebrow">${esc(h.subtitle)}</span><span class="scene-symbol" aria-hidden="true">${h.theme==='spy'?'⌖':'⚑'}</span><span class="badge ${h.theme==='spy'?'dark':'amber'}">${h.stages.length} CHECKPOINTS</span></div><div class="card-body"><small class="eyebrow">${esc(h.location)}</small><h3 style="margin-top:12px">${esc(h.title)}</h3><p>${esc(h.description)}</p><div class="meta"><span>◉ Story & discovery</span><span>↗ Play at your pace</span></div><div class="card-bottom"><button data-demo="${h.id}">${saved.completed.length?'Resume demo':'Try the demo'} →</button><button class="quiet" data-field="${h.id}">${field.completed.length?'Resume field hunt':'Play in the field'}</button></div><p class="fine" style="min-height:0;margin-bottom:0">${problems.length?'Field setup needed · demo is ready to explore.':'Field setup complete · organizer route check still required.'}</p></div></article>`;
  }).join('')}</div></section><div class="strip"><div><strong>A little preparation. A lot of discovery.</strong><p>Try a demo from your couch, or bring a configured adventure into the real world. No account needed.</p></div><button id="restore-home" class="quiet">Restore / reset progress</button></div>`;
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
  updateMissionPalette(s);
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
  if(s?.type==='nodes'&&state.timer)startSweepUpdates();
  updateCheckpointProximity();
}
function updateMissionPalette(stage){
  const root=document.documentElement;
  let color='#102b29';
  delete root.dataset.palette;
  root.style.removeProperty('--agency-background');
  if(hunt?.id==='howell'){
    if(stage?.interfaceMode==='override'){
      root.dataset.palette='override';
      color='#020403';
    }else{
      root.dataset.palette='agency';
      const opening=!stage||stage.id==='treasure';
      color=howellMissionBackgrounds[opening?0:Math.min(state.completed.length,howellMissionBackgrounds.length-1)];
      root.style.setProperty('--agency-background',color);
    }
  }
  document.querySelector('meta[name="theme-color"]').content=color;
}
function openAdventureTool(tool,section){
  tab=tool;
  renderGame();
  $(section)?.scrollIntoView({block:'start',behavior:'instant'});
}
function renderMission(){
  clearMap();
  const s=stage();const view=$('#view');
  const previous=hunt.stages[state.completed.length-1];
  const recovery=previous?.passphraseFragment
    ? ' <span>Passphrase fragment saved to your Journal.</span> <button id="open-earned-fragment" class="quiet">View fragments</button>'
    : previous?.artifact?` <span>Recovered: ${esc(previous.artifact)}</span>`:'';
  const confirmation=previous?`<div class="mission-confirmation" id="mission-confirmation" role="status" tabindex="-1"><strong>Checkpoint complete · ${esc(previous.title)}</strong>${previous.completionMessage?` <span>${esc(previous.completionMessage)}</span>`:''}${recovery}</div>`:'';
  if(!s){view.innerHTML=`${confirmation}<section class="panel narrow"><span class="eyebrow">THE STORY IS YOURS NOW</span><h2 style="margin-top:15px">${hunt.id==='howell'?'Agency restored. Treasure recovered.':'A treasure worthy of a captain.'}</h2><p>You followed every clue and completed ${hunt.stages.length} checkpoints. Your discoveries are saved in the journal.</p><button id="victory-journal">Open your journal →</button></section>`;on('#victory-journal','click',()=>{tab='journal';renderGame();});return;}
  const hintCount=state.hints[s.id]||0;
  view.innerHTML=`${confirmation}<section class="panel narrow"><span class="eyebrow">${esc(s.narrator??hunt.narrator)} / FIELD TRANSMISSION</span><h2 style="margin-top:12px">${esc(s.title)}</h2><p class="briefing">${esc(s.text)}</p><audio id="briefing-audio" controls preload="none" aria-label="${esc(s.title)} narration" ${s.audio?`src="${esc(s.audio)}"`:'hidden'}></audio><button id="speak" class="quiet">Read aloud</button><div id="challenge" class="objective"></div><details><summary>Need a nudge? (${hintCount}/${s.hints.length} hints revealed)</summary><div>${s.hints.slice(0,hintCount).map(h=>`<p class="hint">${esc(h)}</p>`).join('')}</div>${hintCount<s.hints.length?'<button id="hint" class="quiet">Reveal next hint</button>':''}</details></section>`;
  bindMissionNarration(s);
  on('#open-earned-fragment','click',()=>openAdventureTool('journal','#passphrase-fragments'));
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
  if(s.coolingNode&&state.cooling){renderCoolingChallenge(challenge);return;}
  if(s.type==='geo_signal'&&state.scanComplete===s.id){renderAreaScan(challenge,s);return;}
  if(s.type==='continue'){challenge.innerHTML='<button id="continue" class="mission-action">Continue the mission →</button>';on('#continue','click',complete);}
  if(['geo_quiz','geo_scan','geo_signal','nodes'].includes(s.type))renderLocation(challenge,s);
  else if(s.type==='scan'){
    renderScan(challenge,s);
    if(state.mode==='field'&&s.mapLocation&&coordinates(checkpointPoint(s))){
      challenge.insertAdjacentHTML('afterbegin','<p id="gps-status" role="status"></p><button id="briefing-gps" class="quiet">Enable arrival alerts</button>');
      on('#briefing-gps','click',requestLocation);
      updateLocationUI();
    }
  }
  else if(s.type==='audio'){
    challenge.innerHTML=`<h3>Find the shutdown passphrase</h3>
      <p>Read the fragments in order in your Journal, or decode the repeating Agency signal in CipherWave. Enter the passphrase here when you have it.</p>
      <div class="row"><button id="open-counter-journal" class="mission-action">Open Journal</button><button id="open-cipher" class="mission-action">Open CipherWave</button></div>
      <form id="phrase-form"><label for="phrase">Shutdown passphrase</label><input id="phrase" maxlength="120" autocomplete="off" required><button class="mission-action" style="margin-top:12px">Break the override →</button></form>`;
    on('#open-counter-journal','click',()=>openAdventureTool('journal','#passphrase-fragments'));
    on('#open-cipher','click',()=>openAdventureTool('kit','#cipherwave'));
    on('#phrase-form','submit',e=>{e.preventDefault();if(normalize($('#phrase').value)===normalize(answerFor(s)))complete();else notify('That phrase did not break the override. Check your Journal fragments or the decoded Agency signal.');});
  }
}
function isArrived(s){return state.mode==='demo'?demoArrived:withinRange(position,settings[hunt.id].locations[s.location],settings[hunt.id].arrivalRadiusMeters);}
function checkpointPoint(stage){return settings[hunt.id].locations[stage.location??stage.mapLocation];}
function vicinityRadius(arrivalRadius){return Math.max(45,arrivalRadius*3);}
function unlockGameAudio(){
  const AudioContext=window.AudioContext||window.webkitAudioContext;
  if(!AudioContext)return;
  try{
    gameAudio??=new AudioContext();
    if(gameAudio.state==='suspended'||gameAudio.state==='interrupted')return gameAudio.resume().catch(()=>{});
  }catch{/* The game also gives visual feedback. */}
}
function playGameTone(frequency,{offset=0,length=0.28,level=0.1,type='sine'}={}){
  if(document.hidden||gameAudio?.state!=='running')return false;
  const start=gameAudio.currentTime+0.02+offset;
  const tone=gameAudio.createOscillator();
  const volume=gameAudio.createGain();
  tone.type=type;
  tone.frequency.value=frequency;
  volume.gain.setValueAtTime(0.001,start);
  volume.gain.exponentialRampToValueAtTime(level,start+Math.min(0.035,length/4));
  volume.gain.exponentialRampToValueAtTime(0.001,start+length-0.01);
  tone.connect(volume).connect(gameAudio.destination);
  tone.start(start);
  tone.stop(start+length);
  return true;
}
function playCheckpointChime(arrived){
  const notes=arrived?[659.25,783.99,1046.5]:[523.25,659.25];
  notes.forEach((frequency,i)=>playGameTone(frequency,{offset:i*0.13,level:arrived?0.16:0.07}));
}
function playSensorChime(){
  const play=()=>[587.33,880,1174.66].forEach((frequency,i)=>
    playGameTone(frequency,{offset:i*0.09,length:i===2?0.42:0.23,level:0.12,type:'triangle'}));
  const unlocked=unlockGameAudio();
  if(unlocked)unlocked.then(play);else play();
}
function playSweepBuzzer(){
  playGameTone(146.83,{length:0.23,level:0.12,type:'sawtooth'});
  playGameTone(110,{offset:0.28,length:0.40,level:0.12,type:'sawtooth'});
}
function updateCheckpointProximity(){
  const current=stage();
  if(state?.mode!=='field'||!current||!position)return;
  const point=checkpointPoint(current);
  if(!coordinates(point))return;
  if(checkpointProximity?.save!==state||checkpointProximity.stage!==current.id){
    checkpointProximity={save:state,stage:current.id,near:false,arrived:false};
  }
  const radius=settings[hunt.id].arrivalRadiusMeters;
  const place=current.mapLabel?.split(' · ')[0]??current.title;
  if(withinRange(position,point,radius)){
    if(checkpointProximity.arrived||modal.open||arrivalAlert.open)return;
    checkpointProximity.near=true;
    checkpointProximity.arrived=true;
    $('#arrival-title').textContent=`You have arrived at ${place}`;
    arrivalAlert.showModal();
    playCheckpointChime(true);
  }else if(!checkpointProximity.near&&withinRange(position,point,vicinityRadius(radius))){
    checkpointProximity.near=true;
    playCheckpointChime(false);
    notify(`You’re near ${place}. Keep heading toward the map pin.`);
  }
}
function bindMissionNarration(stage){
  const button=$('#speak');
  const recording=$('#briefing-audio');
  const synth=window.speechSynthesis;
  const profile=source.ttsProfiles?.[stage.ttsProfile];
  let utterance=null;
  let startTimer;
  let starting=false;
  let request=0;
  const setPlaying=active=>{button.textContent=active?'Stop reading':'Read aloud';};
  const unavailable=()=>notify('Narration couldn’t play. You can read the full briefing on screen.');

  function clearSpeech(){
    clearTimeout(startTimer);
    if(!utterance)return;
    utterance=null;
    synth.cancel();
  }
  function stop(){
    request++;
    starting=false;
    clearSpeech();
    recording.pause();
    if(recording.readyState>0)recording.currentTime=0;
    setPlaying(false);
  }
  stopMissionNarration=stop;

  function speakOnDevice(){
    if(!synth||!window.SpeechSynthesisUtterance){setPlaying(false);unavailable();return;}
    const speech=new window.SpeechSynthesisUtterance($('.briefing').textContent);
    const voices=synth.getVoices();
    speech.voice=voices.find(voice=>profile?.voiceHint&&voice.name.includes(profile.voiceHint))
      ??voices.find(voice=>voice.lang.startsWith('en')&&voice.localService)
      ??null;
    speech.lang=speech.voice?.lang??'en-US';
    speech.rate=profile?.rate??0.94;
    speech.pitch=profile?.pitch??1;
    const fail=()=>{
      if(utterance!==speech)return;
      clearSpeech();
      setPlaying(false);
      unavailable();
    };
    speech.onstart=()=>clearTimeout(startTimer);
    speech.onend=()=>{
      if(utterance!==speech)return;
      clearTimeout(startTimer);
      utterance=null;
      setPlaying(false);
    };
    speech.onerror=fail;
    utterance=speech;
    setPlaying(true);
    startTimer=setTimeout(fail,5000);
    try{
      if(synth.paused)synth.resume();
      synth.speak(speech);
    }catch{fail();}
  }

  recording.addEventListener('play',()=>{
    if(recording.paused)return;
    clearSpeech();
    $('#challenge audio')?.pause();
    setPlaying(true);
  });
  for(const event of ['pause','ended']){
    recording.addEventListener(event,()=>{if(!utterance&&!starting)setPlaying(false);});
  }
  button.onclick=async()=>{
    if(starting||utterance||!recording.paused){stop();return;}
    $('#challenge audio')?.pause();
    if(!recording.hasAttribute('src')){speakOnDevice();return;}
    const attempt=++request;
    starting=true;
    setPlaying(true);
    try{
      await recording.play();
    }catch{
      if(attempt===request&&button.isConnected)speakOnDevice();
    }finally{
      if(attempt===request)starting=false;
    }
  };
}
function renderLocation(container,s){
  const sweepGuide=s.type==='nodes'?`<h3>How to run the sweep</h3>
    <ol class="sweep-instructions">
      <li>Find gray pins 1 (Alpha), 2 (Bravo), and 3 (Charlie) on the sensor map.</li>
      <li>Walk to each pin. When you’re close enough, tap <strong>Activate sensor</strong> for that location.</li>
      <li>Activate all three in any order before time runs out to initiate the sequence.</li>
    </ol>${state.mode==='demo'?'<p class="fine">In the demo, you can activate all three right here.</p>':''}
    ${failedSweep?.save===state?`<p id="sweep-retry" class="banner" role="status" tabindex="-1"><strong>Time’s up.</strong> ${failedSweep.activated} of ${sweepSensors.length} sensors activated. Regroup at the pool checkpoint, then tap Begin sensor sweep to try again.</p>`:''}
    <button id="toggle-sensor-map" class="mission-action" aria-expanded="false" aria-controls="sensor-map-panel">Open sensor map</button>
    <div id="sensor-map-panel" hidden></div>`:'';
  container.innerHTML=`<h3>Reach the checkpoint</h3><p class="fine">${state.mode==='demo'?'Use the arrival simulator to explore this stage.':'GPS confirms arrival before the challenge opens. Stay on the approved route.'}</p><p id="gps-status" role="status"></p><div class="row"><button id="gps" class="mission-action">${state.mode==='demo'?'Simulate arrival':'Enable location'}</button><button id="stop-gps" class="text-button" ${state.mode==='demo'?'hidden':''}>Stop location</button></div>${sweepGuide}<div id="arrived-challenge"></div>`;
  on('#toggle-sensor-map','click',toggleSensorMap);
  on('#gps','click',()=>{if(state.mode==='demo'){demoArrived=true;updateLocationUI();}else requestLocation();});on('#stop-gps','click',()=>{stopLocation();updateLocationUI();});updateLocationUI();
}
function updateLocationUI(){
  const s=stage();if(!s)return;
  const status=$('#gps-status');
  if(status){
    if(state.mode==='demo')status.textContent=demoArrived?'Simulated arrival confirmed.':'No GPS used in demo mode.';
    else if(!position)status.textContent=watch!==null?'Finding your location…':'Location is off. Enable it when ready.';
    else{
      const target=checkpointPoint(s), radius=settings[hunt.id].arrivalRadiusMeters;
      const detail=Date.now()-position.at>=20000?'Waiting for a fresh fix':
        withinRange(position,target,radius)?'Arrival confirmed':
        withinRange(position,target,vicinityRadius(radius))?'Nearby · Keep heading toward the pin':
        'Move closer or wait for a more accurate fix';
      status.textContent=`${coordinates(target)?Math.round(distance(position,target)*1.09361)+' yd to checkpoint · ':''}GPS accuracy ±${Math.round(position.accuracy*1.09361)} yd · ${detail}`;
    }
  }
  const container=$('#arrived-challenge');if(!container)return;
  if(s.type==='nodes'&&state.timer){if(!container.firstChild)renderNodes(container,s);return;}
  if(s.type==='geo_signal'&&container.dataset.scanStarted)return;
  if(!isArrived(s)){container.innerHTML='';return;}
  if(container.firstChild)return;
  if(s.type==='geo_quiz'){
    container.innerHTML=`<h3 style="margin-top:25px">${esc(s.question)}</h3>${state.mode==='demo'?`<p class="fine">Demo answer: ${esc(answerFor(s))}</p>`:''}<div class="choices">${s.options.map((option,i)=>`<button class="mission-action" data-answer="${i}">${esc(option)}</button>`).join('')}</div>`;
    container.querySelectorAll('[data-answer]').forEach(b=>b.onclick=()=>{
      if(!isArrived(s)){updateLocationUI();notify('A fresh location fix within range is needed.');return;}
      if(normalize(s.options[Number(b.dataset.answer)])!==normalize(answerFor(s))){
        notify('Take another look at the landmark and try again.');
        return;
      }
      if(!s.coolingNode){complete();return;}
      state.cooling={stage:s.id,phase:'locate'};
      save();
      renderCoolingChallenge($('#challenge'),true);
    });
  }else if(s.type==='geo_scan')renderScan(container,s);
  else if(s.type==='geo_signal')renderAreaScan(container,s);
  else if(s.type==='nodes')renderNodes(container,s);
}
function coolingNextMission(){
  return 'Continue to '+hunt.stages[state.completed.length+1].title+' →';
}
function renderCoolingChallenge(container,focus=false){
  const cooled=state.cooling.phase==='cooled';
  container.innerHTML=cooled
    ? `<h3 tabindex="-1">Cooling complete. Well done, agents!</h3><p>Mega AI Chip 01 is stable at 80°F. Continue when your team is ready.</p><button id="cooling-continue" class="mission-action">${esc(coolingNextMission())}</button>`
    : '<h3 tabindex="-1">Correct! Heat signature unlocked.</h3><p>Open the Heat Scanner and look for Mega AI Chip 01. When you find its heat signature, tap <strong>Initiate cooling procedure</strong>.</p><button id="cooling-scanner" class="mission-action">Open Heat Scanner</button>';
  on('#cooling-scanner','click',showHeatScanner);
  on('#cooling-continue','click',complete);
  if(focus)container.querySelector('h3').focus();
}
function renderAreaScan(container,s){
  container.innerHTML=`<div class="row">
    <button id="perform-scan" class="mission-action">Perform scan</button>
    <button id="stop-area-scan" class="quiet" hidden>Stop scan</button>
    <button id="continue-area-scan" class="mission-action" hidden>Continue the mission →</button>
  </div>
  <svg class="scan-waveform" viewBox="0 0 320 72" preserveAspectRatio="none" aria-hidden="true">
    <path d="M0 36 H320" vector-effect="non-scaling-stroke"></path>
  </svg>
  <audio hidden></audio><p role="status"></p>`;
  const button=container.querySelector('#perform-scan');
  const stop=container.querySelector('#stop-area-scan');
  const next=container.querySelector('#continue-area-scan');
  const audio=container.querySelector('audio');
  const status=container.querySelector('[role="status"]');
  const waveform=container.querySelector('.scan-waveform path');
  const reduceMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  const briefing=$('.briefing');
  let playing=false;
  let playbackAttempt=0;
  let waveformFrame;
  briefing.setAttribute('aria-live','polite');

  function drawWaveform(){
    if(!playing||!audio.isConnected)return;
    const time=reduceMotion.matches?0:audio.currentTime;
    let trace='M0 36';
    for(let x=4;x<=320;x+=4){
      const amplitude=Math.sin(Math.PI*x/320)*(13+8*Math.sin(x/34-time*5));
      const y=36+amplitude*Math.sin(x/8-time*14);
      trace+=` L${x} ${y.toFixed(1)}`;
    }
    waveform.setAttribute('d',trace);
    if(!reduceMotion.matches)waveformFrame=requestAnimationFrame(drawWaveform);
  }
  function showResult(){
    stopMissionNarration?.();
    briefing.textContent=s.result;
    const narration=$('#briefing-audio');
    narration.src=s.resultAudio;
    narration.hidden=false;
    button.textContent='Perform scan again';
    button.classList.replace('mission-action','quiet');
    next.hidden=false;
  }
  function finishPlayback(message){
    playbackAttempt++;
    playing=false;
    button.disabled=false;
    stop.hidden=true;
    cancelAnimationFrame(waveformFrame);
    waveform.setAttribute('d','M0 36 H320');
    status.textContent=message;
  }
  if(state.scanComplete===s.id){
    showResult();
    status.textContent='Scan complete. You can replay it or continue the mission.';
  }

  audio.addEventListener('playing',()=>{
    cancelAnimationFrame(waveformFrame);
    drawWaveform();
  });
  audio.addEventListener('ended',()=>{
    if(!audio.isConnected||!playing||!audio.ended)return;
    if(state.scanComplete!==s.id){
      state.scanComplete=s.id;
      save();
      showResult();
    }
    finishPlayback('Scan complete. You can replay it or continue the mission.');
  });
  audio.addEventListener('pause',()=>{
    if(!audio.ended&&audio.isConnected&&playing)finishPlayback(state.scanComplete===s.id
      ?'Replay paused. You can replay it or continue the mission.'
      :'Scan paused. Tap Perform scan to resume.');
  });
  stop.onclick=()=>{
    finishPlayback('Replay stopped. You can replay it or continue the mission.');
    audio.pause();
    audio.currentTime=0;
    button.focus();
  };
  next.onclick=()=>{
    if(state.scanComplete!==s.id)return;
    finishPlayback('');
    audio.pause();
    complete();
  };
  button.onclick=async()=>{
    const replay=state.scanComplete===s.id;
    if(!replay&&!container.dataset.scanStarted&&!isArrived(s)){updateLocationUI();return;}
    stopMissionNarration?.();
    const attempt=++playbackAttempt;
    playing=true;
    button.disabled=true;
    stop.hidden=!replay;
    status.textContent=replay?'Replaying the scan…':'Scanning…';
    container.dataset.scanStarted='true';
    try{
      if(!audio.src){
        const {samples,sampleRate}=encodeSignal(s.signal);
        const url=URL.createObjectURL(new Blob([wavBytes(samples,sampleRate)],{type:'audio/wav'}));
        resources.push(url);
        audio.src=url;
      }
      if(replay)audio.currentTime=0;
      await audio.play();
    }catch{
      if(!audio.isConnected||attempt!==playbackAttempt)return;
      finishPlayback(replay?'The replay could not play. You can try again or continue the mission.'
        :'The scan audio could not play. Tap Perform scan to try again.');
    }
  };
}
function requestLocation(){
  if(!window.isSecureContext){notify('Phone GPS requires HTTPS. Use the GitHub Pages address; localhost works only on this computer.');return;}
  if(!navigator.geolocation){notify('This browser does not support location. Ask the organizer for a manual checkpoint override.');return;}
  unlockGameAudio();
  if(watch!==null)return;
  watch=navigator.geolocation.watchPosition(p=>{position={lat:p.coords.latitude,lng:p.coords.longitude,accuracy:p.coords.accuracy,at:p.timestamp};updateLocationUI();updateNodeUI();updateMapPosition();updateCheckpointProximity();},error=>{const messages={1:'Location denied. Allow location in your browser settings, then try again.',2:'Location unavailable. Move into an open area and try again.',3:'Location timed out. Try again outdoors.'};notify(messages[error.code]||error.message);stopLocation();updateLocationUI();},{enableHighAccuracy:true,maximumAge:0,timeout:20000});
  updateLocationUI();
}
function renderScan(container,s){
  container.innerHTML=`<h3 style="margin-top:20px">Find the access marker</h3><p>Scan the QR with your phone’s camera, tap the NFC tag, or enter the printed code below.</p><form id="unlock-form"><label for="unlock">Marker code or full unlock URL</label><input id="unlock" autocomplete="off" required><button class="mission-action" style="margin-top:12px">Unlock checkpoint →</button></form><button id="camera" class="mission-action" style="margin-top:12px">Scan with this browser</button>${state.mode==='demo'?`<p class="fine">Demo marker: <code>${esc(s.token)}</code></p><button id="demo-scan" class="mission-action">Simulate marker scan</button>`:''}`;
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
  if(!state.timer){
    container.innerHTML=`<p>${untimed?'The organizer has disabled the timer.':`You’ll have ${seconds} seconds once you tap Begin sensor sweep.`}</p><button id="begin-sweep" class="mission-action">Begin sensor sweep</button>`;
    on('#begin-sweep','click',()=>{
      if(!isArrived(s)){notify('Confirm arrival before beginning the sweep.');return;}
      failedSweep=null;
      $('#sweep-retry')?.remove();
      state.timer={deadline:Date.now()+seconds*1000,captured:[]};
      save();
      renderNodes(container,s);
      startSweepUpdates();
    });
    return;
  }
  container.innerHTML=`<p class="timer" id="countdown" role="timer"></p><p class="fine">${untimed?'The organizer has disabled the timer.':'The timer keeps running while you check the map.'}</p>${sweepSensors.map(([id,label],i)=>`<div class="node" id="node-${id}"><div><strong>${i+1}. ${label}</strong><p class="fine" id="distance-${id}"></p></div><button class="mission-action" data-capture="${id}">Activate sensor</button></div>`).join('')}<button id="restart-sweep" class="quiet">Restart sweep</button>`;
  container.querySelectorAll('[data-capture]').forEach(b=>b.onclick=()=>{
    const id=b.dataset.capture;if(!state.timer)return;if(!untimed&&Date.now()>=state.timer.deadline){updateNodeUI();return;}
    if(state.mode!=='demo'&&!withinRange(position,settings.howell.locations[id],settings.howell.captureRadiusMeters)){notify('Move within range and wait for a fresh, accurate GPS fix.');return;}
    if(state.timer.captured.includes(id))return;
    state.timer.captured.push(id);
    playSensorChime();
    if(state.timer.captured.length===sweepSensors.length){complete();return;}
    save();
    updateNodeUI();
  });
  on('#restart-sweep','click',()=>{state.timer=null;save();stopSweepUpdates();renderNodes(container,s);});
}
function startSweepUpdates(){
  unlockGameAudio();
  if(timerTick===null)timerTick=setInterval(()=>{updateLocationUI();updateNodeUI();},250);
  updateNodeUI();
}
function stopSweepUpdates(){
  clearInterval(timerTick);
  timerTick=null;
}
function updateNodeUI(){
  const timer=state?.timer;
  if(!timer||stage()?.type!=='nodes')return;
  const remaining=Math.max(0,Math.ceil((timer.deadline-Date.now())/1000));
  if(!untimed&&remaining===0){
    failedSweep={save:state,activated:timer.captured.length};
    state.timer=null;
    save();
    stopSweepUpdates();
    playSweepBuzzer();
    if(tab==='mission'){
      renderMission();
      $('#sweep-retry')?.focus();
    }else{
      notify('Time’s up. Return to Mission to restart the sensor sweep.');
    }
    return;
  }
  const finalSeconds=!untimed&&remaining<=30;
  if(finalSeconds&&(lastSweepTick?.timer!==timer||lastSweepTick.remaining!==remaining)){
    const ticked=playGameTone(remaining%2?1050:810,{length:0.055,level:0.048,type:'triangle'});
    if(ticked)lastSweepTick={timer,remaining};
  }
  const countdown=$('#countdown');
  if(!countdown)return;
  countdown.textContent=untimed?'UNTIMED':`${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,'0')}`;
  countdown.classList.toggle('sweep-countdown-urgent',finalSeconds);
  for(const [id] of sweepSensors){const captured=state.timer.captured.includes(id), target=settings.howell.locations[id];const b=$(`[data-capture="${id}"]`);if(!b)continue;
    const inRange=state.mode==='demo'||withinRange(position,target,settings.howell.captureRadiusMeters);
    b.disabled=captured||!inRange;b.textContent=captured?'Activated ✓':'Activate sensor';$('#node-'+id).classList.toggle('captured',captured);$('#distance-'+id).textContent=captured?'Sensor activated.':state.mode==='demo'||inRange?'Ready to activate.':position&&coordinates(target)?`${Math.round(distance(position,target)*1.09361)} yd away · Move closer or wait for a better GPS fix.`:'Enable location to find this sensor.';
  }
}
function createFieldMap(id){
  const fieldMap=L.map(id);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'}).addTo(fieldMap);
  return fieldMap;
}
function addNamedPins(fieldMap,places){
  const pins=places.map(({label,number,point,classes},index)=>{
    const icon=offset=>L.divIcon({
      className:'',
      html:`<div class="pin ${classes}">${number??''}</div>`,
      iconSize:[24,24],
      iconAnchor:[12-offset.x,12-offset.y],
      popupAnchor:[offset.x,offset.y-12]
    });
    const marker=L.marker(point,{title:label,icon:icon(L.point(0,0)),zIndexOffset:250}).addTo(fieldMap).bindPopup(esc(label));
    const leader=L.polyline([],{color:'#59616b',weight:1,interactive:false}).addTo(fieldMap);
    return {marker,icon,leader,point,index};
  });
  function layoutPins(){
    const groups=[];
    for(const pin of pins){
      const pixel=fieldMap.latLngToLayerPoint(pin.point);
      const neighbors=groups.filter(group=>group.some(other=>pixel.distanceTo(other.pixel)<28));
      const group=[{...pin,pixel},...neighbors.flat()];
      for(const neighbor of neighbors)groups.splice(groups.indexOf(neighbor),1);
      groups.push(group);
    }
    for(const group of groups){
      group.sort((a,b)=>a.index-b.index);
      const center=group.reduce((sum,pin)=>sum.add(pin.pixel),L.point(0,0)).divideBy(group.length);
      const columns=Math.ceil(Math.sqrt(group.length));
      const rows=Math.ceil(group.length/columns);
      // Spread overlapping pins at route zoom and draw lines to their real locations.
      group.forEach(({marker,icon,leader,point,pixel},i)=>{
        const row=Math.floor(i/columns);
        const rowLength=Math.min(columns,group.length-row*columns);
        const display=center.add(L.point((i%columns-(rowLength-1)/2)*30,(row-(rows-1)/2)*30));
        const offset=display.subtract(pixel);
        marker.setIcon(icon(offset));
        leader.setLatLngs(group.length>1?[point,fieldMap.layerPointToLatLng(display)]:[]);
      });
    }
  }
  fieldMap.whenReady(layoutPins);
  fieldMap.on('zoomend',layoutPins);
}
function sweepMapPoints(){
  return sweepSensors.map(([id,label],i)=>({label,number:i+1,point:settings.howell.locations[id],classes:'sensor-pin'})).filter(({point})=>coordinates(point));
}
function addSensorRanges(fieldMap,sensors){
  for(const {point} of sensors)L.circle(point,{radius:settings.howell.captureRadiusMeters,color:'#747d88',weight:1}).addTo(fieldMap);
}
function toggleSensorMap(event){
  const button=event.currentTarget;
  const panel=$('#sensor-map-panel');
  const open=panel.hidden;
  panel.hidden=!open;
  button.textContent=open?'Hide sensor map':'Open sensor map';
  button.setAttribute('aria-expanded',String(open));
  if(!open){clearMap();panel.replaceChildren();return;}
  const sensors=sweepMapPoints();
  if(!sensors.length){panel.innerHTML='<p>The organizer hasn’t placed the sensor pins yet.</p>';return;}
  if(!window.L){
    panel.innerHTML=`<p>The map couldn’t load. Here are the sensor locations.</p><ul>${sensors.map(({label,number,point})=>`<li>${number}. ${label} · ${point.lat}, ${point.lng}</li>`).join('')}</ul>`;
    return;
  }
  panel.innerHTML='<div id="sensor-map" class="map sensor-map" aria-label="Map of Sensor Alpha, Bravo, and Charlie"></div>';
  map=createFieldMap('sensor-map');
  addNamedPins(map,sensors);
  addSensorRanges(map,sensors);
  map.fitBounds(sensors.map(({point})=>point),{padding:[40,48],maxZoom:18});
  updateMapPosition();
}
function renderMap(){
  const locations=settings[hunt.id].locations;
  const stops=hunt.stages.map((s,i)=>({s,i,label:s.mapLabel??s.title,point:locations[s.mapLocation??s.location]}));
  const entries=stops.filter(({point})=>coordinates(point));
  const sensors=hunt.id==='howell'?sweepMapPoints():[];
  const mapPoints=[...entries,...sensors].map(({point})=>point);
  $('#view').innerHTML=`<section class="panel"><h2>Your field map</h2><p class="fine">Red pins mark upcoming checkpoints. A pin turns blue when its checkpoint is complete. ${sensors.length?'Gray pins 1–3 are the sweep sensors. ':''}${coordinates(locations.snave)?'The house marks the SNAVE Estates briefing. ':''}${state.mode==='demo'?'This demo does not simulate real coordinates.':''}</p>${mapPoints.length?'<div id="map" class="map" aria-label="Adventure location map"></div>':'<div class="banner">No real route has been configured. Add coordinates in Organizer access → Setup. Demo challenges work without a map.</div>'}<div class="row" style="margin-top:16px"><button id="map-gps" class="quiet">Enable location</button><button id="map-stop" class="text-button">Stop location</button></div><p id="map-status" class="fine"></p><ul class="location-list">${stops.map(({i,label,point})=>`<li><span class="badge">${i<state.completed.length?'✓ COMPLETE':i===state.completed.length?'→ CURRENT':'LOCKED'}</span> ${esc(label)} ${coordinates(point)?`<small>· ${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}</small>`:''}</li>`).join('')}</ul></section>`;
  on('#map-gps','click',()=>{if(state.mode==='demo'){notify('GPS is disabled in demo mode. Use field mode after configuring the route.');return;}requestLocation();});on('#map-stop','click',()=>{stopLocation();updateMapPosition();});
  if(!mapPoints.length)return;
  if(!window.L){$('#map').innerHTML='<p style="padding:25px">The map library could not load. Check your connection. The checkpoint list below remains available.</p>';return;}
  map=createFieldMap('map');
  addNamedPins(map,[...entries.map(({s,i,label,point})=>({
    label,point,classes:`checkpoint-pin ${i<state.completed.length?'complete':'pending'} ${s.mapLocation==='snave'?'house-marker':''}`
  })),...sensors]);
  const current=entries.find(({s,i})=>s.location&&i===state.completed.length);
  if(current)L.circle(current.point,{radius:settings[hunt.id].arrivalRadiusMeters,color:'#b4283e',weight:1}).addTo(map);
  addSensorRanges(map,sensors);
  map.fitBounds(mapPoints,{padding:[40,48],maxZoom:17});updateMapPosition();
}
function updateMapPosition(){
  const status=$('#map-status');if(status)status.textContent=position?`Location active · accuracy ±${Math.round(position.accuracy*1.09361)} yd. Map tiles require internet.`:'Location is off. Map tiles require internet.';
  if(!map)return;mapMarkers.forEach(m=>m.remove());mapMarkers=[];if(position){mapMarkers.push(L.marker([position.lat,position.lng],{icon:L.divIcon({className:'',html:'<div class="pin player"></div>',iconSize:[16,16]})}).addTo(map).bindPopup('Your latest position'));mapMarkers.push(L.circle([position.lat,position.lng],{radius:position.accuracy,color:'#3881b5',weight:1}).addTo(map));}
}
function renderKit(){
  const shutdownMission=stage()?.id==='countermeasure';
  let agencyWav;
  const agencyRecording=()=>{
    if(!agencyWav){
      const {samples,sampleRate}=encodeRepeatedSignal(settings.howell.shutdownPhrase.trim());
      agencyWav=wavBytes(samples,sampleRate);
    }
    return agencyWav;
  };
  $('#view').innerHTML=`<div id="field-kit">
    <section class="panel">
      <h2>Heat Scanner</h2>
      <p>View your surroundings through a red camera filter.</p>
      <button id="open-heat-scanner" class="mission-action">Open Heat Scanner</button>
    </section>
    <section class="panel" id="cipherwave">
      <h2>CipherWave</h2>
      <p>Have you ever heard a robot talking or beeping? CipherWave can translate those sounds into a message.</p>
      ${shutdownMission?`<h3>Repeating Agency signal</h3><p>The recording sends the encoded passphrase twice. Press play to hear it, or decode it here.</p>
        <audio id="agency-signal-preview" controls preload="none" aria-label="Repeating CipherWave Agency signal"></audio>
        <div class="row"><button id="decode-agency-signal" class="mission-action">Decode Agency signal</button><button id="return-from-cipher" class="quiet">Return to shutdown mission</button></div>`:''}
      <div class="banner">Microphone reception is experimental. Start with a WAV upload. Record one complete message, including its opening low tone.</div>
      <label for="audio-file">Decode an audio file</label><input id="audio-file" type="file" accept="audio/*">
      <div class="row" style="margin-top:18px"><button id="record" class="quiet">Record microphone</button><button id="stop-record" class="quiet" disabled>Stop &amp; decode</button></div>
      <p id="record-status" class="fine">Recording stays on this device. Maximum recording: 60 seconds.</p>
      <pre id="decoded" aria-live="polite">Awaiting a signal…</pre>
      ${hunt.id==='howell'?'<button id="sample" class="quiet">Download Agency signal (.wav)</button><p class="fine">Organizer: play this signal on a separate device at the audio checkpoint. A file upload also works as a fallback.</p>':'<p class="fine">This adventure does not currently require an audio cipher.</p>'}
    </section>
    <section class="panel"><h3>Manage your progress</h3><p>Save a short code, download a backup with your notes, or start this game over.</p><button id="transfer" class="quiet">Export / restore progress</button></section>
  </div>`;
  const preview=$('#agency-signal-preview');
  if(preview){
    const url=URL.createObjectURL(new Blob([agencyRecording()],{type:'audio/wav'}));
    resources.push(url);
    preview.src=url;
  }
  on('#decode-agency-signal','click',safeRun(()=>{preview.pause();return decodeBlob(new Blob([agencyRecording()],{type:'audio/wav'}));}));
  on('#sample','click',safeRun(()=>download('agency-signal.wav',agencyRecording(),'audio/wav')));
  on('#return-from-cipher','click',()=>openAdventureTool('mission','#challenge'));
  on('#audio-file','change',safeRun(async e=>{const file=e.target.files[0];if(!file)return;if(file.size>25*1024*1024)throw Error('Choose an audio file smaller than 25 MB.');await decodeBlob(file);}));
  on('#record','click',safeRun(startRecording));on('#stop-record','click',()=>{if(recorder?.state==='recording')recorder.stop();});on('#transfer','click',showTransfer);
  on('#open-heat-scanner','click',showHeatScanner);
}
function showHeatScanner(){
  const cooling=state.cooling;
  const locate=cooling?.phase==='locate';
  const demoScan=locate&&state.mode==='demo';
  const chipState=()=>{
    if(hunt.id!=='howell'||stage()?.id==='processor')return 'hot';
    if(cooling?.phase==='cooled'||state.completed.includes('security'))return 'cooled';
    return cooling?'hot':'locked';
  };
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
    ${locate?'<button id="initiate-cooling" class="mission-action" hidden>Initiate cooling procedure</button>':''}
    ${demoScan?'<button id="demo-heat-signature" class="mission-action">Simulate heat signature</button>':''}
    ${cooling?`<div id="heat-cooling-complete" ${locate?'hidden':''}>
      <h3>Cooling complete. Well done, agents!</h3>
      <p>Mega AI Chip 01 is stable at 80°F. Continue when your team is ready.</p>
      <button id="heat-cooling-continue" class="mission-action">${esc(coolingNextMission())}</button>
    </div>`:''}
    <button id="start-heat-camera" class="mission-action">Start camera</button>`);

  const view=modalBody.querySelector('.heat-scanner-view');
  const video=view.querySelector('video');
  const status=$('#heat-scanner-status');
  const start=$('#start-heat-camera');
  const cool=$('#initiate-cooling');
  const simulate=$('#demo-heat-signature');
  let detectedChip=false;

  function updateDetection(message,isChip=false){
    detectedChip=isChip;
    if(cool)cool.hidden=!isChip||cooling.phase!=='locate';
    if(simulate)simulate.hidden=isChip||cooling.phase!=='locate';
    status.textContent=message;
  }

  if(simulate)simulate.onclick=()=>{
    stopHeatScanner?.();
    start.hidden=true;
    updateDetection('Mega AI Chip 01 detected · 200°F',true);
    cool.focus();
  };
  if(cool)cool.onclick=()=>{
    if(!modal.open||!detectedChip||cooling.phase!=='locate')return;
    cooling.phase='cooled';
    save();
    updateDetection('Mega AI Chip 01 detected · 80°F',true);
    $('#heat-cooling-complete').hidden=false;
    $('#heat-cooling-continue').focus();
    modal.addEventListener('close',()=>{
      const challenge=$('#challenge');
      if(challenge&&state?.cooling===cooling)renderCoolingChallenge(challenge,true);
    },{once:true});
  };
  on('#heat-cooling-continue','click',()=>{
    if(cooling.phase!=='cooled')return;
    modal.close();
    tab='mission';
    complete();
  });

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
      updateDetection(message);
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
      const liveMessage=()=>cooling?.phase==='locate'?'Camera live · Look for Mega AI Chip 01.':'Camera live';
      updateDetection(liveMessage());
      const updateTracking=(message,isChip)=>{
        if(tracking.signal.aborted)return;
        updateDetection(message===null?'Camera live · Image tracking unavailable.':message||liveMessage(),isChip);
      };
      import('./lib/heat-ar/hologram.js')
        .then(({startHeatTracking})=>startHeatTracking(video,view,tracking.signal,{chipState,onTracking:updateTracking}))
        .catch(()=>updateTracking(null));
    }catch(error){
      stop(error.name==='NotAllowedError'
        ? 'Preview only. Allow camera access in your browser, then try again.'
        : 'Preview only. The camera could not start.');
    }
  }

  start.addEventListener('click',startCamera);
  if(demoScan)status.textContent='Simulate the heat signature or start your camera to find the marker.';
  else startCamera();
}
async function decodeBlob(blob){
  const generation=uiGeneration,output=$('#decoded');if(output)output.textContent='Analyzing signal…';
  const AudioContext=window.AudioContext||window.webkitAudioContext;if(!AudioContext)throw Error('Audio processing is unavailable in this browser.');const context=new AudioContext();
  try{const buffer=await context.decodeAudioData(await blob.arrayBuffer());if(buffer.duration>90)throw Error('Use an audio clip no longer than 90 seconds.');const mono=new Float32Array(buffer.length);for(let c=0;c<buffer.numberOfChannels;c++){const channel=buffer.getChannelData(c);for(let i=0;i<mono.length;i++)mono[i]+=channel[i]/buffer.numberOfChannels;}await new Promise(r=>setTimeout(r,25));const message=decodeSignal(mono,buffer.sampleRate);if(generation===uiGeneration&&output)output.textContent=message;}catch(error){if(generation===uiGeneration&&output)output.textContent=error.message;throw error;}finally{await context.close();}
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
  const fragments=hunt.stages.filter(item=>item.passphraseFragment);
  const earned=fragments.filter(item=>state.completed.includes(item.id));
  const allEarned=earned.length===fragments.length;
  const fragmentPanel=fragments.length?`<section id="passphrase-fragments" class="panel narrow">
    <h2>Shutdown passphrase</h2>
    <p>${earned.length} of ${fragments.length} fragments recovered. Collect them at the checkpoints below and read them in order.</p>
    <ol class="fragment-list">${fragments.map(item=>`<li><strong>${esc(item.mapLabel?.split(' · ')[0]??item.title)}</strong>
      ${state.completed.includes(item.id)?`<code>${esc(item.passphraseFragment)}</code>`:'<span class="fine">Complete this checkpoint to recover its fragment.</span>'}</li>`).join('')}</ol>
    ${allEarned?`<p>Assembled passphrase</p><pre id="assembled-passphrase">${esc(earned.map(item=>item.passphraseFragment).join(' '))}</pre>`:''}
    ${stage()?.id==='countermeasure'?'<button id="return-from-journal" class="mission-action">Return to shutdown mission</button>':''}
  </section>`:'';
  $('#view').innerHTML=`${fragmentPanel}<section class="panel narrow"><h2>Your discoveries</h2>${state.completed.length?state.completed.map(id=>{const s=hunt.stages.find(s=>s.id===id);return `<article class="journal-entry"><span class="badge">${esc(s.artifact||'Checkpoint complete')}</span><h3 style="margin-top:12px">${esc(s.title)}</h3><p>${esc(s.text)}</p></article>`;}).join(''):'<p>Your first discovery is waiting. Complete a checkpoint to begin your journal.</p>'}</section><section class="panel narrow"><h3>Field notes</h3>${state.notes.map(n=>`<p>${esc(n.text)}<br><small>${new Date(n.at).toLocaleString()}</small></p>`).join('')}<form id="note-form"><label for="note">Add a note</label><textarea id="note" maxlength="3000" required></textarea><button style="margin-top:12px">Save note</button></form><label for="photo">Add a local photo (up to 8 MB)</label><input id="photo" type="file" accept="image/*"><p class="fine">Photos are journal memories, not checkpoint triggers. Export photos individually before clearing browser data.</p><div id="photos"></div></section>`;
  on('#return-from-journal','click',()=>openAdventureTool('mission','#challenge'));
  on('#note-form','submit',e=>{e.preventDefault();if(state.notes.length>=200){notify('This journal already has 200 notes.');return;}const text=$('#note').value.trim();if(!text)return;state.notes.push({text,at:Date.now()});save();renderGame();});
  on('#photo','change',safeRun(async e=>{const file=e.target.files[0];if(file){await addPhoto(stateKey(),file);renderGame();}}));
  try{const photos=await photosFor(stateKey());if(generation!==uiGeneration)return;$('#photos').innerHTML=photos.map(p=>{const url=URL.createObjectURL(p.blob);resources.push(url);return `<div class="journal-entry"><img class="note-photo" src="${url}" alt="Field journal photo"><div class="row"><a href="${url}" download="field-photo.jpg">Download photo</a><button class="text-button" data-delete-photo="${p.id}">Delete photo</button></div></div>`;}).join('');document.querySelectorAll('[data-delete-photo]').forEach(b=>b.onclick=safeRun(async()=>{await deletePhoto(b.dataset.deletePhoto);renderGame();}));}catch{if(generation===uiGeneration)$('#photos').textContent='Photo storage is unavailable in this browser. Text notes still work.';}
}
function showTransfer(){
  let resetOptions=state?[{owner:hunt,mode:state.mode}]:[];
  if(!state){
    try{
      resetOptions=hunts.flatMap(owner=>['demo','field'].filter(mode=>localStorage.getItem(storageKey(owner.id,mode))).map(mode=>({owner,mode})));
    }catch{/* Storage may be unavailable. */}
  }
  showModal(`<h2>Restore or reset progress</h2>
    <p>A 10-character code restores your checkpoints, hints, and active challenge. Use a full backup file to take your text notes with you.</p>
    ${state?`<label for="export-code">Your progress code</label><input id="export-code" readonly>
      <div class="row" style="margin-top:10px"><button id="copy-code" class="quiet">Copy code</button><button id="download-backup" class="quiet">Download full backup</button></div>`:''}
    <form id="restore-form">
      <label for="restore-code">Restore a progress code</label><input id="restore-code" required maxlength="200000" autocomplete="off" spellcheck="false">
      <div class="row" style="margin-top:12px"><button>Review restore</button><button type="button" id="import-backup" class="quiet">Open backup file</button></div>
    </form>
    <input type="file" id="backup-file" accept=".json,.txt" hidden>
    <div id="restore-review" role="status"></div>
    ${resetOptions.length?`<hr>
      ${state?'':`<label for="reset-save-choice">Saved adventure</label><select id="reset-save-choice">${resetOptions.map(({owner,mode},i)=>`<option value="${i}">${esc(owner.title)} · ${mode}</option>`).join('')}</select>`}
      <button id="reset-from-transfer" class="danger">Reset game</button>`:''}`);
  const review=$('#restore-review');
  if(state){
    $('#export-code').value=encodeShortProgress(state,hunts);
    on('#copy-code','click',async()=>{
      const code=$('#export-code');
      try{await navigator.clipboard.writeText(code.value);review.textContent='Progress code copied.';}
      catch{code.select();review.textContent='Copy the highlighted progress code.';}
    });
    on('#download-backup','click',()=>download('hidden-trails-backup.json',JSON.stringify(state)));
  }
  function reviewRestore(text,fromFile=false){
    const backup=fromFile&&text.startsWith('{');
    const shortCode=!backup&&!text.startsWith('HT1.');
    const restored=backup?validateState(JSON.parse(text),hunts):decodeProgress(text,hunts);
    const owner=hunts.find(h=>h.id===restored.hunt);
    review.innerHTML=`<p>Restore <strong>${esc(owner.title)}</strong> (${restored.mode}) with ${restored.completed.length} completed checkpoints? ${shortCode?'This replaces its gameplay progress and keeps its local text notes.':'This replaces its gameplay progress and text notes.'}</p><button id="confirm-restore">Replace save &amp; restore</button>`;
    on('#confirm-restore','click',()=>{
      if(shortCode)restored.notes=load(owner,restored.mode).notes;
      replaceProgress(owner,restored);
      if(state.mode==='field'&&settingsProblems(settings,hunt.id).length)notify('This device still needs the field route settings. Ask the organizer to load them before continuing.');
    });
  }
  on('#restore-form','submit',event=>{
    event.preventDefault();
    try{reviewRestore($('#restore-code').value.trim());}
    catch(error){review.textContent=error.message;}
  });
  on('#import-backup','click',()=>$('#backup-file').click());
  on('#backup-file','change',async event=>{
    const input=event.currentTarget,file=input.files[0];
    input.value='';
    if(!file)return;
    try{
      if(file.size>4000000)throw Error('Choose a backup file under 4 MB.');
      const text=await file.text();
      if(review.isConnected)reviewRestore(text.trim(),true);
    }catch(error){if(review.isConnected)review.textContent=error.message;}
  });
  on('#reset-from-transfer','click',()=>{
    const {owner,mode}=resetOptions[Number($('#reset-save-choice')?.value??0)];
    showResetConfirmation(owner,mode,showTransfer);
  });
}
function replaceProgress(owner,progress){
  cleanup();
  stopLocation();
  hunt=owner;state=progress;untimed=false;organizerOpen=false;demoArrived=false;tab='mission';
  const saved=save();
  modal.close();
  renderGame();
  $('.tabs')?.scrollIntoView({block:'start',behavior:'instant'});
  return saved;
}
function showResetConfirmation(owner,mode,back){
  showModal(`<h2>Reset this adventure?</h2>
    <p>Return to the first mission of <strong>${esc(owner.title)}</strong> (${mode}). This clears its progress and text notes. Journal photos stay on this device.</p>
    <div class="row"><button id="confirm-reset" class="danger">Reset this save</button><button id="cancel-reset" class="quiet">Cancel</button></div>`);
  on('#confirm-reset','click',()=>{
    if(replaceProgress(owner,freshState(owner.id,mode)))notify('Game reset. You’re back at the first mission.');
  });
  on('#cancel-reset','click',back);
  $('#cancel-reset').focus();
}
function showHelp(){showModal(`<h2>A field guide for curious minds</h2><p>Choose an adventure and follow its current mission. The demo uses simulated arrivals and markers. Field play needs an organizer-configured route and a phone with location enabled.</p><h3>Permissions & privacy</h3><p>Location checks happen on this device. Camera access is optional for QR scanning; your phone camera can open the same links. Microphone access is optional for CipherWave. Recordings are processed in memory and are not uploaded.</p><p>Progress and text notes are stored in this browser. Photos use local IndexedDB. Clearing browser data removes these saves. A short code transfers gameplay progress. Download a full backup to transfer your text notes, and save photos separately.</p><p>GitHub Pages serves the app. Fonts and the optional Leaflet map library load from external services; OpenStreetMap receives tile requests for the viewed area. This app has no analytics or game-data server. It needs a connection to load; offline play is not guaranteed.</p><h3>On the trail</h3><p>Walk, stay on approved paths, and look up from the screen. Children should play with an adult. The pool and processor are story locations: use organizer-prepared props in approved areas, away from water and real equipment. Never enter equipment enclosures or mix chemicals.</p><h3>Having trouble?</h3><p>GPS and microphone need HTTPS on a phone. A local Wi-Fi HTTP address does not provide that. If GPS is inaccurate, wait outdoors or ask the organizer for a checkpoint override. For QR trouble, enter the printed marker code.</p><p>Organizer access uses a convenience PIN, initially 1980. Because this is a static game, its answers and PIN are visible in the downloaded source.</p>`);}
function openOrganizer(){
  if(organizerOpen){renderOrganizer();return;}
  showModal('<h2>Organizer access</h2><p>Enter your four-digit organizer PIN. Hint: Saturday morning cartoons and Marty McFly’s decade.</p><form id="pin-form"><label for="pin">PIN</label><input id="pin" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" type="password" required><button style="margin-top:12px">Open organizer tools</button></form>');
  on('#pin-form','submit',e=>{e.preventDefault();if($('#pin').value===String(settings.organizerPin)){organizerOpen=true;renderOrganizer();}else notify('That PIN did not match.');});
}
function renderOrganizer(){
  showModal(`<h2>Organizer’s desk</h2><p class="fine">Controls change this device only. Download settings and include them in your deployment to configure every player’s device.</p><div class="row"><button id="setup" class="quiet">Setup & readiness</button><button id="markers" class="quiet">Printable marker links</button><button id="encoder" class="quiet">Audio encoder</button></div>${hunt?`<h3 style="margin-top:25px">${esc(hunt.title)} · ${state.mode}</h3><p>Manual controls are for route problems and supervised testing.</p><div class="row"><button id="skip" class="quiet" ${!stage()?'disabled':''}>Complete current checkpoint</button><button id="untimed" class="quiet">${untimed?'Enable':'Disable'} sensor timer</button><button id="reset" class="danger">Reset this adventure save</button></div><label for="jump">Jump to checkpoint (changes saved progress)</label><select id="jump">${hunt.stages.map((s,i)=>`<option value="${i}" ${i===state.completed.length?'selected':''}>${i+1}. ${esc(s.title)}</option>`).join('')}</select><button id="jump-go" class="quiet" style="margin:10px">Jump</button>`:'<p>Open an adventure to access checkpoint overrides and reset controls.</p>'}<p><button id="lock" class="text-button">Lock organizer tools</button></p>`);
  on('#setup','click',renderSetup);on('#markers','click',renderMarkers);on('#encoder','click',renderEncoder);
  on('#skip','click',()=>{modal.close();complete();});on('#untimed','click',()=>{untimed=!untimed;notify(untimed?'Sensor timer disabled for this session.':'Sensor timer enabled.');modal.close();renderGame();});
  on('#jump-go','click',()=>{const index=Number($('#jump').value);state.completed=hunt.stages.slice(0,index).map(s=>s.id);delete state.cooling;delete state.scanComplete;state.timer=null;demoArrived=false;save();modal.close();renderGame();});
  on('#reset','click',()=>showResetConfirmation(hunt,state.mode,renderOrganizer));on('#lock','click',()=>{organizerOpen=false;modal.close();});
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

