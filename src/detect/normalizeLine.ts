export const normalizeLine = (rawLine: string, borderChars: string): string => {
  const borderClass = `[${borderChars.replace(/[\]\\^-]/g, "\\$&")}]`;
  const leading = new RegExp(`^${borderClass}?\\s*`);
  const trailing = new RegExp(`\\s*${borderClass}?$`);
  const stripped = rawLine.replace(leading, "").replace(trailing, "");
  return stripped.trim().replace(/\s+/g, " ");
};
