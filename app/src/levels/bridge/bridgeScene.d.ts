export function createBridge(
  root: HTMLElement,
  opts?: { canSkip?: boolean; debug?: boolean; onPick?: (ending: string) => void },
): Promise<{ dispose(): void }>;
