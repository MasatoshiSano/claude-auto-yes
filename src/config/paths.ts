import path from "node:path";

export type AppPaths = {
  readonly configFile: string;
  readonly logDir: string;
};

export const resolveAppPaths = (env: NodeJS.ProcessEnv): AppPaths => {
  const appData = env.APPDATA ?? path.join(env.USERPROFILE ?? ".", "AppData", "Roaming");
  const localAppData = env.LOCALAPPDATA ?? path.join(env.USERPROFILE ?? ".", "AppData", "Local");
  return {
    configFile: env.CLAUDE_AUTO_YES_CONFIG ?? path.join(appData, "claude-auto-yes", "config.json"),
    logDir: env.CLAUDE_AUTO_YES_LOG_DIR ?? path.join(localAppData, "claude-auto-yes", "logs"),
  };
};
