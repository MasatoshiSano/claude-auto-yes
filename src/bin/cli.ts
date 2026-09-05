#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { execFileSync } from "node:child_process";
import { loadConfig, mergeConfig } from "../config/load";
import { resolveAppPaths } from "../config/paths";
import { createJsonlLogger } from "../log/jsonlLogger";
import { runSession } from "../session/run";
import { installProfile, uninstallProfile } from "../setup/psProfile";
import { RECURSION_GUARD_ENV_VAR } from "../pty/spawnClaude";
import { resolveClaudePath } from "../pty/resolveClaudePath";
import { findOnPath } from "../pty/findOnPath";

// $PROFILE の実体は "Documents\PowerShell\..." とは限らない
// (Windows PowerShell 5.1 は "WindowsPowerShell"、OneDrive でリダイレクトされた
// ドキュメントフォルダの場合はパスも変わる)。ハードコードせず、実際のシェルに
// $PROFILE を問い合わせて解決する。Windows PowerShell (powershell.exe) と
// PowerShell 7+ (pwsh.exe) の両方がインストールされていれば両方を対象にする。
//
// 注意: execFileSync で標準出力を直接 "utf8" として読むと、日本語環境の
// Windows PowerShell 5.1 はコンソールへの非対話出力を OS のANSI/OEMコードページ
// (例: CP932) で書き出すため文字化けする。パスに日本語が含まれる場合、化けた
// 文字列でファイルを書き込んでしまい、意図しない場所に新規ファイル/フォルダを
// 作成する重大なバグになる(実機で発生を確認済み)。
// そのため標準出力を経由せず、明示的に UTF-8 を指定した一時ファイル経由で
// 値を受け渡す。
const queryProfilePath = (exe: string): string | null => {
  const tmpFile = path.join(os.tmpdir(), `claude-auto-yes-profile-${crypto.randomUUID()}.txt`);
  try {
    execFileSync(exe, ["-NoProfile", "-Command", `$PROFILE | Out-File -LiteralPath '${tmpFile}' -Encoding utf8`], {
      stdio: "ignore",
    });
    if (!fs.existsSync(tmpFile)) return null;
    const withBom = fs.readFileSync(tmpFile, "utf8");
    const withoutBom = withBom.charCodeAt(0) === 0xfeff ? withBom.slice(1) : withBom;
    const raw = withoutBom.trim();
    return raw.length > 0 ? raw : null;
  } catch {
    return null;
  } finally {
    try {
      fs.unlinkSync(tmpFile);
    } catch {
      // 一時ファイルが存在しない場合は無視
    }
  }
};

const resolveProfilePaths = (): readonly string[] => {
  const candidates = [queryProfilePath("powershell.exe"), queryProfilePath("pwsh.exe")];
  return [...new Set(candidates.filter((p): p is string => p !== null))];
};

const setEnabled = (env: NodeJS.ProcessEnv, enabled: boolean): void => {
  const paths = resolveAppPaths(env);
  fs.mkdirSync(path.dirname(paths.configFile), { recursive: true });
  const existing = fs.existsSync(paths.configFile) ? JSON.parse(fs.readFileSync(paths.configFile, "utf8")) : {};
  const updated = { ...existing, enabled };
  fs.writeFileSync(paths.configFile, JSON.stringify(updated, null, 2));
};

const printStatus = (env: NodeJS.ProcessEnv): void => {
  const config = loadConfig(env);
  const paths = resolveAppPaths(env);
  console.log(`enabled: ${config.enabled}`);
  console.log(`config file: ${paths.configFile}`);
  console.log(`log dir: ${config.log.dir ?? paths.logDir}`);
};

