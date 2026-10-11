import { createContext, useContext } from 'react';
import { useStore } from 'zustand';
import type { Ch1Actions, Ch1State, Ch1Store } from './store';

export const Ch1Context = createContext<Ch1Store | null>(null);

export function useCh1Store(): Ch1Store {
  const store = useContext(Ch1Context);
  if (!store) throw new Error('useCh1 outside <Ch1Context.Provider>');
  return store;
}

/** Read chapter 1 state in a component (re-renders when the selected value changes). */
export function useCh1<T>(selector: (s: Ch1State & Ch1Actions) => T): T {
  return useStore(useCh1Store(), selector);
}
