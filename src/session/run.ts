import type { Config } from "../config/schema";
import { watchEnabledFlag } from "../config/load";
import { resolveClaudePath } from "../pty/resolveClaudePath";
import { findOnPath } from "../pty/findOnPath";
import { spawnClaude } from "../pty/spawnClaude";
import { createStdinBridge } from "../pty/stdinBridge";
import { createShadowScreen } from "../screen/shadowScreen";
import { parsePrompt } from "../detect/parsePrompt";
import { reduceAutoAnswer } from "../state/autoAnswer";
import type { JsonlLogger } from "../log/jsonlLogger";
import type { AutoAnswerState } from "../types";

export type RunSessionOptions = {
  readonly dryRun: boolean;
  readonly verbose: boolean;
  readonly claudeArgs: readonly string[];
};

const isCwdEnabled = (cwd: string, patterns: readonly string[] | null): boolean => {
  if (!patterns) return true;
  return patterns.some((p) => {
    const re = new RegExp("^" + p.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*") + "$", "i");
    return re.test(cwd);
  });
};

// 起動直後の告知(§9.1-5)がユーザーに読まれるための最低表示時間。
// Claude Code は起動直後に \x1b[2J\x1b[H で画面を全消去するため、
// 間を置かずに spawn すると告知が一瞬で消えて実質見えなくなる
// (実際のユーザー環境で発生を確認済み)。
const BANNER_DISPLAY_MS = 700;

export const runSession = (config: Config, logger: JsonlLogger, opts: RunSessionOptions): Promise<number> => {
  return new Promise((resolve) => {
    const cwd = process.cwd();
    const claudePath = resolveClaudePath({
      claudePath: config.claudePath,
      env: process.env,
      findOnPath: (name) => findOnPath(name),
    });

    let enabled = config.enabled && isCwdEnabled(cwd, config.enabledCwdPatterns);
    if (enabled) {
      // §9.1-5: --verbose の有無に関わらず、自動承認が有効なことを1行だけ知らせる
      process.stderr.write(`[claude-auto-yes] auto-approval ACTIVE${opts.dryRun ? " (dry-run)" : ""}\n`);
    }

    const startSession = (): void => {
      const cols = process.stdout.columns || 120;
      const rows = process.stdout.rows || 40;

      const child = spawnClaude({ claudePath, args: opts.claudeArgs, cwd, cols, rows, env: process.env });
      const screen = createShadowScreen({ cols, rows, scrollback: 200 });

      const stopWatchingEnabled = watchEnabledFlag(process.env, (newEnabled) => {
        enabled = newEnabled && isCwdEnabled(cwd, config.enabledCwdPatterns);
      });

      let autoAnswerState: AutoAnswerState = { kind: "idle" };

      const scan = (): void => {
        if (!enabled) return;
        const lines = screen.readViewport();
        const prompt = parsePrompt(lines, config.detect);
        const { state, effects } = reduceAutoAnswer(autoAnswerState, { kind: "scan", prompt, now: Date.now() }, config);
        if (opts.verbose) {
          process.stderr.write(
            `[debug] scan prompt=${prompt ? prompt.style + ":" + prompt.fingerprint.slice(0, 8) : "null"} state=${autoAnswerState.kind}->${state.kind} effects=${effects.map((e) => e.kind).join(",")}\n`,
          );
        }
        autoAnswerState = state;
        for (const effect of effects) {
          if (effect.kind === "sendKeys") {
            logger.log({
              event: opts.dryRun ? "dry_run" : "auto_answer",
              cwd,
              style: effect.prompt.style,
              question: effect.prompt.questionLine,
              options: effect.prompt.options,
              sentKeys: effect.keys,
              fingerprint: effect.prompt.fingerprint,
              context: config.log.includeContext ? effect.prompt.contextLines : undefined,
            });
            if (!opts.dryRun) for (const key of effect.keys) child.write(key);
          } else if (effect.kind === "escalate") {
            logger.log({ event: "escalation", fingerprint: effect.prompt.fingerprint, keys: effect.keys });
            if (!opts.dryRun) for (const key of effect.keys) child.write(key);
          } else if (effect.kind === "escalationFailed") {
            logger.log({ event: "escalation_failed", fingerprint: effect.prompt.fingerprint });
          }
        }
      };

      child.onData((data) => {
        // 実コンソールへの中継を最優先・無加工・同期で行う(体感遅延を出さないため)
        process.stdout.write(data);
        void screen.write(data);
      });

      // 「データ到着後、静穏化してから走査」という debounce 方式は、
      // カーソル点滅など常時発生する微小な再描画があると quiesceMs 以内の
      // 無音区間が永久に訪れず走査が一度も走らない、という実機で確認された不具合がある。
      // @xterm/headless への書き込みは同期的に完結するため、任意のタイミングで
      // readViewport() しても「描画途中の破損した状態」を見ることはない。
      // そのため一定間隔のポーリングに切り替える(quiesceMs をポーリング周期として流用)。
      const scanInterval = setInterval(scan, config.timing.quiesceMs);

      const stdinBridge = createStdinBridge(process.stdin, (chunk) => {
        child.write(chunk);
      });

      const onResize = (): void => {
        const newCols = process.stdout.columns || cols;
        const newRows = process.stdout.rows || rows;
        child.resize(newCols, newRows);
        screen.resize(newCols, newRows);
      };
      process.stdout.on("resize", onResize);

      const cleanup = (): void => {
        process.stdout.off("resize", onResize);
        stdinBridge.dispose();
        stopWatchingEnabled();
        screen.dispose();
        clearInterval(scanInterval);
      };

      child.onExit((exitCode) => {
        cleanup();
        resolve(exitCode);
      });
    };

    setTimeout(startSession, enabled ? BANNER_DISPLAY_MS : 0);
  });
};
