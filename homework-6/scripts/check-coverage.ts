import * as fs from 'fs';
import * as path from 'path';

const THRESHOLD = 80;

function main(): void {
  const summaryPath = path.join(__dirname, '..', 'coverage', 'coverage-summary.json');
  if (!fs.existsSync(summaryPath)) {
    console.error(`[coverage-gate] no coverage report at ${summaryPath}. Run: npm run test:cov`);
    process.exit(1);
  }
  const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf-8'));
  const linesPct: number = summary.total.lines.pct;
  if (linesPct < THRESHOLD) {
    console.error(`[coverage-gate] BLOCKED: line coverage ${linesPct}% < ${THRESHOLD}%`);
    process.exit(1);
  }
  console.log(`[coverage-gate] OK: line coverage ${linesPct}% >= ${THRESHOLD}%`);
  process.exit(0);
}

main();
