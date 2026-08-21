// Inserting links into a post's markdown body.
// Shared by internal linking (/api/apply-link) and citations (/api/cite),
// which previously carried near-identical copies of this logic.

export type LinkResult = { markdown: string; status: "linked" | "already" | "not-found" };

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// Links the FIRST plain-text occurrence of `anchor`. Three things to avoid:
// a phrase already inside a link, headings (Google ignores those), and tables.
// Repeating the same link is spammy, so only the first match is touched.
export function linkFirstOccurrence(markdown: string, anchor: string, href: string): LinkResult {
  if (markdown.includes(`](${href})`)) return { markdown, status: "already" };

  const lines = markdown.split("\n");
  const re = new RegExp(escapeRe(anchor), "i");

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith("#")) continue;
    if (line.trim().startsWith("|")) continue;

    const m = line.match(re);
    if (!m || m.index === undefined) continue;

    // An unbalanced "[" before the match means we're inside an existing link.
    const before = line.slice(0, m.index);
    if ((before.match(/\[/g) ?? []).length > (before.match(/\]/g) ?? []).length) continue;

    const found = m[0]; // keep the original casing
    lines[i] = line.slice(0, m.index) + `[${found}](${href})` + line.slice(m.index + found.length);
    return { markdown: lines.join("\n"), status: "linked" };
  }

  return { markdown, status: "not-found" };
}

// Appends to a "## Sources" list, creating it if absent. Used when the anchor
// phrase isn't in the text, so nothing gets shoehorned in.
export function appendToSources(markdown: string, label: string, href: string): LinkResult {
  if (markdown.includes(href)) return { markdown, status: "already" };

  const entry = `- [${label}](${href})`;
  const lines = markdown.split("\n");
  const heading = lines.findIndex((l) => /^##\s+Sources\s*$/i.test(l));

  if (heading === -1) {
    return { markdown: `${markdown.trimEnd()}\n\n## Sources\n\n${entry}\n`, status: "linked" };
  }

  let end = heading + 1;
  while (end < lines.length && (lines[end].trim() === "" || lines[end].trim().startsWith("-"))) end++;
  lines.splice(end, 0, entry);
  return { markdown: lines.join("\n"), status: "linked" };
}
