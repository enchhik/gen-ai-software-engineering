#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  readAgentFile,
  listBugs,
  readSkill,
  buildSystemPrompt,
  buildUserPrompt,
  findBoundaryViolations,
} from './pipeline-lib.js';

const SCRIPTS = path.dirname(fileURLToPath(import.meta.url));
const HW = path.resolve(SCRIPTS, '..');
const REPO = path.resolve(HW, '..');
const AGENTS = path.join(HW, 'agents');
const SKILLS = path.join(HW, 'skills');
const BUGS = path.join(HW, 'context/bugs');
const RUNS = path.join(HW, 'context/runs');

const CHAIN = [
  { file: 'bug-researcher.agent.md',      name: 'bug-researcher',      skills: [] },
  { file: 'research-verifier.agent.md',   name: 'research-verifier',   skills: ['research-quality-measurement'] },
  { file: 'bug-planner.agent.md',         name: 'bug-planner',         skills: [] },
  { file: 'bug-fixer.agent.md',           name: 'bug-fixer',           skills: [] },
  { file: 'security-verifier.agent.md',   name: 'security-verifier',   skills: [] },
  { file: 'unit-test-generator.agent.md', name: 'unit-test-generator', skills: ['unit-tests-FIRST'] },
];

const ALLOWED_TOOLS = {
  'bug-researcher':      'Read,Glob,Grep,Write,Bash',
  'research-verifier':   'Read,Glob,Grep,Write',
  'bug-planner':         'Read,Glob,Grep,Write',
  'bug-fixer':           'Read,Glob,Grep,Write,Edit,Bash',
  'security-verifier':   'Read,Glob,Grep,Write,Bash',
  'unit-test-generator': 'Read,Glob,Grep,Write,Edit,Bash',
};

// Per-agent paths (relative to REPO root, matching git status output).
// Each function receives bugId and returns the allowed write prefix(es).
const ALLOWED_WRITES = {
  'bug-researcher':      (bug) => [`homework-4/context/bugs/${bug}/research/`],
  'research-verifier':   (bug) => [`homework-4/context/bugs/${bug}/research/verified-research.md`],
  'bug-planner':         (bug) => [`homework-4/context/bugs/${bug}/implementation-plan.md`],
  'bug-fixer':           (bug) => [`homework-4/src/`, `homework-4/context/bugs/${bug}/fix-summary.md`],
  'security-verifier':   (bug) => [`homework-4/context/bugs/${bug}/security-report.md`],
  'unit-test-generator': (bug) => [`homework-4/tests/`, `homework-4/context/bugs/${bug}/test-report.md`],
};

function timestamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

function changedPaths() {
  const r = spawnSync('git', ['status', '--porcelain'], {
    cwd: REPO, encoding: 'utf8',
  });
  return (r.stdout || '')
    .split('\n')
    .filter(Boolean)
    .map((line) => line.slice(3)); // strip the 2-char status + space
}

// Diff against a baseline so we only judge what THIS agent touched.
// Pre-existing untracked files (e.g. screenshots, notes, WIP) are ignored
// even if they fall outside the agent's allowed-writes.
function checkBoundary(agentName, bugId, baseline) {
  const allowed = ALLOWED_WRITES[agentName](bugId);
  const newOrChanged = changedPaths().filter((p) => !baseline.has(p));
  return findBoundaryViolations(newOrChanged, allowed);
}

function autoCommit(bugId) {
  const paths = [
    `homework-4/src`,
    `homework-4/tests`,
    `homework-4/context/bugs/${bugId}`,
  ];
  const add = spawnSync('git', ['add', '--', ...paths], { cwd: REPO });
  if (add.status !== 0) return false;
  const msg = `fix(homework-4): apply pipeline-generated fix for ${bugId}\n\nPipeline artifacts: homework-4/context/bugs/${bugId}/`;
  const commit = spawnSync('git', ['commit', '-m', msg], { cwd: REPO, stdio: 'inherit' });
  return commit.status === 0;
}

