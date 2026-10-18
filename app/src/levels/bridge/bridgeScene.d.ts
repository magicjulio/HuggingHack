export function createBridge(
  root: HTMLElement,
  opts?: {
    cancelled?: () => boolean;
    canSkip?: boolean;
    debug?: boolean;
    onPick?: (ending: string) => void;
  },
): Promise<{ dispose(): void }>;
