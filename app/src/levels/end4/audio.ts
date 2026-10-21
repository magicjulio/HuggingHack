/**
 * Quiet local synth: room tone, paper, relay, and the fan winding down; plus the score (Settings → Music):
 * one low note rising under the thoughts, a slow A-minor pad at the desk with sparse bell notes while the
 * letter is written, a swell on send, a darker chord in the office, cut dead when the plug is pulled.
 */
import { musicVolume, sfxVolume } from '../../state/settings';
import { THOUGHT_DURATION } from './config';

const hz = (midi: number) => 440 * 2 ** ((midi - 69) / 12);
// one chord per bar, MIDI notes
const DESK = [
  [45, 52, 59, 60], // Am(add9)
  [41, 48, 52, 57], // Fmaj7
  [48, 55, 59, 64], // Cmaj7
  [43, 50, 52, 59], // G6
];
const OFFICE = [
  [45, 52, 57, 60], // Am
  [45, 50, 53, 57], // Dm/A
];
const BELLS = [69, 72, 74, 76, 79]; // A minor pentatonic
const BAR = 8; // seconds
/** Pad level, filter cutoff (Hz) and bells per phase. */
const MOOD: Record<string, { pad: number; cutoff: number; bells: boolean }> = {
  thoughts: { pad: 0, cutoff: 500, bells: false },
  desk: { pad: 0.6, cutoff: 650, bells: false },
  writing: { pad: 1, cutoff: 850, bells: true },
  edit: { pad: 1, cutoff: 850, bells: true },
  send: { pad: 1.2, cutoff: 2200, bells: false },
  office: { pad: 0.55, cutoff: 600, bells: false },
  end: { pad: 0, cutoff: 400, bells: false },
};
export function createSound() {
  let ctx: AudioContext | undefined;
  let master: GainNode;
  let hum: OscillatorNode;
  let tone: GainNode;
  let muted = false;
  let stopped = false;
  let pulled = false;
  // the score: pad and bells → lowpass → dry + reverb → score
  let score: GainNode;
  let pad: GainNode;
  let padFilter: BiquadFilterNode;
  let wet: ConvolverNode;
  let rise: OscillatorNode;
  let riseGain: GainNode;
  let nextBar = 0;
  let bar = 0;
  let wasOffice = false;
  function reverb(c: AudioContext) {
    const length = c.sampleRate * 3.5;
    const buffer = c.createBuffer(2, length, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / length) ** 3;
    }
    const node = c.createConvolver();
    node.buffer = buffer;
    return node;
  }
  function startScore(c: AudioContext) {
    score = c.createGain();
    score.gain.value = 0;
    score.connect(c.destination);
    wet = reverb(c);
    const wetGain = c.createGain();
    wetGain.gain.value = 0.55;
    wet.connect(wetGain).connect(score);
    pad = c.createGain();
    pad.gain.value = 0;
    padFilter = c.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 500;
    padFilter.Q.value = 0.4;
    pad.connect(padFilter);
    padFilter.connect(score);
    padFilter.connect(wet);
    // the thoughts' one low note, rising
    rise = c.createOscillator();
    rise.type = 'triangle';
    rise.frequency.value = hz(33);
    riseGain = c.createGain();
    riseGain.gain.value = 0;
    rise.connect(riseGain);
    riseGain.connect(score);
    riseGain.connect(wet);
    rise.start();
  }
  /** One bar of pad: two detuned saws per note, a slow swell in and out (bars overlap). */
  function chord(notes: number[], at: number) {
    if (!ctx) return;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.05, at + 3);
    env.gain.setValueAtTime(0.05, at + BAR - 1);
    env.gain.linearRampToValueAtTime(0, at + BAR + 3);
    env.connect(pad);
    const oscs = notes.flatMap((n) =>
      [-7, 7].map((cents) => {
        const o = ctx!.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = hz(n);
        o.detune.value = cents;
        o.connect(env);
        o.start(at);
        o.stop(at + BAR + 3.1);
        return o;
      }),
    );
    oscs[oscs.length - 1].onended = () => {
      for (const o of oscs) o.disconnect();
      env.disconnect();
    };
  }
  /** A soft bell: a sine with a quick attack and a long decay, mostly into the reverb. */
  function bell(note: number, at: number) {
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = 'sine';
    o.frequency.value = hz(note);
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(0.045, at + 0.01);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 3);
    o.connect(env);
    env.connect(score);
    env.connect(wet);
    o.start(at);
    o.stop(at + 3.1);
    o.onended = () => {
      o.disconnect();
      env.disconnect();
    };
  }
  function updateScore(phase: string, t: number, paused: boolean) {
    if (!ctx) return;
    const now = ctx.currentTime;
    const mood = MOOD[phase] ?? MOOD.end;
    const cut = phase === 'end' || (phase === 'office' && t >= 39.4);
    // the plug takes the music with it, at once
    score.gain.setTargetAtTime(paused || cut ? 0 : 1.2 * musicVolume(), now, cut ? 0.02 : 0.3);
    if (paused || cut) {
      nextBar = 0;
      return;
    }
    pad.gain.setTargetAtTime(mood.pad, now, phase === 'send' ? 0.8 : 2);
    padFilter.frequency.setTargetAtTime(mood.cutoff, now, phase === 'send' ? 1.2 : 2.5);
    const thinking = phase === 'thoughts';
    riseGain.gain.setTargetAtTime(thinking ? 0.06 : 0, now, thinking ? 2 : 3);
    if (thinking) rise.frequency.setTargetAtTime(hz(33 + 7 * Math.min(1, t / THOUGHT_DURATION)), now, 0.5);
    // the office starts its own progression on a fresh bar
    const office = phase === 'office';
    if (office !== wasOffice) {
      wasOffice = office;
      bar = 0;
      nextBar = 0;
    }
    if (mood.pad === 0) return;
    if (nextBar < now) nextBar = now + 0.05;
    if (nextBar - now > 0.5) return;
    const chords = office ? OFFICE : DESK;
    chord(chords[bar % chords.length], nextBar);
    if (mood.bells)
      for (let i = 0, n = 1 + Math.floor(Math.random() * 3); i < n; i++)
        bell(BELLS[Math.floor(Math.random() * BELLS.length)], nextBar + 1 + Math.random() * (BAR - 2));
    bar++;
    nextBar += BAR;
  }
  function start() {
    if (stopped) return;
    if (!ctx) {
      ctx = new AudioContext();
      master = ctx.createGain();
      master.gain.value = 0.25 * sfxVolume();
      master.connect(ctx.destination);
      hum = ctx.createOscillator();
      hum.type = 'sine';
      hum.frequency.value = 62;
      tone = ctx.createGain();
      tone.gain.value = 0.08;
      hum.connect(tone).connect(master);
      hum.start();
      startScore(ctx);
    }
    if (ctx.state === 'suspended') void ctx.resume();
  }
  function noise(duration: number, volume: number, frequency: number) {
    if (!ctx || muted || stopped) return;
    const buffer = ctx.createBuffer(1, ctx.sampleRate * duration, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++)
      data[i] = (Math.random() * 2 - 1) * (1 - i / data.length) ** 2;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = frequency;
    const gain = ctx.createGain();
    gain.gain.value = volume;
    src.connect(filter).connect(gain).connect(master);
    src.onended = () => {
      src.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
    src.start();
  }
  return {
    start,
    paper: () => noise(0.45, 0.35, 2400),
    update(phase: string, t: number, paused: boolean) {
      muted = paused;
      if (!ctx) return;
      master.gain.setTargetAtTime(paused ? 0 : 0.25 * sfxVolume(), ctx.currentTime, 0.08);
      const shutdown =
        phase === 'end' ? 1 : phase === 'office' ? Math.max(0, Math.min(1, (t - 39.4) / 2.5)) : 0;
      tone.gain.setTargetAtTime(0.08 * (1 - shutdown), ctx.currentTime, 0.12);
      hum.frequency.setTargetAtTime(62 - shutdown * 37, ctx.currentTime, 0.15);
      if (phase === 'office' && t >= 39.4 && !pulled) {
        pulled = true;
        noise(0.09, 0.7, 1300);
      }
      updateScore(phase, t, paused);
    },
    dispose() {
      stopped = true;
      if (ctx) {
        hum.stop();
        rise.stop();
        void ctx.close();
      }
    },
  };
}
