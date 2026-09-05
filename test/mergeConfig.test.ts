import { describe, expect, it } from "vitest";
import { mergeConfig } from "../src/config/load";
import { DEFAULT_CONFIG } from "../src/config/defaults";

describe("mergeConfig", () => {
  it("keeps defaults for keys not present in the override", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { enabled: false });
    expect(merged.enabled).toBe(false);
    expect(merged.detect).toEqual(DEFAULT_CONFIG.detect);
  });

  it("deep-merges nested objects instead of replacing them wholesale", () => {
    const merged = mergeConfig(DEFAULT_CONFIG, { timing: { quiesceMs: 999 } });
    expect(merged.timing.quiesceMs).toBe(999);
    expect(merged.timing.stabilityChecks).toBe(DEFAULT_CONFIG.timing.stabilityChecks);
  });
});