function runFinalTests(runDir) {
  const r = spawnSync('npm', ['test'], { cwd: HW, encoding: 'utf8' });
  const out = `exit=${r.status}\n\n--- stdout ---\n${r.stdout || ''}\n--- stderr ---\n${r.stderr || ''}`;
  fs.writeFileSync(path.join(runDir, 'final-test-report.txt'), out);
  console.log(`Final npm test exit code: ${r.status}`);
  return r.status === 0;
}

function runAgent(step, bugId, bugRunDir) {
  const { meta, body } = readAgentFile(path.join(AGENTS, step.file));
  const skillBodies = step.skills.map((s) => readSkill(SKILLS, s));
  const systemPrompt = buildSystemPrompt(body, skillBodies);
  const userPrompt = buildUserPrompt(bugId);
  const logPath = path.join(bugRunDir, `${step.name}.log`);
  const logFd = fs.openSync(logPath, 'w');
  console.log(`[${bugId}] ${step.name} (${meta.model}) ...`);
  // Snapshot git status BEFORE the agent runs, so we can later diff
  // and judge only what THIS agent introduced.
  const baseline = new Set(changedPaths());
  const r = spawnSync('claude', [
    '-p', userPrompt,
    '--model', meta.model,
    '--append-system-prompt', systemPrompt,
    '--allowedTools', ALLOWED_TOOLS[step.name],
  ], { cwd: HW, stdio: ['ignore', logFd, logFd] });
  fs.closeSync(logFd);
  if (r.status !== 0) {
    console.error(`[${bugId}] ${step.name} FAILED (exit ${r.status}). See ${logPath}`);
    return false;
  }
  const violations = checkBoundary(step.name, bugId, baseline);
  if (violations.length) {
    console.error(`[${bugId}] ${step.name} BOUNDARY VIOLATION; chain aborted.`);
    console.error('The following paths were written outside the agent\'s allowed scope:');
    for (const v of violations) console.error(`   - ${v}`);
    console.error('No automatic rollback was performed. Inspect manually:');
    console.error('   git status --porcelain');
    console.error('   git diff -- <path>');
    return false;
  }
  return true;
}

function main() {
  const argv = process.argv.slice(2);
  const onlyBug = argv[0] || null;
  const available = listBugs(BUGS);
  const bugs = onlyBug ? [onlyBug] : available;
  if (!bugs.length) {
    console.error('No bugs found under context/bugs/.');
    process.exit(2);
  }
  if (onlyBug && !available.includes(onlyBug)) {
    console.error(`Unknown bug: ${onlyBug}. Available: ${available.join(', ')}`);
    process.exit(2);
  }

  const ts = timestamp();
  const runDir = path.join(RUNS, ts);
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`Run directory: ${runDir}`);

  let anyFailed = false;
  for (const bugId of bugs) {
    const bugRunDir = path.join(runDir, bugId);
    fs.mkdirSync(bugRunDir, { recursive: true });
    let chainOk = true;
    for (const step of CHAIN) {
      if (!runAgent(step, bugId, bugRunDir)) {
        chainOk = false;
        anyFailed = true;
        break;
      }
    }
    if (chainOk) {
      const ok = autoCommit(bugId);
      if (!ok) {
        console.error(`[${bugId}] auto-commit failed; nothing committed.`);
        anyFailed = true;
      } else {
        console.log(`[${bugId}] ✓ committed.`);
      }
    } else {
      console.log(`[${bugId}] ✗ chain incomplete; skipping commit.`);
    }
  }

  // Final all-green verification only makes sense for a complete run.
  const fullRun = bugs.length === available.length;
  if (fullRun) {
    const testsOk = runFinalTests(runDir);
    process.exit(anyFailed || !testsOk ? 1 : 0);
  } else {
    console.log('Partial run; skipping all-green verification.');
    process.exit(anyFailed ? 1 : 0);
  }
}

main();
