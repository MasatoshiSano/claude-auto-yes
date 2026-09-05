export type ResolveClaudePathInput = {
  readonly claudePath: string | null;
  readonly env: NodeJS.ProcessEnv;
  readonly findOnPath: (executableName: string) => string | null;
};

export const resolveClaudePath = ({ claudePath, env, findOnPath }: ResolveClaudePathInput): string => {
  if (claudePath) return claudePath;
  if (env.CLAUDE_CODE_EXECPATH) return env.CLAUDE_CODE_EXECPATH;
  const fromExe = findOnPath("claude.exe");
  if (fromExe) return fromExe;
  const fromCmd = findOnPath("claude.cmd");
  if (fromCmd) return fromCmd;
  throw new Error(
    "claude の実体が見つかりませんでした。config.claudePath を設定するか、PATH に claude.exe を通してください。",
  );
};
