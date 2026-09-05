import type { Config } from "../config/schema";
import type { PromptView, ResponsePlan } from "../types";

export const chooseOption = (view: PromptView, cfg: Config["detect"]): ResponsePlan | null => {
  const affirmativeRe = new RegExp(cfg.affirmativePattern, "i");
  const targetIdx = view.options.findIndex((o) => affirmativeRe.test(o.label));
  if (targetIdx === -1) return null;

  if (view.style === "numbered") {
    return { kind: "digit", keys: [String(view.options[targetIdx]?.index ?? targetIdx + 1)] };
  }

  const cursorIdx = view.options.findIndex((o) => o.hasCursor);
  const delta = cursorIdx === -1 ? 0 : targetIdx - cursorIdx;
  const arrowKey = delta > 0 ? "\x1b[B" : "\x1b[A";
  const arrows = Array.from({ length: Math.abs(delta) }, () => arrowKey);
  return { kind: "arrows", keys: [...arrows, "\r"] };
};