const printLog = (env: NodeJS.ProcessEnv, args: readonly string[]): void => {
  const config = loadConfig(env);
  const paths = resolveAppPaths(env);
  const dir = config.log.dir ?? paths.logDir;
  const raw = args.includes("--raw");
  if (!fs.existsSync(dir)) {
    console.log("(ログはまだありません)");
    return;
  }
  const files = fs.readdirSync(dir).filter((f) => f.endsWith(".jsonl")).sort();
  for (const file of files) {
    const content = fs.readFileSync(path.join(dir, file), "utf8");
    for (const line of content.trim().split("\n").filter(Boolean)) {
      console.log(raw ? line : `[${file}] ${line}`);
    }
  }
};

const runInstall = (uninstall: boolean): void => {
  const profilePaths = resolveProfilePaths();
  if (profilePaths.length === 0) {
    console.error("PowerShell の $PROFILE を解決できませんでした(powershell.exe / pwsh.exe が見つかりません)。");
    process.exitCode = 1;
    return;
  }
  for (const profilePath of profilePaths) {
    if (uninstall) {
      uninstallProfile(profilePath);
      console.log(`PowerShell プロファイルから claude-auto-yes を削除しました: ${profilePath}`);
    } else {
      installProfile(profilePath);
      console.log(`PowerShell プロファイルに claude-auto-yes を追加しました: ${profilePath}`);
    }
  }
  if (!uninstall) {
    console.log("新しいタブ/ターミナルを開くと `claude` コマンドが自動で有効になります。");
  }
};

const runDefault = async (args: readonly string[]): Promise<number> => {
  if (process.env[RECURSION_GUARD_ENV_VAR] === "1") {
    // 自己再帰防止: 既にラップ済みのセッションからの再帰起動は素通しする。
    const claudePath = resolveClaudePath({ claudePath: null, env: process.env, findOnPath: (n) => findOnPath(n) });
    const { spawnSync } = await import("node:child_process");
    const result = spawnSync(claudePath, args, { stdio: "inherit" });
    return result.status ?? 1;
  }

  // claude-auto-yes 自身の制御フラグと、claude.exe にそのまま渡す引数を分離する。
  // これを忘れると `claude -p "..."` や既存の `yolo`(--dangerously-skip-permissions)
  // のような引数付き呼び出しが、引数を失ったまま起動してしまう(実機で発生を確認済み)。
  const WRAPPER_ONLY_FLAGS = new Set(["--dry-run", "--verbose", "--no-auto"]);
  const dryRun = args.includes("--dry-run");
  const verbose = args.includes("--verbose");
  const claudeArgs = args.filter((a) => !WRAPPER_ONLY_FLAGS.has(a));
  const config = args.includes("--no-auto")
    ? mergeConfig(loadConfig(process.env), { enabled: false })
    : loadConfig(process.env);
  const paths = resolveAppPaths(process.env);
  const logger = createJsonlLogger({ dir: config.log.dir ?? paths.logDir, retainDays: config.log.retainDays });
  logger.log({ event: "session_start", cwd: process.cwd(), enabled: config.enabled, pid: process.pid });
  const exitCode = await runSession(config, logger, { dryRun, verbose, claudeArgs });
  logger.log({ event: "session_end", exitCode });
  return exitCode;
};

const main = async (): Promise<void> => {
  const [, , command, ...rest] = process.argv;

  switch (command) {
    case "on":
      setEnabled(process.env, true);
      console.log("claude-auto-yes: enabled");
      return;
    case "off":
      setEnabled(process.env, false);
      console.log("claude-auto-yes: disabled");
      return;
    case "status":
      printStatus(process.env);
      return;
    case "log":
      printLog(process.env, rest);
      return;
    case "install":
      runInstall(false);
      return;
    case "uninstall":
      runInstall(true);
      return;
    default: {
      const args = command === undefined ? [] : [command, ...rest];
      const exitCode = await runDefault(args);
      process.exitCode = exitCode;
    }
  }
};

main().catch((err) => {
  console.error("[claude-auto-yes] fatal error:", err);
  process.exitCode = 1;
});
