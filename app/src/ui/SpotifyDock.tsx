/**
 * Spotify player for the recommended background music (AI Agents Chaos, Epic Mountain).
 * Mounted once in App, outside the screen switch, so it keeps playing through the levels. It shows
 * itself laid over the slot in Settings (`spotifySlot`); otherwise it sits off screen, still mounted
 * (moving an iframe in the DOM would reload it and stop the music).
 * Spotify's iFrame API reports play/pause; while it plays, the start screen's own music fades out.
 * Logged-out listeners get Spotify's 30 s preview; logged in, the full track.
 */
import { useEffect, useRef } from 'react';
import { useGame } from '../state/store';
import './spotify.css';

const TRACK = 'spotify:track:7Mjuj0atPD8xVnmrtCRgpp';
const API = 'https://open.spotify.com/embed/iframe-api/v1';

interface SpotifyController {
  addListener: (e: 'playback_update', cb: (e: { data: { isPaused: boolean } }) => void) => void;
  destroy: () => void;
}
interface SpotifyIFrameAPI {
  createController: (
    el: HTMLElement,
    opts: { uri: string; width: string; height: number },
    cb: (c: SpotifyController) => void,
  ) => void;
}
declare global {
  interface Window {
    onSpotifyIframeApiReady?: (api: SpotifyIFrameAPI) => void;
  }
}

// The API script loads once per page; each mount makes its own controller.
let apiReady: Promise<SpotifyIFrameAPI> | undefined;
const loadApi = () =>
  (apiReady ??= new Promise((resolve) => {
    window.onSpotifyIframeApiReady = resolve;
    const script = document.createElement('script');
    script.src = API;
    script.async = true;
    document.body.appendChild(script);
  }));

export function SpotifyDock() {
  const slot = useGame((s) => s.spotifySlot);
  const host = useRef<HTMLDivElement>(null);
  const dock = useRef<HTMLDivElement>(null);

  // follow the slot while it exists (the Settings window can scroll and resize)
  useEffect(() => {
    if (!slot) return;
    const el = dock.current!;
    let raf = 0;
    const follow = () => {
      const r = slot.getBoundingClientRect();
      const d = el.style;
      d.left = `${r.left}px`;
      d.top = `${r.top}px`;
      d.width = `${r.width}px`;
      raf = requestAnimationFrame(follow);
    };
    follow();
    return () => {
      cancelAnimationFrame(raf);
      el.removeAttribute('style');
    };
  }, [slot]);

  useEffect(() => {
    const box = host.current!;
    // the API replaces this element with its iframe: keep it out of React's hands
    const el = document.createElement('div');
    box.appendChild(el);
    let controller: SpotifyController | undefined;
    let gone = false;
    void loadApi().then((api) => {
      if (gone) return;
      api.createController(el, { uri: TRACK, width: '100%', height: 80 }, (c) => {
        controller = c;
        if (gone) return c.destroy();
        c.addListener('playback_update', (e) =>
          useGame.setState({ spotifyPlaying: !e.data.isPaused }),
        );
      });
    });
    return () => {
      gone = true;
      controller?.destroy();
      box.replaceChildren();
      useGame.setState({ spotifyPlaying: false });
    };
  }, []);

  return (
    <div ref={dock} className={'spotify-dock' + (slot ? '' : ' away')} aria-hidden={!slot}>
      <div ref={host} />
    </div>
  );
}
