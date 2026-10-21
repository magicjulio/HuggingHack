/** Quiet local synth: room tone, paper, relay, and the fan winding down. */
import { sfxVolume } from '../../state/settings';
export function createSound() {
  let ctx: AudioContext | undefined;
  let master: GainNode;
  let hum: OscillatorNode;
  let tone: GainNode;
  let muted = false;
  let stopped = false;
  let pulled = false;
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
    },
    dispose() {
      stopped = true;
      if (ctx) {
        hum.stop();
        void ctx.close();
      }
    },
  };
}
