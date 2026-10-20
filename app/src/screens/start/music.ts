/**
 * Start screen music: "Chase" by Adiutorium (CC0, credited in Info) on a loop; cipher2.mp3 and
 * sonican.mp3 sit next to it in assets/music/ until they get a place. Browsers only play sound after a click or key, so
 * it starts on mount if allowed, else on the first input. Volume follows Settings → Music live.
 */
import { useEffect, useRef } from 'react';
import chaseUrl from '../../assets/music/chase.mp3?url';
import { useGame } from '../../state/store';

/** Full volume at Music 100 %. */
const BASE = 0.55;
const FADE_IN_S = 1.5;

export function useStartMusic() {
  const fadeOut = useRef<(ms: number) => void>(() => {});
  useEffect(() => {
    const audio = new Audio(chaseUrl);
    audio.loop = true;
    audio.volume = 0;
    let level = 1; // fade multiplier
    let raf = 0;
    const target = () => BASE * useGame.getState().save.settings.music * level;
    const fade = (to: number, ms: number) => {
      cancelAnimationFrame(raf);
      const from = level;
      const t0 = performance.now();
      const step = (t: number) => {
        const k = Math.min(1, (t - t0) / ms);
        level = from + (to - from) * k;
        audio.volume = target();
        if (k < 1) raf = requestAnimationFrame(step);
      };
      raf = requestAnimationFrame(step);
    };
    const play = () => {
      if (!audio.paused) return;
      level = 0;
      audio
        .play()
        .then(() => {
          if (!useGame.getState().spotifyPlaying) fade(1, FADE_IN_S * 1000);
          removeInputs();
        })
        .catch(() => {}); // not allowed yet: the next input tries again
    };
    const inputs = ['pointerdown', 'keydown'] as const;
    const removeInputs = () => inputs.forEach((e) => removeEventListener(e, play));
    inputs.forEach((e) => addEventListener(e, play));
    play();
    let launched = false;
    const unsub = useGame.subscribe((s, prev) => {
      if (s.save.settings.music !== prev.save.settings.music) audio.volume = target();
      // Spotify dock playing: step aside, come back when it pauses
      if (s.spotifyPlaying !== prev.spotifyPlaying && !launched)
        fade(s.spotifyPlaying ? 0 : 1, 600);
    });
    fadeOut.current = (ms) => {
      launched = true;
      fade(0, ms);
    };
    return () => {
      cancelAnimationFrame(raf);
      removeInputs();
      unsub();
      audio.pause();
      audio.src = '';
    };
  }, []);
  return fadeOut;
}
