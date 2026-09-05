import { describe, expect, it } from "vitest";
import { parsePrompt } from "../src/detect/parsePrompt";
import { DEFAULT_CONFIG } from "../src/config/defaults";

const cfg = DEFAULT_CONFIG.detect;

describe("parsePrompt - numbered style (Do you want to proceed? 形式)", () => {
  it("detects a real Bash permission prompt and picks the affirmative option", () => {
    const lines = [
      "╭─────────────────────────────╮",
      "│ Bash command                 │",
      "│ git status                   │",
      "│                               │",
      "│ Do you want to proceed?      │",
      "│ ❯ 1. Yes                     │",
      "│   2. Yes, and don't ask again│",
      "│   3. No                      │",
      "╰─────────────────────────────╯",
    ];
    const view = parsePrompt(lines, cfg);
    expect(view).not.toBeNull();
    expect(view?.style).toBe("numbered");
    expect(view?.options.map((o) => o.label)).toEqual(["Yes", "Yes, and don't ask again", "No"]);
    expect(view?.options[0]?.hasCursor).toBe(true);
  });

  it("returns null when no option has a cursor (stale scrollback residue)", () => {
    const lines = [
      "Do you want to proceed?",
      "  1. Yes",
      "  2. No",
    ];
    expect(parsePrompt(lines, cfg)).toBeNull();
  });

  it("returns null when the numbered list has no affirmative-looking option (e.g. a model picker)", () => {
    const lines = [
      "Which model do you want to use?",
      "❯ 1. Sonnet",
      "  2. Opus",
      "  3. Haiku",
    ];
    expect(parsePrompt(lines, cfg)).toBeNull();
  });

  it("returns null for plain output with no option block", () => {
    const lines = ["Is this a question?", "Just some regular output.", ""];
    expect(parsePrompt(lines, cfg)).toBeNull();
  });
});

describe("parsePrompt - cursor-only style (数字なしの選択リスト。例: フォルダ信頼確認)", () => {
  it("detects a real trust-folder style dialog with no digit prefixes", () => {
    const lines = [
      " Accessing workspace:",
      " C:\\Users\\masat\\projects\\foo",
      " Quick safety check: Is this a project you created or one you trust? (Like your own code, a well-known open",
      " source project, or work from your team). If not, take a moment to review what's in this folder first.",
      " Claude Code'll be able to read, edit, and execute files here.",
      " Security guide",
      " ❯ No, exit",
      "   Yes, I trust this folder",
      " Enter to confirm · Esc to cancel",
    ];
    const view = parsePrompt(lines, cfg);
    expect(view).not.toBeNull();
    expect(view?.style).toBe("cursor-only");
    expect(view?.options.map((o) => o.label)).toEqual(["No, exit", "Yes, I trust this folder"]);
    expect(view?.options[0]?.hasCursor).toBe(true);
    expect(view?.options[1]?.hasCursor).toBe(false);
  });

  it("returns null when no cursor-only option block has an affirmative label", () => {
    const lines = [" ❯ Alpha", "   Beta", "   Gamma"];
    expect(parsePrompt(lines, cfg)).toBeNull();
  });

  it("does not mistake a long wrapped paragraph line for an option", () => {
    const lines = [
      " ❯ Yes, I trust this folder",
      "   This is a very long line of regular prose that just happens to wrap across the terminal width and should not be treated as a selectable option label at all",
    ];
    const view = parsePrompt(lines, cfg);
    // 長い行は候補ブロックの連続性を断ち切るため、2件以上のオプションが揃わずnullになる
    expect(view).toBeNull();
  });
});

describe("parsePrompt - fingerprint", () => {
  it("produces the same fingerprint for identical prompts and a different one when options change", () => {
    const linesA = ["Do you want to proceed?", "❯ 1. Yes", "  2. No"];
    const linesB = ["Do you want to proceed?", "❯ 1. Yes", "  2. No, block"];
    const a1 = parsePrompt(linesA, cfg);
    const a2 = parsePrompt(linesA, cfg);
    const b = parsePrompt(linesB, cfg);
    expect(a1?.fingerprint).toBe(a2?.fingerprint);
    expect(a1?.fingerprint).not.toBe(b?.fingerprint);
  });
});
