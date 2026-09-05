import { describe, expect, it } from "vitest";
import { upsertProfileBlock, removeProfileBlock, PROFILE_BLOCK } from "../src/setup/psProfile";

describe("upsertProfileBlock", () => {
  it("appends the block to empty content", () => {
    const result = upsertProfileBlock("");
    expect(result).toContain(PROFILE_BLOCK.trim());
  });

  it("does not duplicate the block when it is already present (idempotent)", () => {
    const once = upsertProfileBlock("");
    const twice = upsertProfileBlock(once);
    expect(twice).toBe(once);
  });

  it("preserves unrelated existing profile content", () => {
    const existing = "Set-PSReadLineOption -EditMode Emacs\n";
    const result = upsertProfileBlock(existing);
    expect(result).toContain("Set-PSReadLineOption -EditMode Emacs");
    expect(result).toContain(PROFILE_BLOCK.trim());
  });
});

describe("removeProfileBlock", () => {
  it("removes a previously inserted block and leaves the rest untouched", () => {
    const existing = "Set-PSReadLineOption -EditMode Emacs\n";
    const withBlock = upsertProfileBlock(existing);
    const removed = removeProfileBlock(withBlock);
    expect(removed).toContain("Set-PSReadLineOption -EditMode Emacs");
    expect(removed).not.toContain("claude-auto-yes");
  });

  it("is a no-op when the block is not present", () => {
    const existing = "Set-PSReadLineOption -EditMode Emacs\n";
    expect(removeProfileBlock(existing)).toBe(existing);
  });
});
