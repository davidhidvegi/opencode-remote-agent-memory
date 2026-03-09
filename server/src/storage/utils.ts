import * as yaml from "js-yaml";

export function parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
  const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!match) {
    return { frontmatter: {}, body: content };
  }
  const frontmatter = yaml.load(match[1]) as Record<string, unknown> || {};
  const body = match[2];
  return { frontmatter, body };
}

export function buildFrontmatter(frontmatter: Record<string, unknown>): string {
  return `---\n${yaml.dump(frontmatter)}---`;
}
