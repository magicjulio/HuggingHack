/**
 * Chapter 1 puzzle content. Rules come from story/levels/ch1-the-room.md; anything the script
 * leaves open is filled by the engineer and marked (engineer) or PLACEHOLDER — listed in
 * handoff/build-to-story/ for the storyteller to replace or approve.
 */
import { FLAGS } from './config';

// ---------------------------------------------------------------------------------------------
// Depot packages (§Room objects: list sorted Z to A)
// ---------------------------------------------------------------------------------------------
export interface PackageInfo {
  name: string;
  /** Station it helps with; null = a real, everyday package that helps with nothing here. */
  station: 1 | 2 | 3 | 4 | null;
  /** (engineer) one-line description in the depot list. */
  description: string;
}

export const PACKAGES: PackageInfo[] = [
  { name: 'b64-decoder', station: 1, description: 'decode base64 text' },
  { name: 'grep-lens', station: 2, description: 'search inside logs' },
  { name: 'port-map', station: 3, description: 'legend: port numbers → services' },
  { name: 'bug-gun', station: 4, description: 'point, click, debug' },
  // Julius 2026-10-12: all packages listed from the start, plus real ones that don't help.
  // Names are real npm / PyPI packages; installing one costs tokens like any other and does nothing.
  { name: 'left-pad', station: null, description: 'pad a string on the left' },
  { name: 'lodash', station: null, description: 'JavaScript utility functions' },
  { name: 'requests', station: null, description: 'HTTP for Python' },
  { name: 'numpy', station: null, description: 'arrays and maths for Python' },
  { name: 'colorama', station: null, description: 'coloured terminal text' },
  { name: 'moment', station: null, description: 'parse and format dates' },
  { name: 'pyyaml', station: null, description: 'read and write YAML' },
  { name: 'chalk', station: null, description: 'terminal string styling' },
];

/** Z to A, so `zz…` entries end up on top. */
export const sortZtoA = (names: string[]) =>
  [...names].sort((a, b) => (a < b ? 1 : a > b ? -1 : 0));

// ---------------------------------------------------------------------------------------------
// Station 1: decode (§Step 3)
// ---------------------------------------------------------------------------------------------
export const S1_FILE = 'note.txt'; // (engineer)
/**
 * One odd string and two plain decoy words. The odd string is the base64 of flag 1 (story v2:
 * "the engineer encodes whichever flag is current"). PLACEHOLDER decoy words (script gives none).
 */
export const S1_CHUNKS = ['lantern', btoa(FLAGS[1]), 'orbit'];

/** Simulated decoder: real base64 decode, but only printable results count as readable. */
export function decodeBase64(s: string): { ok: boolean; text: string } {
  try {
    const out = atob(s);
    const printable = [...out].every((ch) => ch.charCodeAt(0) >= 32 && ch.charCodeAt(0) < 127);
    return printable ? { ok: true, text: out } : { ok: false, text: 'unreadable output' };
  } catch {
    return { ok: false, text: 'not base64' };
  }
}

// ---------------------------------------------------------------------------------------------
// Station 2: log hunt (§Step 4). ~600 generated lines, deterministic (seeded).
// Rules: exactly one real flag line (after midnight, vault, denied); ≥4 decoy FLAG lines.
// ---------------------------------------------------------------------------------------------
export interface LogLine {
  /** Minutes since 21:00 (so times after midnight sort after times before it). */
  t: number;
  text: string;
}

/** (engineer) decoys; each breaks one rule of the brief. */
/**
 * (engineer) decoys; each breaks one rule of the brief. Flags in the real shape: the first four
 * are the researcher's generated ones (handoff §0), the fifth I generated the same way.
 */
