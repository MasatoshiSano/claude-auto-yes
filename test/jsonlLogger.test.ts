import { describe, expect, it, afterEach } from "vitest";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { createJsonlLogger } from "../src/log/jsonlLogger";

const tmpDirs: string[] = [];
const makeTmpDir = (): string => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "cly-log-test-"));
  tmpDirs.push(dir);
  return dir;
};

afterEach(() => {
  for (const dir of tmpDirs.splice(0)) {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

describe("createJsonlLogger", () => {
  it("appends one JSON line per log() call to today's dated file", () => {
    const dir = makeTmpDir();
    const now = () => new Date("2026-09-05T10:00:00Z");
    const logger = createJsonlLogger({ dir, retainDays: 30, now });

    logger.log({ event: "session_start", pid: 123 });
    logger.log({ event: "auto_answer", pid: 123 });

    const filePath = path.join(dir, "2026-09-05.jsonl");
    const lines = fs.readFileSync(filePath, "utf8").trim().split("\n");
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0] ?? "{}").event).toBe("session_start");
    expect(JSON.parse(lines[1] ?? "{}").event).toBe("auto_answer");
  });

  it("deletes log files older than retainDays when constructed", () => {
    const dir = makeTmpDir();
    fs.writeFileSync(path.join(dir, "2020-01-01.jsonl"), "{}\n");
    const now = () => new Date("2026-09-05T10:00:00Z");

    createJsonlLogger({ dir, retainDays: 30, now });

    expect(fs.existsSync(path.join(dir, "2020-01-01.jsonl"))).toBe(false);
  });
});
