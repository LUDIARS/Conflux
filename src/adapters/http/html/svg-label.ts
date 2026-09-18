/** Approximate rendered width in em: ASCII is roughly half a full-width (Japanese) glyph. */
function glyphWidth(ch: string): number {
  return (ch.codePointAt(0) ?? 0) < 0x80 ? 0.55 : 1;
}

/**
 * Shortens a label to fit a graph node. The full text stays in the link name and
 * `<title>`, so nothing is lost for keyboard or screen-reader users.
 */
export function truncateLabel(text: string, maxEm: number): string {
  let used = 0;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    used += glyphWidth(chars[i] as string);
    if (used > maxEm) return `${chars.slice(0, Math.max(i - 1, 0)).join('')}…`;
  }
  return text;
}
