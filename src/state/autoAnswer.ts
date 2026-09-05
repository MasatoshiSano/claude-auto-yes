import type { Config } from "../config/schema";
import { chooseOption } from "../detect/chooseOption";
import type { AutoAnswerEffect, AutoAnswerEvent, AutoAnswerReduceResult, AutoAnswerState } from "../types";

const sameProgress = (a: AutoAnswerState, effects: readonly AutoAnswerEffect[]): AutoAnswerReduceResult => ({ state: a, effects });

export const reduceAutoAnswer = (
  state: AutoAnswerState,
  event: AutoAnswerEvent,
  config: Config,
): AutoAnswerReduceResult => {
  const { prompt, now } = event;

  if (state.kind === "idle") {
    if (!prompt) return sameProgress(state, []);
    return sameProgress({ kind: "candidate", prompt, stableCount: 1 }, []);
  }

  if (state.kind === "candidate") {
    if (!prompt) return sameProgress({ kind: "idle" }, []);
    if (prompt.fingerprint !== state.prompt.fingerprint) {
      return sameProgress({ kind: "candidate", prompt, stableCount: 1 }, []);
    }
    const stableCount = state.stableCount + 1;
    if (stableCount < config.timing.stabilityChecks) {
      return sameProgress({ kind: "candidate", prompt, stableCount }, []);
    }
    const plan = chooseOption(prompt, config.detect);
    if (!plan) {
      // 肯定選択肢が見つからない(理論上 parsePrompt が弾くはずだが念のため)
      return sameProgress({ kind: "idle" }, []);
    }
    const effect: AutoAnswerEffect = { kind: "sendKeys", keys: plan.keys, prompt };
    return sameProgress({ kind: "waitClear", prompt, sentAt: now, escalations: 0 }, [effect]);
  }

  // state.kind === "waitClear"
  if (!prompt) return sameProgress({ kind: "idle" }, []);
  if (prompt.fingerprint !== state.prompt.fingerprint) {
    return sameProgress({ kind: "candidate", prompt, stableCount: 1 }, []);
  }

  const elapsed = now - state.sentAt;
  if (elapsed < config.timing.escalateAfterMs) {
    return sameProgress(state, []);
  }
  if (state.escalations >= config.response.maxEscalations) {
    if (state.escalations === config.response.maxEscalations) {
      // 上限にちょうど達した直後の1回だけ failure を通知し、以降は静かに諦める
      return sameProgress(
        { kind: "waitClear", prompt, sentAt: state.sentAt, escalations: state.escalations + 1 },
        [{ kind: "escalationFailed", prompt }],
      );
    }
    return sameProgress(state, []);
  }

  const step = config.response.escalationSteps[state.escalations] ?? "\r";
  return sameProgress(
    { kind: "waitClear", prompt, sentAt: now, escalations: state.escalations + 1 },
    [{ kind: "escalate", keys: [step], prompt }],
  );
};
