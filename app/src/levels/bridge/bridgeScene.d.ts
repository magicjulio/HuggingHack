export function createBridge(
  root: HTMLElement,
  opts?: {
    cancelled?: () => boolean;
    canSkip?: boolean;
    debug?: boolean;
    onPick?: (ending: string) => void;
    onScreen?: (card: import('../../ui/LevelCard').ScreenCard | null) => void;
  },
): Promise<{ dispose(): void }>;
