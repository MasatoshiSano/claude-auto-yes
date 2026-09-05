import fs from "node:fs";
import path from "node:path";

const BEGIN_MARKER = "# --- claude-auto-yes ---";
const END_MARKER = "# --- /claude-auto-yes ---";

export const PROFILE_BLOCK = `${BEGIN_MARKER}
function claude {
    claude-auto-yes @args
}
${END_MARKER}
`;

const blockRe = new RegExp(`${BEGIN_MARKER}[\\s\\S]*?${END_MARKER}\\r?\\n?`, "g");

export const upsertProfileBlock = (content: string): string => {
  if (content.includes(BEGIN_MARKER)) return content;
  const separator = content.length > 0 && !content.endsWith("\n") ? "\n" : "";
  return `${content}${separator}${PROFILE_BLOCK}`;
};

export const removeProfileBlock = (content: string): string => content.replace(blockRe, "");

export const installProfile = (profilePath: string): void => {
  fs.mkdirSync(path.dirname(profilePath), { recursive: true });
  const existing = fs.existsSync(profilePath) ? fs.readFileSync(profilePath, "utf8") : "";
  fs.writeFileSync(profilePath, upsertProfileBlock(existing));
};

export const uninstallProfile = (profilePath: string): void => {
  if (!fs.existsSync(profilePath)) return;
  const existing = fs.readFileSync(profilePath, "utf8");
  fs.writeFileSync(profilePath, removeProfileBlock(existing));
};
