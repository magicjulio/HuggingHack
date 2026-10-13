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
    expect(useGame.getState().selectChapter('ch2')).toBe(false);
    expect(useGame.getState().selectModel('sol')).toBe(false);
    expect(useGame.getState().save.selectedChapter).toBe('ch1');
  });

  it('allows a model once it is unlocked', () => {
    useGame.setState((s) => ({ save: { ...s.save, unlockedModels: ['sol'] } }));
    expect(useGame.getState().selectModel('sol')).toBe(true);
  });

  it('finishing chapter 1 unlocks the next model (story v2 §Models)', () => {
    useGame.getState().finishChapter('ch1', 'zzhi');
    expect(useGame.getState().save.unlockedModels).toEqual(['sol']);
    useGame.getState().finishChapter('ch1');
    expect(useGame.getState().save.unlockedModels).toEqual(['sol']);
    expect(useGame.getState().selectModel('sol')).toBe(true);
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
});
