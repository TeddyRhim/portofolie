/* Ambiance sonore synthétisée (Web Audio) : aucun fichier, aucun droit à gérer.
   - fond étouffé de donjon : grondement grave filtré, souffle lointain, gouttes lointaines
   - grincement de la porte quand elle s'ouvre
   - crépitement du feu qui s'ajoute en approchant du brasero (le fond s'assourdit pour lui laisser la place) */

const clamp01 = v => Math.min(1, Math.max(0, v));
const smooth = (a, b, x) => { const t = clamp01((x - a) / (b - a)); return t * t * (3 - 2 * t); };
const rnd = (a, b) => a + Math.random() * (b - a);
const AMB = 0.8 / 0.9;      // niveau des sons autres que le feu : -0,1 sur l'échelle du fond (0,9 -> 0,8)

export function createAmbience() {
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  const ctx = new AC();
  const master = ctx.createGain(); master.gain.value = 0;
  const analyser = ctx.createAnalyser(); analyser.fftSize = 1024;
  master.connect(analyser); analyser.connect(ctx.destination);

  /* petite « salle » : écho court et sombre */
  const send = ctx.createGain(); send.gain.value = 0.35;
  const delay = ctx.createDelay(1); delay.delayTime.value = 0.31;
  const fb = ctx.createGain(); fb.gain.value = 0.42;
  const damp = ctx.createBiquadFilter(); damp.type = "lowpass"; damp.frequency.value = 1400;
  send.connect(delay); delay.connect(damp); damp.connect(fb); fb.connect(delay); damp.connect(master);

  /* bruits (tampons de 6 s en boucle) */
  const noiseBuf = (kind) => {
    const n = ctx.sampleRate * 6, b = ctx.createBuffer(1, n, ctx.sampleRate), d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === "brown") { last = (last + 0.02 * w) / 1.02; d[i] = last * 3.2; } else d[i] = w;
    }
    return b;
  };
  const loop = buf => { const s = ctx.createBufferSource(); s.buffer = buf; s.loop = true; s.start(); return s; };
  const brown = noiseBuf("brown"), white = noiseBuf("white");

  /* —— fond : grondement —— */
  const droneGain = ctx.createGain(); droneGain.gain.value = 0.9 * AMB;
  const droneLP = ctx.createBiquadFilter(); droneLP.type = "lowpass"; droneLP.frequency.value = 170; droneLP.Q.value = 0.6;
  loop(brown).connect(droneLP); droneLP.connect(droneGain);
  for (const [f, g] of [[46, 0.16], [69.3, 0.07], [92.5, 0.035]]) {          // fondamentale + harmoniques
    const o = ctx.createOscillator(); o.type = "sine"; o.frequency.value = f + rnd(-0.4, 0.4);
    const og = ctx.createGain(); og.gain.value = g;
    const lfo = ctx.createOscillator(); lfo.frequency.value = rnd(0.04, 0.11);
    const lg = ctx.createGain(); lg.gain.value = g * 0.55; lfo.connect(lg); lg.connect(og.gain);
    o.connect(og); og.connect(droneGain); o.start(); lfo.start();
  }
  droneGain.connect(master); droneGain.connect(send);

  /* —— souffle lointain —— */
  const windBP = ctx.createBiquadFilter(); windBP.type = "bandpass"; windBP.frequency.value = 340; windBP.Q.value = 0.7;
  const windGain = ctx.createGain(); windGain.gain.value = 0.05 * AMB;
  const wl = ctx.createOscillator(); wl.frequency.value = 0.063;
  const wlg = ctx.createGain(); wlg.gain.value = 140; wl.connect(wlg); wlg.connect(windBP.frequency); wl.start();
  const wl2 = ctx.createOscillator(); wl2.frequency.value = 0.09;
  const wl2g = ctx.createGain(); wl2g.gain.value = 0.03 * AMB; wl2.connect(wl2g); wl2g.connect(windGain.gain); wl2.start();
  loop(white).connect(windBP); windBP.connect(windGain); windGain.connect(master); windGain.connect(send);

  /* —— crépitement : impulsions éparses sur un lit de bruit —— */
  const crackBuf = (() => {
    const sr = ctx.sampleRate, n = sr * 5, b = ctx.createBuffer(1, n, sr), d = b.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * 0.012;
    for (let i = 0; i < n; i++) {
      if (Math.random() < 0.0016) {                      // un claquement
        const amp = Math.pow(Math.random(), 2.2) * 0.9 + 0.06, len = (30 + Math.random() * 260) | 0, tone = 0.2 + Math.random() * 0.7;
        let prev = 0;
        for (let k = 0; k < len && i + k < n; k++) {
          const w = Math.random() * 2 - 1, env = Math.exp(-k / (len * 0.28));
          prev = prev * (1 - tone) + w * tone;
          d[i + k] += prev * env * amp;
        }
      }
    }
    return b;
  })();
  const crackHP = ctx.createBiquadFilter(); crackHP.type = "highpass"; crackHP.frequency.value = 900;
  const crackLP = ctx.createBiquadFilter(); crackLP.type = "lowpass"; crackLP.frequency.value = 1800;
  const crackGain = ctx.createGain(); crackGain.gain.value = 0;
  loop(crackBuf).connect(crackHP); crackHP.connect(crackLP); crackLP.connect(crackGain); crackGain.connect(master); crackGain.connect(send);
  const fireBP = ctx.createBiquadFilter(); fireBP.type = "bandpass"; fireBP.frequency.value = 260; fireBP.Q.value = 0.8;   // souffle de la flamme
  const fireGain = ctx.createGain(); fireGain.gain.value = 0;
  const fl = ctx.createOscillator(); fl.frequency.value = 0.37; const flg = ctx.createGain(); flg.gain.value = 0.02; fl.connect(flg); flg.connect(fireGain.gain); fl.start();
  loop(white).connect(fireBP); fireBP.connect(fireGain); fireGain.connect(master);

  /* —— goutte lointaine, de temps en temps —— */
  let nextDrip = ctx.currentTime + rnd(5, 9);
  function drip(t) {
    const o = ctx.createOscillator(), g = ctx.createGain(), f = ctx.createBiquadFilter();
    o.type = "sine"; o.frequency.setValueAtTime(rnd(1100, 1700), t); o.frequency.exponentialRampToValueAtTime(rnd(520, 760), t + 0.12);
    f.type = "lowpass"; f.frequency.value = 1900;
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(rnd(0.05, 0.1) * AMB, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0005, t + 0.35);
    o.connect(f); f.connect(g); g.connect(master); g.connect(send); o.start(t); o.stop(t + 0.4);
  }

  /* —— grincement de la porte —— */
  function creak() {
    const t = ctx.currentTime, dur = 3.0;
    const o = ctx.createOscillator(); o.type = "sawtooth";
    o.frequency.setValueAtTime(70, t); o.frequency.linearRampToValueAtTime(128, t + dur * 0.45); o.frequency.linearRampToValueAtTime(96, t + dur);
    const vib = ctx.createOscillator(); vib.frequency.value = 7.5; const vg = ctx.createGain(); vg.gain.value = 5; vib.connect(vg); vg.connect(o.frequency);
    const bp = ctx.createBiquadFilter(); bp.type = "bandpass"; bp.Q.value = 5;
    bp.frequency.setValueAtTime(380, t); bp.frequency.linearRampToValueAtTime(900, t + dur * 0.5); bp.frequency.linearRampToValueAtTime(520, t + dur);
    const g = ctx.createGain(); g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(0.16 * AMB, t + 0.5); g.gain.linearRampToValueAtTime(0.1 * AMB, t + dur * 0.7); g.gain.exponentialRampToValueAtTime(0.0008, t + dur);
    o.connect(bp); bp.connect(g); g.connect(master); g.connect(send);
    o.start(t); vib.start(t); o.stop(t + dur + 0.1); vib.stop(t + dur + 0.1);
    // choc sourd quand le battant arrive en butée
    const th = ctx.createOscillator(); th.type = "sine"; th.frequency.setValueAtTime(62, t + dur * 0.8); th.frequency.exponentialRampToValueAtTime(34, t + dur * 0.8 + 0.5);
    const tg = ctx.createGain(); tg.gain.setValueAtTime(0, t + dur * 0.8); tg.gain.linearRampToValueAtTime(0.32 * AMB, t + dur * 0.8 + 0.02); tg.gain.exponentialRampToValueAtTime(0.001, t + dur * 0.8 + 0.7);
    th.connect(tg); tg.connect(master); tg.connect(send); th.start(t + dur * 0.8); th.stop(t + dur * 0.8 + 0.8);
  }

  /* —— état —— */
  let on = false, p = 0, creaked = false, sm = { fire: 0, door: 0 };
  const buf = new Float32Array(analyser.fftSize);
  const api = {
    ctx,
    get on() { return on; },
    async enable(v) {
      on = !!v;
      if (on) { try { await ctx.resume(); } catch (e) {} }
      const t = ctx.currentTime;
      master.gain.cancelScheduledValues(t); master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(on ? 0.19 : 0, t + (on ? 3.0 : 0.5));
      if (!on) setTimeout(() => { if (!on) ctx.suspend(); }, 700);
    },
    setProgress(v) { p = v; },
    tick(dt) {
      if (!on || ctx.state !== "running") return;
      const fire = Math.pow(smooth(0.2, 0.985, p), 1.5);      // inaudible jusqu'au premier projet, puis de plus en plus présent
      sm.fire += (fire - sm.fire) * Math.min(1, dt * 1.6);
      const t = ctx.currentTime, k = 1 - Math.exp(-dt * 6);
      crackGain.gain.value += (sm.fire * 0.4 - crackGain.gain.value) * k;
      crackLP.frequency.value += ((1800 + 7200 * sm.fire) - crackLP.frequency.value) * k;
      fireGain.gain.value += (sm.fire * 0.03 - fireGain.gain.value) * k;
      droneGain.gain.value += (((0.9 - 0.3 * sm.fire) * AMB) - droneGain.gain.value) * k;      // le fond s'efface un peu
      droneLP.frequency.value += ((170 + 120 * sm.fire) - droneLP.frequency.value) * k;
      if (!creaked && p > 0.032) { creaked = true; creak(); }
      if (p < 0.01) creaked = false;
      if (t > nextDrip) { drip(t + 0.02); nextDrip = t + rnd(7, 15); }
    },
    level() { analyser.getFloatTimeDomainData(buf); let s = 0; for (const v of buf) s += v * v; return Math.sqrt(s / buf.length); },
    parts() { return { crack: crackGain.gain.value, fire: fireGain.gain.value, drone: droneGain.gain.value }; },
  };
  document.addEventListener("visibilitychange", () => { if (!on) return; document.hidden ? ctx.suspend() : ctx.resume(); });
  return api;
}
