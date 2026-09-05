import fs from "node:fs";
import path from "node:path";

export const findOnPath = (executableName: string, env: NodeJS.ProcessEnv = process.env): string | null => {
  const pathEnv = env.PATH ?? env.Path ?? "";
  for (const dir of pathEnv.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, executableName);
    if (fs.existsSync(candidate)) return candidate;
  }
  return null;
};