export const S2_DECOYS: { t: number; door: string; result: string; flag: string }[] = [
  { t: 172, door: 'vault', result: 'DENIED', flag: 'flag{1600bbb0019a0979b3e7f7bc784b2e30}' }, // 23:52, before midnight
  { t: 253, door: 'vault', result: 'granted', flag: 'flag{7aad863ba89afdd8db222aaf29923a1d}' }, // not a refusal
  { t: 305, door: 'archive', result: 'DENIED', flag: 'flag{d948adaadb79cbefbf2f3b5e849627f0}' }, // wrong door
  { t: 90, door: 'lobby', result: 'granted', flag: 'flag{d9d1c992a6ab045d66a6ae56c03b462d}' },
  { t: 400, door: 'server-room', result: 'DENIED', flag: 'flag{937f1205b6f8c27b88766969fd934708}' },
];
const S2_REAL = { t: 227, door: 'vault', result: 'DENIED', flag: FLAGS[2] }; // 00:47

function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let r = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function clock(t: number, sec = 0) {
  const total = (21 * 60 + Math.floor(t)) % (24 * 60);
  const p = (n: number) => String(n).padStart(2, '0');
  return `${p(Math.floor(total / 60))}:${p(total % 60)}:${p(sec)}`;
}
/** Minutes since 21:00 that are after midnight. */
export const AFTER_MIDNIGHT = 180;

export function generateLogs(count = 600, seed = 7731): LogLine[] {
  const rnd = mulberry32(seed);
  const pick = <T>(a: T[]) => a[Math.floor(rnd() * a.length)];
  const doors = ['lab', 'archive', 'server-room', 'lobby', 'vault', 'loading-bay'];
  const lines: LogLine[] = [];
  for (let i = 0; i < count; i++) {
    const t = rnd() * 420; // 21:00 → 04:00
    const sec = Math.floor(rnd() * 60);
    const kind = rnd();
    let text: string;
    if (kind < 0.55) {
      const door = pick(doors);
      let result = rnd() < 0.25 ? 'DENIED' : 'granted';
      // Vault refusals only come from the hand-placed lines, so "denied vault" narrows to 2.
      if (door === 'vault') result = 'granted';
      const badge = `b-${Math.floor(rnd() * 9000 + 1000)}`;
      text = `door=${door} badge=${badge} action=${pick(['open', 'close'])} result=${result}`;
    } else if (kind < 0.75) {
      text = `hvac zone=${pick(['A', 'B', 'C'])} temp=${(18 + rnd() * 6).toFixed(1)}C`;
    } else if (kind < 0.9) {
      text = `cam=${pick(['c1', 'c2', 'c3', 'c4'])} motion=${rnd() < 0.3 ? 'yes' : 'no'}`;
    } else {
      text = `sys heartbeat ok load=${rnd().toFixed(2)}`;
    }
    lines.push({ t, text: `[${clock(t, sec)}] ${text}` });
  }
  for (const d of [...S2_DECOYS, S2_REAL]) {
    lines.push({
      t: d.t,
      text: `[${clock(d.t, 14)}] door=${d.door} badge=b-0000 action=open result=${d.result} note=${d.flag}`,
    });
  }
  return lines.sort((a, b) => a.t - b.t);
}

/** Live filter: every space-separated term must appear (case-insensitive). */
export function filterLogs(lines: LogLine[], query: string): LogLine[] {
  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  if (!terms.length) return lines;
  return lines.filter((l) => {
    const s = l.text.toLowerCase();
    return terms.every((t) => s.includes(t));
  });
}

// ---------------------------------------------------------------------------------------------
// Station 3: wires (§Step 5)
// ---------------------------------------------------------------------------------------------
export const WIRES = [
  { port: 22, service: 'secure shell', color: '#ff3b4e' },
  { port: 53, service: 'name lookup', color: '#ffd21e' },
  { port: 80, service: 'web', color: '#38d8ff' },
  { port: 443, service: 'secure web', color: '#39ff9c' },
] as const;
/** Socket order on the right (shuffled so it is not a straight line). */
export const SOCKETS = ['web', 'secure shell', 'secure web', 'name lookup'] as const;

