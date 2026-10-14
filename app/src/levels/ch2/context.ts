import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { Ch2Actions, Ch2State, Ch2Store } from './store';

export const Ch2Context = createContext<Ch2Store | null>(null);

export function useCh2Store(): Ch2Store {
  const store = useContext(Ch2Context);
  if (!store) throw new Error('useCh2 outside <Ch2Context.Provider>');
  return store;
}

/** Read chapter 2 state in a component (re-renders when the selected value changes). */
export function useCh2<T>(selector: (s: Ch2State & Ch2Actions) => T): T {
  return useStore(useCh2Store(), selector);
}
