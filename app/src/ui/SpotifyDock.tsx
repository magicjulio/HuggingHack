/**
 * Spotify player for the recommended background music (AI Agents Chaos, Epic Mountain).
 * Mounted once in App, outside the screen switch, so it keeps playing through the levels:
 * visible bottom right on the start screen, moved off screen (still mounted) during a level.
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
  const screen = useGame((s) => s.screen);
  const host = useRef<HTMLDivElement>(null);

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
    <div
      className={'spotify-dock' + (screen === 'start' ? '' : ' away')}
      aria-hidden={screen !== 'start'}
    >
      <p className="spotify-label">RECOMMENDED BACKGROUND MUSIC</p>
      <div ref={host} />
    </div>
  );
}
