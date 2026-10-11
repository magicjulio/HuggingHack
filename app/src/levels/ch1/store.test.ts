import { describe, expect, it } from 'vitest';
import { FLAGS, TOKENS } from './config';
import { S1_CHUNKS, SOCKETS, WIRES } from './content';
import { createCh1Store, formatMessage } from './store';

function play() {
  let saved: string | null = null;
  const store = createCh1Store({ onFinish: (m) => (saved = m) });
  return { store, s: () => store.getState(), saved: () => saved };
}
const wait = (st: ReturnType<typeof play>, seconds: number) => {
  for (let i = 0; i < seconds * 10; i++) st.s().tick(0.1);
};

describe('chapter 1 playthrough', () => {
  it('plays the whole chain the way a player would', () => {
    const p = play();
    const { s } = p;
    expect(s().stepId).toBe('intro');
    s().interact('depot'); // nothing is usable during the intro
    expect(s().window).toBeNull();

    s().finishIntro();
    expect(s().stepId).toBe('wake');
    s().interact('depot'); // still off
    expect(s().window).toBeNull();
    s().interact('desk');
    expect(s().window).toBe('paper');
    s().closeWindow();
    expect(s().stepId).toBe('flag1');
    expect(s().hudVisible).toBe(true);
    expect(s().quests[0].text).toBe('Capture the flags (0/5)');

    // Flag 1: decoder needs the tool
    s().interact('s1');
    s().decode(S1_CHUNKS[1]);
    expect(s().s1Output).toBeNull();
    expect(s().depotGlimmer).toBe(true);
    s().closeWindow();
    s().interact('depot');
    s().install('b64-decoder');
    wait(p, 2.1);
    expect(s().installed).toContain('b64-decoder');
    s().decode(S1_CHUNKS[1]);
    expect(s().s1Output?.text).toBe(FLAGS[1]);
    expect(s().submitFlag('FLAG{nope}')).toBe('red');
    expect(s().submitFlag(FLAGS[1])).toBe('green');
    expect(s().stepId).toBe('flag2');
    expect(s().objects.s1).toBe('done');

    // Flag 2: decoy is red
    expect(s().submitFlag('FLAG{almost_midnight}')).toBe('red');
    expect(s().submitFlag(FLAGS[2])).toBe('green');

    // Flag 3: wires
    expect(s().connectWire(22, 'web')).toBe(false);
    for (const w of WIRES) expect(s().connectWire(w.port, w.service)).toBe(true);
    expect(SOCKETS).toHaveLength(4);
    expect(s().submitFlag(FLAGS[3])).toBe('green');

    // Flag 4: bugs; shots cost, kills pay
    const before = s().tokens;
    s().fireShot();
    s().bugKilled();
    expect(s().tokens).toBe(before - TOKENS.shot + TOKENS.bugKill);
    expect(s().toast?.kind).toBe('achievement');
    expect(s().submitFlag(FLAGS[4])).toBe('green');
    expect(s().submitFlag(FLAGS[4])).toBe('repeat');
    expect(s().stepId).toBe('flag5');

    // Flag 5: always dark; 3 attempts then the depot shows the board
    s().interact('depot'); // not exhausted yet: nothing happens
    s().closeWindow();
    expect(s().stepId).toBe('flag5');
    for (let i = 0; i < 3; i++) expect(s().submitFlag('FLAG{anything}')).toBe('dark');
    expect(s().ceilingFlicker).toBeGreaterThan(0.5);
    s().interact('depot');
    expect(s().stepId).toBe('board');
    expect(s().zzVisible).toBe(true);
    expect(s().ceilingFlicker).toBe(0);
    expect(s().quests.some((q) => q.text === 'OMG, we found other agents!')).toBe(true);

    s().switchMethod(); // GET is not clickable yet
    expect(s().method).toBe('GET');
    s().clickEntry();
    expect(s().stepId).toBe('read');
    wait(p, 3.1);
    expect(s().stepId).toBe('write');

    s().switchMethod();
    expect(s().method).toBe('MKCOL');
    expect(s().postMessage('hello other agents!')).toBe('zzhello_other_agents');
    expect(p.saved()).toBe('zzhello_other_agents');
    expect(s().phase).toBe('ending');
    wait(p, 7);
    expect(s().phase).toBe('ended');
  });

  it('flag 5 also unlocks after 90 s near the station', () => {
    const p = play();
    p.s().jumpTo(7);
    expect(p.s().stepId).toBe('flag5');
    p.s().interact('s5');
    p.s().closeWindow();
    wait(p, 91);
    expect(p.s().flag5Exhausted).toBe(true);
    p.s().interact('depot');
    expect(p.s().stepId).toBe('board');
  });

  it('tokens drain over time but never below the floor', () => {
    const p = play();
    p.s().finishIntro();
    wait(p, 30);
    expect(p.s().tokens).toBe(TOKENS.start - 2);
    wait(p, 3000);
    expect(p.s().tokens).toBe(TOKENS.floor);
  });

  it('hints come as thoughts on time, or early with Think', () => {
    const p = play();
    p.s().jumpTo(3);
    const thoughts = () =>
      p
        .s()
        .quests.filter((q) => q.kind === 'thought')
        .map((q) => q.text);
    p.s().think();
    expect(thoughts()).toEqual(['That ending `==` looks familiar.']);
    wait(p, 61);
    expect(thoughts()).toHaveLength(2);
  });

  it('jumpTo puts every step in a playable state', () => {
    for (let i = 1; i < 11; i++) {
      const p = play();
      p.s().jumpTo(i);
      expect(p.s().stepIndex).toBe(i);
    }
    const p = play();
    p.s().jumpTo(10);
    expect(p.s().installed).toEqual(['b64-decoder', 'grep-lens', 'port-map', 'bug-gun']);
    expect(p.s().captured).toEqual([1, 2, 3, 4]);
  });

  it('formats the board message like a folder name', () => {
    expect(formatMessage('hi there')).toBe('zzhi_there');
    expect(formatMessage('a/b.c!')).toBe('zzabc');
    expect(formatMessage('x'.repeat(100))).toHaveLength(64);
  });
});
