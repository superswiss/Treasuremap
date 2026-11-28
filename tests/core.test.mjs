import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHunts} from '../adventures/hunts.js';
import {freshState,encodeProgress,decodeProgress,distance,withinRange,settingsProblems} from '../lib/core.js';
import {encodeSignal,decodeSignal,wavBytes} from '../lib/cipher.js';
const settings=JSON.parse(await readFile(new URL('../content/hunt-settings.json',import.meta.url)));
const source=JSON.parse(await readFile(new URL('../content/steve-transmissions.json',import.meta.url)));
const hunts=createHunts(source,settings);
test('both adventures have a complete, unique sequence and use existing narration',async()=>{
  assert.equal(hunts[0].stages.length,9);assert.equal(hunts[1].stages.length,6);
  for(const hunt of hunts){assert.equal(new Set(hunt.stages.map(s=>s.id)).size,hunt.stages.length);for(const stage of hunt.stages){assert.ok(stage.text);assert.ok(stage.hints.length);if(stage.audio)await readFile(new URL('../'+stage.audio,import.meta.url));}}
});
test('progress preserves Unicode notes and timed captures; rejects tampering',()=>{
  const state=freshState('howell','demo');state.completed=['activation','security','lake','map'];state.notes=[{text:'A clue! 🗺️ café',at:Date.now()}];state.timer={deadline:Date.now()+10000,captured:['alpha']};
  assert.deepEqual(decodeProgress(encodeProgress(state),hunts),state);
  const oldSave={...state,completed:['activation','security','map']};
  assert.deepEqual(decodeProgress(encodeProgress(oldSave),hunts),state);
  assert.throws(()=>decodeProgress('HT1.garbage',hunts));
  assert.throws(()=>decodeProgress(encodeProgress({...state,completed:['treasure']}),hunts));
  assert.throws(()=>decodeProgress(encodeProgress({...state,timer:{deadline:1,captured:['delta']}}),hunts));
});
test('GPS checks require fresh, accurate fixes within configured range',()=>{
  const p={lat:28.6865,lng:-81.2443,at:100000,accuracy:8};
  assert.equal(distance(p,p),0);assert.ok(distance(p,{lat:p.lat+.001,lng:p.lng})>110);
  assert.ok(withinRange(p,p,18,100001));assert.equal(withinRange({...p,accuracy:40},p,18,100001),false);assert.equal(withinRange(p,p,18,121000),false);
});
test('unconfigured real routes stay blocked; fully configured routes pass',()=>{
  const incomplete=structuredClone(settings);for(const config of [incomplete.howell,incomplete.pirate])for(const key of Object.keys(config.locations))config.locations[key]=null;
  assert.ok(settingsProblems(incomplete,'howell').length);assert.ok(settingsProblems(incomplete,'pirate').length);
  const complete=structuredClone(settings);for(const config of [complete.howell,complete.pirate])for(const key of Object.keys(config.locations))config.locations[key]={lat:28.6,lng:-81.2};complete.howell.fenceAnswer='White';complete.howell.fizzAnswer='Blue';complete.pirate.clues=complete.pirate.clues.map(c=>({...c,question:'Which color?',options:['Red','Blue'],answer:'Red'}));
  assert.deepEqual(settingsProblems(complete,'howell'),[]);assert.deepEqual(settingsProblems(complete,'pirate'),[]);
});
test('custom phrase fragments and timer narration stay aligned with settings',()=>{
  const custom=structuredClone(settings);custom.howell.shutdownPhrase='FOLLOW THE HIDDEN TRAIL';custom.howell.sensorSeconds=60;
  const stages=createHunts(source,custom)[0].stages;
  const fragments=['security','sensors','processor'].map(id=>stages.find(s=>s.id===id).artifact).filter(a=>a.startsWith('Override fragment: ')).map(a=>a.slice('Override fragment: '.length)).join(' ');
  assert.equal(fragments,custom.howell.shutdownPhrase);assert.equal(stages.find(s=>s.id==='sensors').audio,null);assert.match(stages.find(s=>s.id==='sensors').text,/within 60 seconds/);
});
test('CipherWave round trips clean signals and non-grid leading silence',()=>{
  for(const message of ['TRUST YOUR TEAM','SOS 123!','A',hunts[0].stages.find(s=>s.id==='lake').signal]){
    const {samples,sampleRate}=encodeSignal(message);assert.equal(decodeSignal(samples,sampleRate),message);
    const shifted=new Float32Array(samples.length+Math.round(.373*sampleRate));shifted.set(samples,Math.round(.373*sampleRate));assert.equal(decodeSignal(shifted,sampleRate),message);
    const wav=new DataView(wavBytes(samples,sampleRate));assert.equal(wav.getUint32(24,true),sampleRate);assert.equal(wav.getUint32(40,true),samples.length*2);
  }
});
test('CipherWave rejects silence and supports moderate noise / gain changes',()=>{
  const {samples,sampleRate}=encodeSignal('HELLO AGENTS');let seed=7;
  const noisy=Float32Array.from(samples,s=>{seed=(seed*16807)%2147483647;return s*.55+(seed/2147483647-.5)*.025;});
  assert.equal(decodeSignal(noisy,sampleRate),'HELLO AGENTS');assert.throws(()=>decodeSignal(new Float32Array(sampleRate),sampleRate));assert.throws(()=>encodeSignal('🔒'));
});
