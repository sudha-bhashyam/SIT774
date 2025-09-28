const fs = require('fs');

function readJSON(p) { try { return JSON.parse(fs.readFileSync(p,'utf8')); } catch { return null; } }

const eslint = readJSON('reports/eslint.json');    // eslint -f json
const jscpd  = readJSON('reports/jscpd/jscpd-report.json'); // jscpd --reporters json

let fail = false;
let unstable = false;

// ---- ESLint thresholds ----
if (eslint) {
  let errors = 0, warnings = 0;
  for (const f of eslint) {
    errors   += (f.errorCount||0);
    warnings += (f.warningCount||0);
  }
  console.log(`ESLint: errors=${errors}, warnings=${warnings}`);
  if (errors > 0) { fail = true; console.error('Quality gate FAIL: ESLint errors > 0'); }
  if (warnings > 10) { unstable = true; console.warn('Quality gate UNSTABLE: ESLint warnings > 10'); }
} else {
  console.warn('No reports/eslint.json found — skipping ESLint gates');
}

// ---- jscpd threshold ----
if (jscpd && jscpd.statistics && jscpd.statistics.total) {
  const pct = Number(jscpd.statistics.total.percentage || 0);
  console.log(`jscpd: duplication=${pct}%`);
  if (pct > 2) { unstable = true; console.warn('Quality gate UNSTABLE: duplication > 2%'); }
} else {
  console.warn('No reports/jscpd/jscpd-report.json found — skipping jscpd gate');
}

// write marker for Jenkins to pick UNSTABLE
if (unstable) fs.writeFileSync('reports/QUALITY_UNSTABLE', '1');

if (fail) process.exit(1); else process.exit(0);
