export type StdinBridge = {
  readonly dispose: () => void;
};

// §12.3-1: raw mode は exit / uncaughtException / unhandledRejection / SIGTERM / SIGHUP
// すべてで確実に復元する。ここを落とすとユーザーの実ターミナルが壊れる。
export const createStdinBridge = (stdin: NodeJS.ReadStream, onData: (chunk: string) => void): StdinBridge => {
  const wasRaw = stdin.isTTY ? stdin.isRaw ?? false : false;
  if (stdin.isTTY) stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding("utf8");

  const listener = (chunk: string): void => onData(chunk);
  stdin.on("data", listener);

  let disposed = false;
  const dispose = (): void => {
    if (disposed) return;
    disposed = true;
    stdin.off("data", listener);
    if (stdin.isTTY) {
      try {
        stdin.setRawMode(wasRaw);
      } catch {
        // ターミナルが既に閉じている場合は無視
      }
    }
    stdin.pause();
  };

  const restoreHandlers = ["exit", "SIGTERM", "SIGHUP", "uncaughtException", "unhandledRejection"] as const;
  for (const signal of restoreHandlers) {
    process.once(signal, dispose);
  }

  return { dispose };
};
