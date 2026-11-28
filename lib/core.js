export const VERSION = 1;
export const normalize = value => String(value).trim().toUpperCase().replace(/\s+/g, ' ');
export function coordinates(value) {
  return value && Number.isFinite(value.lat) && Number.isFinite(value.lng) && Math.abs(value.lat) <= 90 && Math.abs(value.lng) <= 180;
}
export function distance(a, b) {
  const rad = n => n * Math.PI / 180;
  const dLat = rad(b.lat - a.lat), dLng = rad(b.lng - a.lng);
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 6371000 * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(Math.max(0, 1 - x)));
}
export function freshState(hunt, mode) {
  return { version: VERSION, hunt, mode, completed: [], hints: {}, notes: [], timer: null, startedAt: Date.now() };
}
export function validateState(value, hunts) {
  const hunt = hunts.find(h => h.id === value?.hunt);
  if (!hunt || value.version !== VERSION || !['demo', 'field'].includes(value.mode)) throw Error('This is not a supported Hidden Trails progress code.');
  if (!Array.isArray(value.completed)) throw Error('The saved stage sequence is invalid.');
  const completed = [...value.completed];
  // Older Howell saves reached the pool briefing without a Lake Mystery stop.
  if (hunt.id === 'howell' && completed[2] === 'map' && hunt.stages[2]?.id === 'lake') completed.splice(2, 0, 'lake');
  if (completed.length > hunt.stages.length || completed.some((id, i) => id !== hunt.stages[i].id)) throw Error('The saved stage sequence is invalid.');
  if (!value.hints || typeof value.hints !== 'object' || Array.isArray(value.hints) || Object.entries(value.hints).some(([id, n]) => !hunt.stages.some(s => s.id === id) || !Number.isInteger(n) || n < 0 || n > 3)) throw Error('Invalid hint data.');
  if (!Array.isArray(value.notes) || value.notes.length > 200 || value.notes.some(n => typeof n.text !== 'string' || n.text.length > 3000 || !Number.isFinite(n.at))) throw Error('Invalid journal data.');
  if (value.timer !== null && (!value.timer || !Number.isFinite(value.timer.deadline) || !Array.isArray(value.timer.captured) || new Set(value.timer.captured).size !== value.timer.captured.length || value.timer.captured.some(id => !['alpha', 'bravo', 'charlie'].includes(id)))) throw Error('Invalid timer data.');
  return { version: VERSION, hunt: hunt.id, mode: value.mode, completed, hints: { ...value.hints }, notes: value.notes.map(n => ({text:n.text, at:n.at})), timer: value.timer ? {deadline:value.timer.deadline, captured:[...value.timer.captured]} : null, startedAt: Number.isFinite(value.startedAt) ? value.startedAt : Date.now() };
}
export function encodeProgress(state) {
  const bytes = new TextEncoder().encode(JSON.stringify(state));
  return 'HT1.' + btoa(Array.from(bytes, n => String.fromCharCode(n)).join(''));
}
export function decodeProgress(code, hunts) {
  if (typeof code !== 'string' || code.length > 200000 || !code.startsWith('HT1.')) throw Error('Paste a complete code beginning HT1.');
  try { return validateState(JSON.parse(new TextDecoder('utf-8', {fatal:true}).decode(Uint8Array.from(atob(code.slice(4).trim()), c => c.charCodeAt(0)))), hunts); }
  catch (error) { throw Error('Cannot restore this code. ' + error.message); }
}
export function withinRange(position, target, radius, now = Date.now()) {
  return coordinates(position) && coordinates(target) && now - position.at < 20000 && position.accuracy <= radius && distance(position, target) <= radius;
}
export function settingsProblems(settings, id) {
  const result = [], config = settings[id];
  if (!config || typeof config !== 'object') return ['Missing ' + id + ' settings.'];
  const keys = id === 'howell' ? ['security','lake','pool','alpha','bravo','charlie','processor','treasure'] : ['clue1','clue2','clue3','clue4','clue5','treasure'];
  for (const key of keys) if (!coordinates(config.locations?.[key]) || (config.locations[key].lat === 0 && config.locations[key].lng === 0)) result.push('Set coordinates for ' + (key === 'lake' ? 'Lake Mystery' : key) + '.');
  if (!(config.arrivalRadiusMeters >= 5 && config.arrivalRadiusMeters <= 150)) result.push('Arrival radius must be 5–150 meters.');
  if (id === 'howell') {
    if (!['Black','White','Brown','Green'].some(x => normalize(x) === normalize(config.fenceAnswer))) result.push('Choose the correct fence color: Black, White, Brown, or Green.');
    if (!['Blue','Green','Purple','Red'].some(x => normalize(x) === normalize(config.fizzAnswer))) result.push('Choose the correct prop color: Blue, Green, Purple, or Red.');
    if (!/^[\x20-\x7e]{1,120}$/.test(config.shutdownPhrase || '') || !config.shutdownPhrase.trim()) result.push('Set a shutdown phrase using 1–120 printable ASCII characters.');
    if (!(config.sensorSeconds >= 30 && config.sensorSeconds <= 900)) result.push('Sensor timer must be 30–900 seconds.');
    if (!(config.captureRadiusMeters >= 5 && config.captureRadiusMeters <= 100)) result.push('Capture radius must be 5–100 meters.');
  } else {
    if (!Array.isArray(config.clues) || config.clues.length !== 5) result.push('Supply five pirate clues.');
    else config.clues.forEach((clue, i) => {
      if (!clue.title?.trim() || !clue.question?.trim() || !Array.isArray(clue.options) || clue.options.length < 2 || clue.options.length > 6 || clue.options.some(x => typeof x !== 'string' || !x.trim()) || !clue.options.some(x => normalize(x) === normalize(clue.answer))) result.push('Complete pirate question, options, and answer #' + (i + 1) + '.');
    });
  }
  return result;
}
