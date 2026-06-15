import fs from 'node:fs';
import path from 'node:path';

export function parseAgentFrontmatter(text) {
  const m = text.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  if (!m) throw new Error('Missing frontmatter');
  const meta = {};
  for (const line of m[1].split('\n')) {
    const mm = line.match(/^(\w+):\s*(.+)$/);
    if (mm) meta[mm[1]] = mm[2].trim();
  }
  return { meta, body: m[2] };
}

export function readAgentFile(agentPath) {
  const text = fs.readFileSync(agentPath, 'utf8');
  return parseAgentFrontmatter(text);
}

export function listBugs(bugRoot) {
  return fs.readdirSync(bugRoot)
    .filter((name) => {
      const p = path.join(bugRoot, name);
      return fs.statSync(p).isDirectory()
        && fs.existsSync(path.join(p, 'bug-context.md'));
    })
    .sort();
}

export function readSkill(skillsDir, name) {
  return fs.readFileSync(path.join(skillsDir, `${name}.md`), 'utf8');
}

export function buildSystemPrompt(agentBody, skillBodies) {
  const parts = [agentBody.trimEnd()];
  for (const s of skillBodies) {
    parts.push('---', s.trimEnd());
  }
  return parts.join('\n\n');
}

export function buildUserPrompt(bugId) {
  return [
    `You are part of the homework-4 pipeline. Current bug: ${bugId}.`,
    `Your working directory is homework-4/; all relative paths in your role`,
    `description and any file you read or write are resolved against it.`,
    `Bug context: \`context/bugs/${bugId}/bug-context.md\`.`,
    `Operate strictly within your role and path restrictions described in`,
    `your system prompt. When done, write the output(s) described in your role and exit cleanly.`,
  ].join(' ');
}

export function findBoundaryViolations(changedPaths, allowedPrefixes) {
  return changedPaths.filter(
    (p) => !allowedPrefixes.some((prefix) => p === prefix || p.startsWith(prefix))
  );
}
