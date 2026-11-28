import {coordinates} from './core.js';
// Incomplete routes are valid drafts. Structural errors must not enter game storage.
export function parseSetupConfig(text){
  const config=JSON.parse(text);
  if(!config||!/^\d{4}$/.test(String(config.organizerPin)))throw Error('The configuration needs a four-digit organizer PIN.');
  for(const id of ['howell','pirate']){
    const value=config[id];if(!value||!value.locations||typeof value.locations!=='object')throw Error('Missing '+id+' locations.');
    if(id==='howell')for(const key of ['snave','lake'])if(!Object.hasOwn(value.locations,key))value.locations[key]=null;
    const keys=id==='howell'?['snave','security','lake','pool','alpha','bravo','charlie','processor','treasure']:['clue1','clue2','clue3','clue4','clue5','treasure'];
    for(const key of keys)if(value.locations[key]!==null&&!coordinates(value.locations[key]))throw Error('Invalid coordinates for '+key+'.');
    if(!Number.isFinite(value.arrivalRadiusMeters)||value.arrivalRadiusMeters<5||value.arrivalRadiusMeters>150)throw Error('Arrival radius must be 5–150 meters.');
  }
  const h=config.howell;
  if(![h.fenceAnswer,h.fizzAnswer,h.shutdownPhrase].every(x=>typeof x==='string'))throw Error('Missing Howell answer fields.');
  if(!Number.isFinite(h.sensorSeconds)||h.sensorSeconds<30||h.sensorSeconds>900||!Number.isFinite(h.captureRadiusMeters)||h.captureRadiusMeters<5||h.captureRadiusMeters>100)throw Error('Check sensor timing and capture radius.');
  if(!Array.isArray(config.pirate.clues)||config.pirate.clues.length!==5||config.pirate.clues.some(c=>!c||![c.title,c.question,c.answer].every(v=>typeof v==='string')||!Array.isArray(c.options)||c.options.some(v=>typeof v!=='string')))throw Error('The configuration needs five pirate clue records.');
  return config;
}