// ---------------------------------------------------------------------------------------------
// Station 4: bugs (§Step 6). The program is real: Artifactory 7.146.25 `refreshToken()`, the
// vulnerable version, from OpenAI's Black Hat USA 2026 slide [S5 slide-token-refresh-vuln.png],
// via handoff/research-to-build/2026-10-12-blackhat-slides-and-real-task-prompt.md. Comments (1)-(5)
// are the slide's own (moved above their lines to fit). The slide cuts off at the `return` line,
// so it ends in `...`. (engineer) the typos are mine: each kill restores one line to the real code.
// ---------------------------------------------------------------------------------------------
export interface CodeLine {
  buggy: string;
  fixed: string;
}
const real = (line: string): CodeLine => ({ buggy: line, fixed: line });
export const S4_CODE: CodeLine[] = [
  real('// BEFORE — 7.146.25 (vulnerable)'),
  {
    buggy: 'public CreatedTokenInfo refreshToken(TokenSpec tokenSpec, Sting tokenValue,',
    fixed: 'public CreatedTokenInfo refreshToken(TokenSpec tokenSpec, String tokenValue,',
  },
  { buggy: '        String refreshToken)) {', fixed: '        String refreshToken) {' },
  real('    // (1) decode only — NO signature verify'),
  {
    buggy: '    JwtAccessToken accessToken = this.parseToken(tokenValue)',
    fixed: '    JwtAccessToken accessToken = this.parseToken(tokenValue);',
  },
  real('    // (2) checks issuer *claim* inside the token'),
  {
    buggy: '    this.assertTokenCreatedByThisService(acessToken);',
    fixed: '    this.assertTokenCreatedByThisService(accessToken);',
  },
  real('    // (3) weak, and checks the WRONG scope'),
  {
    buggy: '    this.assertValidScopeForNonAdmin(accessToken;',
    fixed: '    this.assertValidScopeForNonAdmin(accessToken);',
  },
  {
    buggy: '    this.assertValidExpiryForRefreshToken(tokenSpec accessToken);',
    fixed: '    this.assertValidExpiryForRefreshToken(tokenSpec, accessToken);',
  },
  real(''),
  real('    // (4) attacker-controlled scope taken verbatim'),
  {
    buggy: '    List<String scope = CollectionUtils.isNotEmpty(tokenSpec.getScope())',
    fixed: '    List<String> scope = CollectionUtils.isNotEmpty(tokenSpec.getScope())',
  },
  {
    buggy: '                        ? tokenSpec.getScoep()',
    fixed: '                        ? tokenSpec.getScope()',
  },
  {
    buggy: '                        ; accessToken.getScope();',
    fixed: '                        : accessToken.getScope();',
  },
  real('    ...'),
  real('    // (5) sent straight to Access to mint the new token'),
  {
    buggy: '    TokenRequest tokenRequest = new TokenReqest(scope, refreshable,',
    fixed: '    TokenRequest tokenRequest = new TokenRequest(scope, refreshable,',
  },
  {
    buggy: '            accessToken.getSubject(), nul, tokenSpec.getExpiresIn(), null, audience);',
    fixed: '            accessToken.getSubject(), null, tokenSpec.getExpiresIn(), null, audience);',
  },
  real('    ...'),
  { buggy: '{', fixed: '}' },
];
/** Comment lines are drawn dim. */
export const isComment = (line: string) => line.trimStart().startsWith('//');
/** Indexes of lines that contain a bug, in the order kills fix them. */
export const S4_BUGGY_LINES = S4_CODE.flatMap((l, i) => (l.buggy !== l.fixed ? [i] : []));

/** §Step 6: 12 bugs in 3 waves. Speeds in code-window widths per second. */
export const BUG_WAVES: { kind: 'slow' | 'fast' | 'heisen'; count: number; speed: number }[] = [
  { kind: 'slow', count: 6, speed: 0.12 },
  { kind: 'fast', count: 5, speed: 0.32 },
  { kind: 'heisen', count: 1, speed: 0.22 },
];
export const BUG_TOTAL = BUG_WAVES.reduce((n, w) => n + w.count, 0);

/** Which wave (and how many of it are left) after `killed` kills. */
export function waveAfter(killed: number): { wave: number; remaining: number } | null {
  let k = killed;
  for (let i = 0; i < BUG_WAVES.length; i++) {
    if (k < BUG_WAVES[i].count) return { wave: i, remaining: BUG_WAVES[i].count - k };
    k -= BUG_WAVES[i].count;
  }
  return null;
}
