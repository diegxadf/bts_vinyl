// Sonidos del tocadiscos generados con Web Audio: crujido del vinilo, caída y subida de la aguja.
let ctx = null, crackleGain = null, out = null;
let crackleLevel = 0.5, crackleOn = false;

export function init() {
  if (ctx) { if (ctx.state === 'suspended') ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  out = ctx.createGain();
  out.gain.value = 1;
  out.connect(ctx.destination);

  // 8 s de ruido de vinilo en bucle: siseo suave + chasquidos aleatorios
  const sr = ctx.sampleRate, len = sr * 8;
  const buf = ctx.createBuffer(2, len, sr);
  const L = buf.getChannelData(0), R = buf.getChannelData(1);
  let lp = 0;
  for (let i = 0; i < len; i++) {
    lp = lp * 0.9 + (Math.random() * 2 - 1) * 0.1;
    L[i] = R[i] = lp * 0.05;
  }
  const pops = 260;
  for (let k = 0; k < pops; k++) {
    const at = Math.floor(Math.random() * (len - 400));
    const amp = (Math.random() < 0.85 ? 0.08 + Math.random() * 0.25 : 0.4 + Math.random() * 0.4) * (Math.random() < 0.5 ? -1 : 1);
    const dur = 8 + Math.floor(Math.random() * 60);
    const pan = Math.random();
    for (let j = 0; j < dur; j++) {
      const v = amp * Math.exp(-j / (dur / 4)) * (j % 2 ? -0.6 : 1);
      L[at + j] += v * (1 - pan * 0.5);
      R[at + j] += v * (0.5 + pan * 0.5);
    }
  }
  const src = ctx.createBufferSource();
  src.buffer = buf; src.loop = true;
  const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 180;
  const lpf = ctx.createBiquadFilter(); lpf.type = 'lowpass'; lpf.frequency.value = 7000;
  crackleGain = ctx.createGain(); crackleGain.gain.value = 0;
  src.connect(hp).connect(lpf).connect(crackleGain).connect(out);
  src.start();
}

function apply() {
  if (!ctx) return;
  crackleGain.gain.setTargetAtTime(crackleOn ? crackleLevel * 0.6 : 0, ctx.currentTime, 0.12);
}
export function setCrackle(on) { crackleOn = on; apply(); }
export function setCrackleLevel(v) { crackleLevel = v; apply(); }

function burst({ freq = 70, dur = 0.18, gain = 0.5, noise = 0.25 }) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const o = ctx.createOscillator(); o.type = 'sine';
  o.frequency.setValueAtTime(freq * 1.6, t);
  o.frequency.exponentialRampToValueAtTime(freq, t + dur);
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g).connect(out); o.start(t); o.stop(t + dur + 0.02);

  const n = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.05), ctx.sampleRate);
  const d = n.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * Math.exp(-i / (d.length / 6));
  const ns = ctx.createBufferSource(); ns.buffer = n;
  const ng = ctx.createGain(); ng.gain.value = noise;
  const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 2500;
  ns.connect(f).connect(ng).connect(out); ns.start(t);
}
export const needleDrop = () => burst({ freq: 55, dur: 0.22, gain: 0.55, noise: 0.35 * (0.4 + crackleLevel) });
export const needleLift = () => burst({ freq: 120, dur: 0.06, gain: 0.12, noise: 0.15 });
export const click = () => burst({ freq: 900, dur: 0.03, gain: 0.08, noise: 0.08 });
