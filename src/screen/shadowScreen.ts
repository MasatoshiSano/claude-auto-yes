import { Terminal } from "@xterm/headless";

export type ShadowScreenOptions = {
  readonly cols: number;
  readonly rows: number;
  readonly scrollback: number;
};

export type ShadowScreen = {
  readonly write: (data: string) => Promise<void>;
  readonly readViewport: () => readonly string[];
  readonly resize: (cols: number, rows: number) => void;
  readonly dispose: () => void;
};

export const createShadowScreen = (opts: ShadowScreenOptions): ShadowScreen => {
  const term = new Terminal({
    cols: opts.cols,
    rows: opts.rows,
    scrollback: opts.scrollback,
    allowProposedApi: true,
  });

  const write = (data: string): Promise<void> =>
    new Promise((resolve) => {
      term.write(data, () => resolve());
    });

  const readViewport = (): readonly string[] => {
    const buffer = term.buffer.active;
    const lines: string[] = [];
    for (let i = 0; i < term.rows; i++) {
      const line = buffer.getLine(buffer.baseY + i);
      lines.push(line ? line.translateToString(true) : "");
    }
    return lines;
  };

  const resize = (cols: number, rows: number): void => {
    term.resize(cols, rows);
  };

  const dispose = (): void => {
    term.dispose();
  };

  return { write, readViewport, resize, dispose };
};
