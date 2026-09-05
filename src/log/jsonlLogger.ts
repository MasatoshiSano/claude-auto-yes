import fs from "node:fs";
import path from "node:path";

export type JsonlLogger = {
  readonly log: (record: Record<string, unknown>) => void;
};

export type JsonlLoggerOptions = {
  readonly dir: string;
  readonly retainDays: number;
  readonly now?: () => Date;
};

const dateStamp = (d: Date): string => d.toISOString().slice(0, 10);

const cleanupOldFiles = (dir: string, retainDays: number, now: Date): void => {
  const cutoff = now.getTime() - retainDays * 24 * 60 * 60 * 1000;
  for (const entry of fs.readdirSync(dir)) {
    const m = /^(\d{4}-\d{2}-\d{2})\.jsonl$/.exec(entry);
    if (!m || !m[1]) continue;
    const fileTime = Date.parse(`${m[1]}T00:00:00Z`);
    if (fileTime < cutoff) {
      fs.rmSync(path.join(dir, entry), { force: true });
    }
  }
};

export const createJsonlLogger = (opts: JsonlLoggerOptions): JsonlLogger => {
  const now = opts.now ?? (() => new Date());
  fs.mkdirSync(opts.dir, { recursive: true });
  cleanupOldFiles(opts.dir, opts.retainDays, now());

  const log = (record: Record<string, unknown>): void => {
    const filePath = path.join(opts.dir, `${dateStamp(now())}.jsonl`);
    const line = JSON.stringify({ ts: now().toISOString(), ...record });
    fs.appendFileSync(filePath, line + "\n");
  };

  return { log };
};
