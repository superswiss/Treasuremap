import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {parseSetupConfig} from '../lib/setup-config.js';
const source=await readFile(new URL('../content/hunt-settings.json',import.meta.url),'utf8');
test('incomplete setup is transferable; malformed coordinates are rejected',()=>{
  const draft=JSON.parse(source);draft.howell.locations.security=null;const value=parseSetupConfig(JSON.stringify(draft));assert.equal(value.howell.locations.security,null);
  value.howell.locations.security={lat:91,lng:0};assert.throws(()=>parseSetupConfig(JSON.stringify(value)),/coordinates/);
  assert.throws(()=>parseSetupConfig('{"organizerPin":"1980"}'),/locations/);
});
