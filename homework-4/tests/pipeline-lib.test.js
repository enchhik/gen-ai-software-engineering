import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  parseAgentFrontmatter,
  buildSystemPrompt,
  buildUserPrompt,
  findBoundaryViolations,
} from '../scripts/pipeline-lib.js';

test('parseAgentFrontmatter extracts model from YAML frontmatter', () => {
  const text = '---\nmodel: claude-opus-4-7\nrole: Foo\n---\n\n# Foo body';
  const { meta, body } = parseAgentFrontmatter(text);
  assert.equal(meta.model, 'claude-opus-4-7');
  assert.equal(meta.role, 'Foo');
  assert.equal(body.trim(), '# Foo body');
});

test('parseAgentFrontmatter throws when frontmatter is missing', () => {
  assert.throws(() => parseAgentFrontmatter('no frontmatter here'),
    /Missing frontmatter/);
});

test('buildSystemPrompt concatenates agent body and skill bodies with separators', () => {
  const out = buildSystemPrompt('AGENT', ['SKILL_A', 'SKILL_B']);
  assert.match(out, /AGENT/);
  assert.match(out, /SKILL_A/);
  assert.match(out, /SKILL_B/);
  assert.ok(out.indexOf('AGENT') < out.indexOf('SKILL_A'));
  assert.ok(out.indexOf('SKILL_A') < out.indexOf('SKILL_B'));
  assert.match(out, /---/);
});

test('buildSystemPrompt returns just the agent body when no skills', () => {
  assert.equal(buildSystemPrompt('AGENT', []).trim(), 'AGENT');
});

test('buildUserPrompt mentions the bug id and the bug-context path', () => {
  const p = buildUserPrompt('BUG-1');
  assert.match(p, /BUG-1/);
  assert.match(p, /context\/bugs\/BUG-1\/bug-context\.md/);
});

test('buildUserPrompt anchors the working directory to homework-4/', () => {
  const p = buildUserPrompt('BUG-1');
  assert.match(p, /homework-4/);
});

test('buildUserPrompt does NOT say "single output file" (some agents write multiple)', () => {
  const p = buildUserPrompt('BUG-1');
  assert.doesNotMatch(p, /single output file/);
});

test('findBoundaryViolations returns paths not covered by any allowed prefix', () => {
  const allowed = ['homework-4/src/', 'homework-4/context/bugs/BUG-1/fix-summary.md'];
  const changed = [
    'homework-4/src/routes/auth.js',                      // ok (under src/)
    'homework-4/context/bugs/BUG-1/fix-summary.md',       // ok (exact match)
    'homework-4/src/server.js',                            // ok (under src/)
    'homework-4/docs/superpowers/specs/something.md',     // VIOLATION
    'homework-4/.env',                                     // VIOLATION
  ];
  const violations = findBoundaryViolations(changed, allowed);
  assert.deepEqual(violations.sort(), [
    'homework-4/.env',
    'homework-4/docs/superpowers/specs/something.md',
  ]);
});

test('findBoundaryViolations returns empty array when all paths are allowed', () => {
  const allowed = ['homework-4/tests/'];
  const changed = ['homework-4/tests/auth.routes.test.js', 'homework-4/tests/new.test.js'];
  assert.deepEqual(findBoundaryViolations(changed, allowed), []);
});

test('findBoundaryViolations treats empty changed list as no violations', () => {
  assert.deepEqual(findBoundaryViolations([], ['homework-4/src/']), []);
});
