// Audible dual-tone transport, version 1. Preamble + repeated symbols + CRC.
// This format is new; older unsynchronized CipherWave WAVs are not compatible.
const ROWS = [697,770,852,941,1100,1260,1450,1633];
const COLS = [2100,2300,2500,2700,2900,3100,3300,3500,3700,3900,4100,4300];
const TONE = .12, SLOT = .16, SYNC = 520;
export function crc16(bytes) {
  let crc = 0xffff;
  for (const byte of bytes) { crc ^= byte << 8; for(let i=0;i<8;i++) crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1; crc &= 0xffff; }
  return crc;
}
export function encodeSignal(message, sampleRate = 24000) {
  if (!/^[\x20-\x7e]{1,120}$/.test(message)) throw Error('Use 1–120 printable ASCII characters.');
  const checksum = crc16(new TextEncoder().encode(message)).toString(16).padStart(4,'0').toUpperCase();
  const packet = String(message.length).padStart(3,'0') + message + checksum;
  const symbols = [...packet].flatMap(c=>[c,c]);
  const lead = .25, syncLength = .6, gap = .2, start = lead+syncLength+gap;
  const samples = new Float32Array(Math.ceil((start + symbols.length * SLOT + .25) * sampleRate));
  const tone = (at,duration,frequencies) => {
    const count = Math.round(duration * sampleRate), offset = Math.round(at * sampleRate);
    for(let i=0;i<count;i++) { const edge = Math.min(1,i/(sampleRate*.008),(count-i)/(sampleRate*.008)); samples[offset+i] = edge * frequencies.reduce((v,f)=>v+Math.sin(2*Math.PI*f*i/sampleRate),0) * .32 / frequencies.length; }
  };
  tone(lead,syncLength,[SYNC]);
  symbols.forEach((c,i)=>{ const n=c.charCodeAt(0)-32; tone(start+i*SLOT,TONE,[ROWS[Math.floor(n/12)],COLS[n%12]]); });
  return {samples,sampleRate};
}
export function encodeRepeatedSignal(message) {
  const {samples,sampleRate} = encodeSignal(message);
  const gap = Math.round(sampleRate * .6);
  const repeated = new Float32Array(samples.length * 2 + gap);
  repeated.set(samples);
  repeated.set(samples, samples.length + gap);
  return {samples:repeated,sampleRate};
}
function power(samples, rate, frequency, from, count) {
  const coeff = 2*Math.cos(2*Math.PI*frequency/rate); let q1=0,q2=0;
  for(let i=from;i<from+count;i++){const q0=(samples[i]||0)+coeff*q1-q2;q2=q1;q1=q0;}
  return Math.max(0,q1*q1+q2*q2-coeff*q1*q2)/(count*count);
}
function detect(samples,rate,at) {
  const count=Math.round(.075*rate), from=Math.round((at+.02)*rate);
  const rank=frequencies=>frequencies.map((f,i)=>({i,p:power(samples,rate,f,from,count)})).sort((a,b)=>b.p-a.p);
  const r=rank(ROWS), c=rank(COLS);
  return {char:String.fromCharCode(32+r[0].i*12+c[0].i), score:Math.min(r[0].p,c[0].p)/(Math.max(r[1].p,c[1].p)+1e-12), valid:r[0].p>1e-7 && c[0].p>1e-7};
}
export function decodeSignal(samples,rate) {
  if (rate<10000) throw Error('Audio sample rate is too low.');
  // Find rising edges of a 520 Hz preamble; arbitrary leading silence is allowed.
  const step=.01, window=.04, starts=[]; let run=0;
  for(let t=0;t<samples.length/rate-window;t+=step){
    const from=Math.round(t*rate), count=Math.round(window*rate);let energy=0;
    for(let i=from;i<from+count;i++)energy+=(samples[i]||0)**2;
    const p=power(samples,rate,SYNC,from,count), ratio=p/(energy/count+1e-12);
    if(p>1e-7 && ratio>.18){if(run===0)starts.push(t);run++;}else run=0;
  }
  for(const sync of starts){for(let shift=-.04;shift<=.061;shift+=.01){
    const start=sync+.8+shift;
    const read=index=>{const a=detect(samples,rate,start+index*2*SLOT),b=detect(samples,rate,start+(index*2+1)*SLOT);if(!a.valid&&!b.valid)return null;return a.char===b.char?a.char:(a.valid&&a.score>b.score?a.char:b.char);};
    const lengthText=[0,1,2].map(read).join('');if(!/^\d{3}$/.test(lengthText))continue;
    const length=Number(lengthText);if(length<1||length>120||start+(length+7)*2*SLOT>samples.length/rate+.1)continue;
    let packet='';for(let i=3;i<length+7;i++)packet+=read(i)||'\x00';
    const message=packet.slice(0,length),check=packet.slice(length);
    if(crc16(new TextEncoder().encode(message)).toString(16).padStart(4,'0').toUpperCase()===check)return message;
  }}
  throw Error('No complete, verified CipherWave v1 message found. Try a clean WAV upload, or move closer and record the whole signal including its opening tone.');
}
export function wavBytes(samples, sampleRate) {
  const buffer=new ArrayBuffer(44+samples.length*2), view=new DataView(buffer);
  const str=(offset,s)=>[...s].forEach((c,i)=>view.setUint8(offset+i,c.charCodeAt(0)));
  str(0,'RIFF');view.setUint32(4,36+samples.length*2,true);str(8,'WAVE');str(12,'fmt ');view.setUint32(16,16,true);view.setUint16(20,1,true);view.setUint16(22,1,true);view.setUint32(24,sampleRate,true);view.setUint32(28,sampleRate*2,true);view.setUint16(32,2,true);view.setUint16(34,16,true);str(36,'data');view.setUint32(40,samples.length*2,true);
  samples.forEach((s,i)=>view.setInt16(44+i*2,Math.max(-1,Math.min(1,s))*32767,true));return buffer;
}
