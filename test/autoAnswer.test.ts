import { describe, expect, it } from "vitest";
import { reduceAutoAnswer } from "../src/state/autoAnswer";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import type { AutoAnswerState, PromptView } from "../src/types";

const cfg = { ...DEFAULT_CONFIG, timing: { ...DEFAULT_CONFIG.timing, stabilityChecks: 2, escalateAfterMs: 1000 }, response: { ...DEFAULT_CONFIG.response, maxEscalations: 1 } };

const makePrompt = (fingerprint: string): PromptView => ({
  style: "numbered",
  questionLine: "Do you want to proceed?",
  options: [
    { index: 1, label: "Yes", hasCursor: true },
    { index: 2, label: "No", hasCursor: false },
  ],
  contextLines: [],
  fingerprint,
});

const sendKeysEffects = (effects: { kind: string }[]) => effects.filter((e) => e.kind === "sendKeys");

describe("reduceAutoAnswer", () => {
  it("does not send until the same prompt has been observed stabilityChecks times", () => {
    const p = makePrompt("a");
    let state: AutoAnswerState = { kind: "idle" };
    let allEffects: { kind: string }[] = [];

    const r1 = reduceAutoAnswer(state, { kind: "scan", prompt: p, now: 0 }, cfg);
    state = r1.state;
    allEffects = allEffects.concat(r1.effects);
    expect(sendKeysEffects(allEffects)).toHaveLength(0);

    const r2 = reduceAutoAnswer(state, { kind: "scan", prompt: p, now: 100 }, cfg);
    state = r2.state;
    allEffects = allEffects.concat(r2.effects);
    expect(sendKeysEffects(allEffects)).toHaveLength(1);
  });

  it("sends exactly once even if the same prompt is scanned 50 times in a row", () => {
    const p = makePrompt("a");
    let state: AutoAnswerState = { kind: "idle" };
    let allEffects: { kind: string }[] = [];
    let now = 0;
    for (let i = 0; i < 50; i++) {
      const r = reduceAutoAnswer(state, { kind: "scan", prompt: p, now }, cfg);
      state = r.state;
      allEffects = allEffects.concat(r.effects);
      now += 50;
    }
    expect(sendKeysEffects(allEffects)).toHaveLength(1);
  });

  it("sends exactly twice when the prompt disappears and the identical prompt reappears later", () => {
    const p = makePrompt("a");
    let state: AutoAnswerState = { kind: "idle" };
    let allEffects: { kind: string }[] = [];
    let now = 0;
    const step = (prompt: PromptView | null) => {
      const r = reduceAutoAnswer(state, { kind: "scan", prompt, now }, cfg);
      state = r.state;
      allEffects = allEffects.concat(r.effects);
      now += 50;
    };

    step(p);
    step(p); // stability reached -> sent (1st)
    step(p); // still visible, in waitClear
    step(null); // cleared -> back to idle
    step(p);
    step(p); // stability reached again -> sent (2nd)

    expect(sendKeysEffects(allEffects)).toHaveLength(2);
  });

  it("does not send if the prompt disappears before reaching stability", () => {
    const p = makePrompt("a");
    let state: AutoAnswerState = { kind: "idle" };
    let allEffects: { kind: string }[] = [];
    let now = 0;
    const step = (prompt: PromptView | null) => {
      const r = reduceAutoAnswer(state, { kind: "scan", prompt, now }, cfg);
      state = r.state;
      allEffects = allEffects.concat(r.effects);
      now += 50;
    };

    step(p); // candidate, stableCount 1
    step(null); // disappears before 2nd confirmation
    expect(sendKeysEffects(allEffects)).toHaveLength(0);
    expect(state.kind).toBe("idle");
  });

  it("escalates after escalateAfterMs if the prompt is still on screen, but never exceeds maxEscalations", () => {
    const p = makePrompt("a");
    let state: AutoAnswerState = { kind: "idle" };
    let allEffects: { kind: string }[] = [];

    const r1 = reduceAutoAnswer(state, { kind: "scan", prompt: p, now: 0 }, cfg);
    state = r1.state;
    const r2 = reduceAutoAnswer(state, { kind: "scan", prompt: p, now: 100 }, cfg);
    state = r2.state; // sent at t=100

    // まだ画面に残ったまま時間が経過 (escalateAfterMs=1000 を超過)
    for (let now = 200; now <= 5000; now += 200) {
      const r = reduceAutoAnswer(state, { kind: "scan", prompt: p, now }, cfg);
      state = r.state;
      allEffects = allEffects.concat(r.effects);
    }

    const escalations = allEffects.filter((e) => e.kind === "escalate");
    expect(escalations.length).toBeLessThanOrEqual(1);
    const failed = allEffects.filter((e) => e.kind === "escalationFailed");
    expect(failed).toHaveLength(1);
  });
});
