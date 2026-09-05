import * as pty from "node-pty";

export type SpawnClaudeOptions = {
  readonly claudePath: string;
  readonly args: readonly string[];
  readonly cwd: string;
  readonly cols: number;
  readonly rows: number;
  readonly env: NodeJS.ProcessEnv;
};

export type ClaudeProcess = {
  readonly onData: (cb: (data: string) => void) => void;
  readonly onExit: (cb: (exitCode: number) => void) => void;
  readonly write: (data: string) => void;
  readonly resize: (cols: number, rows: number) => void;
  readonly kill: () => void;
};

// §7.3: 自己再帰防止の二重の保険その2。子に立てるマーカー。
// (その1は resolveClaudePath がシェルのエイリアスを経由しない絶対パスを得ること)
export const RECURSION_GUARD_ENV_VAR = "CLAUDE_AUTO_YES_ACTIVE";

export const spawnClaude = (opts: SpawnClaudeOptions): ClaudeProcess => {
  const child = pty.spawn(opts.claudePath, [...opts.args], {
    name: "xterm-256color",
    cols: opts.cols,
    rows: opts.rows,
    cwd: opts.cwd,
    // process.env を丸ごと渡す(SystemRoot 等 node-pty が Windows で必要とする値を含む)
    env: { ...opts.env, [RECURSION_GUARD_ENV_VAR]: "1" },
  });

  return {
    onData: (cb) => {
      child.onData(cb);
    },
    onExit: (cb) => {
      child.onExit(({ exitCode }) => cb(exitCode));
    },
    write: (data) => child.write(data),
    resize: (cols, rows) => {
      if (cols > 0 && rows > 0) child.resize(cols, rows);
    },
    kill: () => {
      try {
        child.kill();
      } catch {
        // 既に終了している場合は無視
      }
    },
  };
};
