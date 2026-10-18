import { beforeEach, describe, expect, it } from 'vitest';
import { sanitizeSave, useGame } from './store';

describe('game store', () => {
  beforeEach(() => {
    localStorage.clear();
    useGame.setState({ screen: 'start' });
    useGame.setState((s) => ({
      save: { ...s.save, selectedChapter: 'ch1', selectedModel: 'im1', unlockedModels: [] },
    }));
  });

  it('refuses locked chapters and models', () => {
    expect(useGame.getState().selectChapter('ch3')).toBe(false);
    expect(useGame.getState().selectModel('sol')).toBe(false);
    expect(useGame.getState().save.selectedChapter).toBe('ch1');
  });

  it('allows a model once it is unlocked', () => {
    useGame.setState((s) => ({ save: { ...s.save, unlockedModels: ['sol'] } }));
    expect(useGame.getState().selectModel('sol')).toBe(true);
  });

  it('finishing chapter 1 unlocks the next model (story v2 §Models)', () => {
    useGame.getState().finishChapter('ch1', { message: 'zzhi', installed: ['b64-decoder'] });
    expect(useGame.getState().save.unlockedModels).toEqual(['sol']);
    expect(useGame.getState().save.messages.ch1).toBe('zzhi');
    expect(useGame.getState().save.installed.ch1).toEqual(['b64-decoder']);
    useGame.getState().finishChapter('ch1');
    expect(useGame.getState().save.unlockedModels).toEqual(['sol']);
    expect(useGame.getState().selectModel('sol')).toBe(true);
  });

  it('a chapter can hand a lasting status to the next (Ch2 → poisoned)', () => {
    useGame.getState().finishChapter('ch2', { status: ['poisoned'] });
    useGame.getState().finishChapter('ch2', { status: ['poisoned'] });
    expect(useGame.getState().save.status).toEqual(['poisoned']);
  });

  it('CONTINUE starts the next playable chapter and remounts the game (Julius 2026-10-14)', () => {
    const g = useGame.getState;
    expect(g().nextChapter('ch1')).toBe('ch2');
    expect(g().nextChapter('ch2')).toBe('bridge');
    expect(g().nextChapter('bridge')).toBeNull(); // endings are picked there, never "next"
    const run = g().run;
    expect(g().continueFrom('ch1')).toBe(true);
    expect(g().save.selectedChapter).toBe('ch2');
    expect(g().screen).toBe('game');
    expect(g().run).toBe(run + 1);
    expect(g().continueFrom('bridge')).toBe(false);
    expect(g().save.selectedChapter).toBe('ch2');
  });

  it('start and quit switch screens', () => {
    useGame.getState().startGame();
    expect(useGame.getState().screen).toBe('game');
    useGame.getState().quitToMenu();
    expect(useGame.getState().screen).toBe('start');
  });

  it('sanitizes old or broken saves', () => {
    expect(sanitizeSave(undefined).selectedChapter).toBe('ch1');
    expect(sanitizeSave({ selectedChapter: 'gone', selectedModel: 'sol' })).toMatchObject({
      selectedChapter: 'ch1',
      selectedModel: 'im1',
      unlockedModels: [],
    });
  });

  it('ending 1 is selectable and keeps the best run time', () => {
    expect(useGame.getState().selectChapter('end1')).toBe(true);
    expect(useGame.getState().selectChapter('end2')).toBe(false);
    const rec = useGame.getState().recordBestTime;
    rec('end1', 120.5);
    rec('end1', 130);
    expect(useGame.getState().save.bestTimes.end1).toBe(120.5);
    rec('end1', 99);
    expect(useGame.getState().save.bestTimes.end1).toBe(99);
  });

  it('an older save without best times loads with a default', () => {
    expect(sanitizeSave({ selectedChapter: 'end1' }).bestTimes).toEqual({});
  });
});
