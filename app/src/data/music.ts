/**
 * The start screen tracks (assets/music/), picked in Settings → Track; the first is the default.
 * Info and the end credits list their credits from here.
 * PLACEHOLDER: sonican.mp3's title and page are not recorded yet (Sonican publishes on Pixabay).
 */
import cipherUrl from '../assets/music/cipher2.mp3?url';
import chaseUrl from '../assets/music/chase.mp3?url';
import sonicanUrl from '../assets/music/sonican.mp3?url';

export interface Track {
  id: string;
  title: string;
  artist: string;
  license: string;
  src: string;
  /** Where the track comes from (Info links it), if known. */
  url?: string;
}

export const TRACKS: Track[] = [
  {
    id: 'cipher',
    title: 'Cipher',
    artist: 'Kevin MacLeod (incompetech.com)',
    license: 'CC BY 4.0',
    src: cipherUrl,
    url: 'https://incompetech.com',
  },
  {
    id: 'chase',
    title: 'Chase',
    artist: 'Adiutorium',
    license: 'CC0',
    src: chaseUrl,
    url: 'https://opengameart.org/content/chase-2',
  },
  {
    id: 'sonican',
    title: 'Sonican',
    artist: 'Sonican',
    license: 'Pixabay Content License',
    src: sonicanUrl,
  },
];

export const trackById = (id: string) => TRACKS.find((t) => t.id === id) ?? TRACKS[0];
