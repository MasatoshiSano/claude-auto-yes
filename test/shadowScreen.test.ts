import { describe, expect, it } from "vitest";
import { createShadowScreen } from "../src/screen/shadowScreen";

describe("createShadowScreen", () => {
  it("reconstructs ANSI-free lines from a real ConPTY-style byte stream (full-screen clear + box)", async () => {
    const screen = createShadowScreen({ cols: 40, rows: 10, scrollback: 100 });
    const data =
      "\x1b[2J\x1b[H" +
      "\x1b[31m╭─ Box ─╮\x1b[0m\r\n" +
      "│ Do you want to proceed? │\r\n" +
      "│ ❯ 1. Yes │\r\n" +
      "│   2. No │\r\n";
    await screen.write(data);
    const lines = screen.readViewport();
    expect(lines[0]).toBe("╭─ Box ─╮");
    expect(lines[1]).toBe("│ Do you want to proceed? │");
    expect(lines[2]).toBe("│ ❯ 1. Yes │");
    expect(lines[3]).toBe("│   2. No │");
    screen.dispose();
  });

  it("reflects the latest state after a full-screen redraw overwrites the previous frame", async () => {
    const screen = createShadowScreen({ cols: 40, rows: 10, scrollback: 100 });
    await screen.write("\x1b[2J\x1b[Hfirst frame\r\n");
    await screen.write("\x1b[2J\x1b[Hsecond frame\r\n");
    const lines = screen.readViewport();
    expect(lines[0]).toBe("second frame");
    expect(lines.join("")).not.toContain("first frame");
    screen.dispose();
  });

  it("returns exactly `rows` lines, padding unused rows with empty strings", async () => {
    const screen = createShadowScreen({ cols: 20, rows: 5, scrollback: 50 });
    await screen.write("only one line\r\n");
    const lines = screen.readViewport();
    expect(lines).toHaveLength(5);
    expect(lines[1]).toBe("");
    screen.dispose();
  });
});
