/**
 * Start screen music (also under the end credits, ui/Credits.tsx): the track picked in Settings → Track
 * (data/music.ts, Cipher by default) on a loop. Browsers only play sound after a click or key, so
 * it starts on mount if allowed, else on the first input. Volume and track follow Settings live.
 */
import { useEffect, useRef } from 'react';
import { trackById } from '../../data/music';
import { useGame } from '../../state/store';

/** Full volume at Music 100 %. */
const BASE = 0.55;
const FADE_IN_S = 1.5;

export function useStartMusic() {
  const fadeOut = useRef<(ms: number) => void>(() => {});
  useEffect(() => {
    const audio = new Audio(trackById(useGame.getState().save.settings.track).src);
    audio.loop = true;
    audio.volume = 0;
    let level = 1; // fade multiplier
    let raf = 0;
    const target = () =>
      Math.min(1, Math.max(0, BASE * useGame.getState().save.settings.music * level));
    const fade = (to: number, ms: number) => {
      cancelAnimationFrame(raf);
      const from = level;
      const t0 = performance.now();
      const step = (t: number) => {
        // a frame's timestamp can come before t0 (it is the frame's start): clamp, or k < 0
        const k = Math.min(1, Math.max(0, (t - t0) / ms));
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
        })
        .catch(() => {}); // not allowed yet: the next input tries again
    };
    // Inputs stay armed while mounted: Firefox lets a silent (volume 0) start through, then pauses it
    // once the fade-in makes it audible; the next click or key then starts it for real.
    const inputs = ['pointerdown', 'keydown', 'click', 'touchend'] as const;
    const removeInputs = () => inputs.forEach((e) => removeEventListener(e, play));
    inputs.forEach((e) => addEventListener(e, play));
    play();
    let launched = false;
    const unsub = useGame.subscribe((s, prev) => {
      if (s.save.settings.music !== prev.save.settings.music) audio.volume = target();
      // a new track starts from its beginning, faded in like the first
      if (s.save.settings.track !== prev.save.settings.track && !launched) {
        const playing = !audio.paused;
        audio.src = trackById(s.save.settings.track).src;
        level = 0;
        audio.volume = 0;
        if (playing) play();
      }
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
