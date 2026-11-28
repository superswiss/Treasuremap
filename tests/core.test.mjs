import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHunts} from '../adventures/hunts.js';
import {freshState,encodeProgress,encodeShortProgress,decodeProgress,distance,withinRange,settingsProblems} from '../lib/core.js';
import {encodeSignal,encodeRepeatedSignal,decodeSignal,wavBytes} from '../lib/cipher.js';
const settings=JSON.parse(await readFile(new URL('../content/hunt-settings.json',import.meta.url)));
const source=JSON.parse(await readFile(new URL('../content/steve-transmissions.json',import.meta.url)));
const hunts=createHunts(source,settings);
test('both adventures have a complete, unique sequence and use existing narration',async()=>{
  assert.equal(hunts[0].stages.length,9);assert.equal(hunts[1].stages.length,6);
  for(const hunt of hunts){
    assert.equal(new Set(hunt.stages.map(s=>s.id)).size,hunt.stages.length);
    for(const stage of hunt.stages){
      assert.ok(stage.text);assert.ok(stage.hints.length);assert.ok(stage.audio);
      for(const track of [stage.audio,stage.resultAudio].filter(Boolean)){
        const wav=await readFile(new URL('../'+track,import.meta.url));
        assert.equal(wav.toString('ascii',0,4),'RIFF');
        assert.equal(wav.toString('ascii',8,12),'WAVE');
        assert.ok(wav.length>1000);
      }
      if(stage.result)assert.ok(stage.resultAudio);
    }
  }
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
test('Nosy T cooling phases survive progress transfers and belong to the current stage',()=>{
  const state={...freshState('howell','demo'),completed:['activation']};
  for(const phase of ['locate','cooled']){
    const progress={...state,cooling:{stage:'security',phase}};
    assert.deepEqual(decodeProgress(encodeProgress(progress),hunts),progress);
    assert.throws(()=>decodeProgress(encodeProgress({...progress,completed:['activation','security']}),hunts),/cooling checkpoint/);
  }
});
test('Completed Lake Mystery scans can be replayed after a progress transfer',()=>{
  const state={...freshState('howell','demo'),completed:['activation','security'],scanComplete:'lake'};
  assert.deepEqual(decodeProgress(encodeProgress(state),hunts),state);
  assert.throws(()=>decodeProgress(encodeProgress({...state,completed:['activation']}),hunts),/scan checkpoint/);
});
test('Ten-character codes round trip gameplay, check typos, and accept lowercase',()=>{
  const now=Date.now();
  const sweep=freshState('howell','field');
  sweep.completed=['activation','security','lake','map'];
  sweep.timer={deadline:now+42000,captured:['bravo']};
  sweep.hints={activation:1,sensors:3};
  sweep.notes=[{text:'Local journal',at:now}];
  const code=encodeShortProgress(sweep,hunts,now);
  assert.equal(code.length,10);
  const restored=decodeProgress(code.toLowerCase(),hunts);
  assert.deepEqual(restored.completed,sweep.completed);
  assert.deepEqual(restored.hints,sweep.hints);
  assert.deepEqual(restored.timer.captured,['bravo']);
  assert.ok(restored.timer.deadline>=now+42000);
  assert.deepEqual(restored.notes,[]);
  assert.throws(()=>decodeProgress(code.slice(0,-1)+(code.at(-1)==='0'?'1':'0'),hunts),/10-character/);
  const pirate={...freshState('pirate','demo'),completed:['clue1','clue2'],hints:{clue2:2}};
  const reopened=decodeProgress(encodeShortProgress(pirate,hunts),hunts);
  assert.equal(reopened.hunt,'pirate');
  assert.deepEqual(reopened.completed,pirate.completed);
  assert.deepEqual(reopened.hints,pirate.hints);
  for(const cooling of ['locate','cooled']){
    const pending={...freshState('howell','demo'),completed:['activation'],cooling:{stage:'security',phase:cooling}};
    assert.deepEqual(decodeProgress(encodeShortProgress(pending,hunts),hunts).cooling,pending.cooling);
  }
  const lake={...freshState('howell','demo'),completed:['activation','security'],scanComplete:'lake'};
  assert.equal(decodeProgress(encodeShortProgress(lake,hunts),hunts).scanComplete,'lake');
});
test('unconfigured real routes stay blocked; fully configured routes pass',()=>{
  const incomplete=structuredClone(settings);for(const config of [incomplete.howell,incomplete.pirate])for(const key of Object.keys(config.locations))config.locations[key]=null;
  assert.ok(settingsProblems(incomplete,'howell').length);assert.ok(settingsProblems(incomplete,'pirate').length);
  const complete=structuredClone(settings);for(const config of [complete.howell,complete.pirate])for(const key of Object.keys(config.locations))config.locations[key]={lat:28.6,lng:-81.2};complete.howell.fenceAnswer='White';complete.howell.fizzAnswer='Blue';complete.pirate.clues=complete.pirate.clues.map(c=>({...c,question:'Which color?',options:['Red','Blue'],answer:'Red'}));
  assert.deepEqual(settingsProblems(complete,'howell'),[]);assert.deepEqual(settingsProblems(complete,'pirate'),[]);
});
test('custom phrase fragments stay aligned and sweep narration works with a custom timer',()=>{
  const custom=structuredClone(settings);custom.howell.shutdownPhrase='FOLLOW THE HIDDEN TRAIL';custom.howell.sensorSeconds=60;
  const stages=createHunts(source,custom)[0].stages;
  const fragments=['security','sensors','processor'].map(id=>stages.find(s=>s.id===id).passphraseFragment).join(' ');
  assert.equal(stages.filter(stage=>stage.passphraseFragment).length,3);
  const sweep=stages.find(s=>s.id==='sensors');
  assert.equal(fragments,custom.howell.shutdownPhrase);
  assert.equal(sweep.audio,source.transmissions['mission-04-sensor-sweep'].audio);
  assert.match(sweep.text,/before the timer runs out/);
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
test('The Agency recording repeats two independently decodable packets',()=>{
  for(const phrase of [settings.howell.shutdownPhrase,'A'.repeat(120)]){
    const single=encodeSignal(phrase);
    const repeated=encodeRepeatedSignal(phrase);
    assert.ok(repeated.samples.length/repeated.sampleRate<90);
    assert.equal(decodeSignal(repeated.samples,repeated.sampleRate),phrase);
    assert.equal(decodeSignal(repeated.samples.subarray(single.samples.length/2),repeated.sampleRate),phrase);
  }
});
