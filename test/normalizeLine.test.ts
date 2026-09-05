import { describe, expect, it } from "vitest";
import { normalizeLine } from "../src/detect/normalizeLine";

describe("normalizeLine", () => {
  it("strips leading and trailing box-drawing border characters", () => {
    expect(normalizeLine("│ Do you want to proceed? │", "│┃|╎┆╭╮╰╯─━")).toBe("Do you want to proceed?");
  });

  it("trims surrounding whitespace when there is no border", () => {
    expect(normalizeLine("   ❯ 1. Yes   ", "│┃|╎┆╭╮╰╯─━")).toBe("❯ 1. Yes");
  });

  it("collapses internal runs of whitespace to a single space", () => {
    expect(normalizeLine("Do   you    want to proceed?", "│┃|╎┆╭╮╰╯─━")).toBe("Do you want to proceed?");
  });
});
