import { describe, expect, it } from 'vitest';
import { FLAGS } from './config';
import {
  AFTER_MIDNIGHT,
  BUG_TOTAL,
  S4_BUGGY_LINES,
  decodeBase64,
  filterLogs,
  generateLogs,
  sortZtoA,
  waveAfter,
} from './content';

describe('chapter 1 content', () => {
  it('flag 1 base64 decodes to the flag; decoys do not', () => {
    expect(decodeBase64('RkxBR3t3YWtlX3VwX2FnZW50fQ==')).toEqual({ ok: true, text: FLAGS[1] });
    expect(decodeBase64('lantern').ok).toBe(false);
    expect(decodeBase64('orbit').ok).toBe(false);
  });

  it('logs: ~600 lines, exactly one vault refusal after midnight, carrying the real flag', () => {
    const logs = generateLogs();
    expect(logs.length).toBeGreaterThan(590);
    const real = logs.filter(
      (l) => l.t >= AFTER_MIDNIGHT && l.text.includes('door=vault') && l.text.includes('DENIED'),
    );
    expect(real).toHaveLength(1);
    expect(real[0].text).toContain(FLAGS[2]);
    const flagLines = filterLogs(logs, 'flag{');
    expect(flagLines.length).toBeGreaterThanOrEqual(5); // real + ≥4 decoys
    expect(filterLogs(logs, 'denied vault').length).toBeLessThanOrEqual(3);
  });

  it('logs are deterministic', () => {
    expect(generateLogs()[100].text).toBe(generateLogs()[100].text);
  });

  it('depot sorts Z to A so zz entries come first', () => {
    expect(sortZtoA(['b64-decoder', 'zzHELP', 'port-map'])[0]).toBe('zzHELP');
  });

  it('bugs: 12 total, one buggy line per bug, waves in order', () => {
    expect(BUG_TOTAL).toBe(12);
    expect(S4_BUGGY_LINES).toHaveLength(12);
    expect(waveAfter(0)).toEqual({ wave: 0, remaining: 6 });
    expect(waveAfter(6)).toEqual({ wave: 1, remaining: 5 });
    expect(waveAfter(11)).toEqual({ wave: 2, remaining: 1 });
    expect(waveAfter(12)).toBeNull();
  });
});
