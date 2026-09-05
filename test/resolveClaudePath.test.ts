import { describe, expect, it } from "vitest";
import { resolveClaudePath } from "../src/pty/resolveClaudePath";

describe("resolveClaudePath", () => {
  it("prefers an explicit config.claudePath over everything else", () => {
    const result = resolveClaudePath({
      claudePath: "C:\\custom\\claude.exe",
      env: { CLAUDE_CODE_EXECPATH: "C:\\other\\claude.exe" },
      findOnPath: () => "C:\\path\\claude.exe",
    });
    expect(result).toBe("C:\\custom\\claude.exe");
  });

  it("falls back to CLAUDE_CODE_EXECPATH when no explicit path is configured", () => {
    const result = resolveClaudePath({
      claudePath: null,
      env: { CLAUDE_CODE_EXECPATH: "C:\\Users\\masat\\.local\\bin\\claude.exe" },
      findOnPath: () => null,
    });
    expect(result).toBe("C:\\Users\\masat\\.local\\bin\\claude.exe");
  });

  it("falls back to searching PATH for claude.exe/claude.cmd as a last resort", () => {
    const result = resolveClaudePath({
      claudePath: null,
      env: {},
      findOnPath: (name) => (name === "claude.exe" ? "C:\\path\\claude.exe" : null),
    });
    expect(result).toBe("C:\\path\\claude.exe");
  });

  it("throws a clear error when claude cannot be located anywhere", () => {
    expect(() =>
      resolveClaudePath({ claudePath: null, env: {}, findOnPath: () => null }),
    ).toThrow(/claude/i);
  });
});
