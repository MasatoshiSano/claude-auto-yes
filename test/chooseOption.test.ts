import { describe, expect, it } from "vitest";
import { chooseOption } from "../src/detect/chooseOption";
import { DEFAULT_CONFIG } from "../src/config/defaults";
import type { PromptView } from "../src/types";

const cfg = DEFAULT_CONFIG.detect;

describe("chooseOption - numbered style", () => {
  it("sends the digit of the first affirmative option", () => {
    const view: PromptView = {
      style: "numbered",
      questionLine: "Do you want to proceed?",
      options: [
        { index: 1, label: "Yes", hasCursor: true },
        { index: 2, label: "Yes, and don't ask again", hasCursor: false },
        { index: 3, label: "No", hasCursor: false },
      ],
      contextLines: [],
      fingerprint: "f1",
    };
    const plan = chooseOption(view, cfg);
    expect(plan).toEqual({ kind: "digit", keys: ["1"] });
  });
});

describe("chooseOption - cursor-only style", () => {
  it("moves the cursor down to the affirmative option and confirms", () => {
    const view: PromptView = {
      style: "cursor-only",
      questionLine: "",
      options: [
        { index: 1, label: "No, exit", hasCursor: true },
        { index: 2, label: "Yes, I trust this folder", hasCursor: false },
      ],
      contextLines: [],
      fingerprint: "f2",
    };
    const plan = chooseOption(view, cfg);
    expect(plan).toEqual({ kind: "arrows", keys: ["\x1b[B", "\r"] });
  });

  it("just confirms when the cursor is already on the affirmative option", () => {
    const view: PromptView = {
      style: "cursor-only",
      questionLine: "",
      options: [
        { index: 1, label: "Yes, I trust this folder", hasCursor: true },
        { index: 2, label: "No, exit", hasCursor: false },
      ],
      contextLines: [],
      fingerprint: "f3",
    };
    const plan = chooseOption(view, cfg);
    expect(plan).toEqual({ kind: "arrows", keys: ["\r"] });
  });

  it("moves the cursor up when the affirmative option is above the current cursor", () => {
    const view: PromptView = {
      style: "cursor-only",
      questionLine: "",
      options: [
        { index: 1, label: "Yes, install", hasCursor: false },
        { index: 2, label: "No, not now", hasCursor: true },
      ],
      contextLines: [],
      fingerprint: "f4",
    };
    const plan = chooseOption(view, cfg);
    expect(plan).toEqual({ kind: "arrows", keys: ["\x1b[A", "\r"] });
  });
});
