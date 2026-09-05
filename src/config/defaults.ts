import type { Config } from "./schema";

// すべての定数・パターン・タイミング値はここに集約する(ソース中に直書きしない)。
export const DEFAULT_CONFIG: Config = {
  enabled: true,
  claudePath: null,
  enabledCwdPatterns: null,

  detect: {
    // ユーザー方針: 全てのYes/No型ダイアログを対象にするため、
    // 「Do you want to ...?」に限定せず、末尾が "?" の行を質問行とみなす。
    questionPattern: "^.+\\?\\s*$",
    numberedOptionPattern: "^(?<cursor>[❯>])?\\s*(?<index>\\d+)\\.\\s+(?<label>.+?)\\s*$",
    affirmativePattern: "^Yes\\b",
    cursorChars: "❯>",
    borderChars: "│┃|╎┆╭╮╰╯─━",
    requireCursor: true,
    minOptions: 2,
    maxLinesBetweenQuestionAndOptions: 4,
    scanBottomLines: 40,
    maxContextLines: 12,
    maxCursorOnlyLabelLength: 80,
  },

  timing: {
    quiesceMs: 120,
    stabilityChecks: 2,
    postSendCooldownMs: 300,
    escalateAfterMs: 1500,
  },

  response: {
    escalationSteps: ["\r"],
    maxEscalations: 1,
  },

  log: {
    dir: null,
    retainDays: 30,
    includeContext: true,
  },
};
