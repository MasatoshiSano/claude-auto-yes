import fs from "node:fs";
import { ConfigSchema, type Config } from "./schema";
import { DEFAULT_CONFIG } from "./defaults";
import { resolveAppPaths } from "./paths";

type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] };

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

export const mergeConfig = (base: Config, override: DeepPartial<Config>): Config => {
  const result: Record<string, unknown> = { ...base };
  for (const [key, value] of Object.entries(override)) {
    const baseValue = (base as Record<string, unknown>)[key];
    if (isPlainObject(value) && isPlainObject(baseValue)) {
      result[key] = mergeConfig(baseValue as Config, value as DeepPartial<Config>);
    } else if (value !== undefined) {
      result[key] = value;
    }
  }
  return result as Config;
};

const readConfigFile = (filePath: string): DeepPartial<Config> => {
  if (!fs.existsSync(filePath)) return {};
  try {
    const raw = JSON.parse(fs.readFileSync(filePath, "utf8"));
    return isPlainObject(raw) ? (raw as DeepPartial<Config>) : {};
  } catch {
    return {};
  }
};

const readEnvOverrides = (env: NodeJS.ProcessEnv): DeepPartial<Config> => {
  const override: DeepPartial<Config> = {};
  if (env.CLAUDE_AUTO_YES === "0") override.enabled = false;
  if (env.CLAUDE_AUTO_YES === "1") override.enabled = true;
  return override;
};

export const loadConfig = (env: NodeJS.ProcessEnv = process.env): Config => {
  const paths = resolveAppPaths(env);
  const fromFile = readConfigFile(paths.configFile);
  const fromEnv = readEnvOverrides(env);
  const merged = mergeConfig(mergeConfig(DEFAULT_CONFIG, fromFile), fromEnv);
  const parsed = ConfigSchema.safeParse(merged);
  return parsed.success ? parsed.data : DEFAULT_CONFIG;
};

// 実行中セッションへのキルスイッチ即時反映。config.json の変更を監視し、
// enabled の値が変わったら通知する(§7.4)。
export const watchEnabledFlag = (
  env: NodeJS.ProcessEnv,
  onChange: (enabled: boolean) => void,
): (() => void) => {
  const paths = resolveAppPaths(env);
  if (!fs.existsSync(paths.configFile)) return () => {};
  const watcher = fs.watch(paths.configFile, { persistent: false }, () => {
    onChange(loadConfig(env).enabled);
  });
  return () => watcher.close();
};
