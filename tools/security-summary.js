/*
 Summarize npm audit + retire.js into:
  - reports/security-summary.md  (human readable)
 Also sets exit code 1 if any High/Critical issues found.
*/
const fs = require('fs');
const path = require('path');

const outDir = 'reports';
const auditPath = path.join(outDir, 'npm-audit.json');
const retirePath = path.join(outDir, 'retire.json');
const summaryPath = path.join(outDir, 'security-summary.md');

function loadJSON(p) {
  try { return JSON.parse(fs.readFileSync(p, 'utf8')); } catch { return null; }
}

const audit = loadJSON(auditPath);
const retire = loadJSON(retirePath);

// ---------- npm audit summary ----------
let auditCounts = { low:0, moderate:0, high:0, critical:0 };
let auditFindings = [];

if (audit) {
  // v10+ summary counts
  if (audit.metadata && audit.metadata.vulnerabilities) {
    const v = audit.metadata.vulnerabilities;
    auditCounts = {
      low: v.low||0, moderate: v.moderate||0, high: v.high||0, critical: v.critical||0
    };
  }
  // Try to extract details from "vulnerabilities" map if present
  if (audit.vulnerabilities && typeof audit.vulnerabilities === 'object') {
    for (const [pkg, info] of Object.entries(audit.vulnerabilities)) {
      const via = Array.isArray(info.via) ? info.via : [];
      via.forEach(v => {
        if (typeof v === 'string') return;
        auditFindings.push({
          tool: 'npm-audit',
          package: pkg,
          severity: (v.severity || info.severity || 'unknown').toLowerCase(),
          id: v.source || v.url || v.name || 'advisory',
          title: v.title || v.name || 'Vulnerability',
          installed: info.range || info.version || 'unknown',
          fixAvailable: (v.fixAvailable && (v.fixAvailable.name ? `${v.fixAvailable.name}@${v.fixAvailable.version}` : v.fixAvailable)) || info.fixAvailable || null,
          url: (v.url || (v.references && v.references[0])) || null
        });
      });
    }
  }
}

// ---------- retire.js summary ----------
let retireFindings = [];
function pickHighestSeverity(a,b){
  const order = ['low','medium','high','critical'];
  return order.indexOf(a) > order.indexOf(b) ? a : b;
}
if (retire && Array.isArray(retire.data)) {
  retire.data.forEach(entry => {
    const results = entry.results || [];
    results.forEach(r => {
      const vulns = r.vulnerabilities || [];
      vulns.forEach(v => {
        const sev = (v.severity || v.severitylevel || 'medium').toLowerCase();
        const id = (v.identifiers && (v.identifiers.summary || v.identifiers.CVE && v.identifiers.CVE[0])) || (v.info && v.info[0]) || 'retire-issue';
        retireFindings.push({
          tool: 'retire',
          package: r.component || r.library || 'unknown',
          severity: sev,
          id,
          title: (v.identifiers && (v.identifiers.summary || v.identifiers.BUG || v.identifiers.issue)) || 'Vulnerable library',
          installed: r.version || 'unknown',
          fixAvailable: (v.fixedin && v.fixedin[0]) || null,
          url: (Array.isArray(v.info) && v.info[0]) || null
        });
      });
    });
  });
}

// ---------- build markdown report ----------
const lines = [];
lines.push('# Security Summary');
lines.push('');
lines.push('## Overall Status');
const totalHighCrit = (auditCounts.high||0) + (auditCounts.critical||0) + retireFindings.filter(f=>['high','critical'].includes(f.severity)).length;
lines.push(`- npm audit: low=${auditCounts.low}, moderate=${auditCounts.moderate}, high=${auditCounts.high}, critical=${auditCounts.critical}`);
lines.push(`- retire.js: findings=${retireFindings.length} (high/critical=${retireFindings.filter(f=>['high','critical'].includes(f.severity)).length})`);
lines.push('');
lines.push('> **Policy:** Fail pipeline if any **High/Critical** vulnerabilities are detected.');
lines.push('');

function section(title, items) {
  if (!items.length) return;
  lines.push(`## ${title}`);
  lines.push('');
  lines.push('| Tool | Package | Severity | Issue | Installed | Fix Available | Link |');
  lines.push('|------|---------|----------|-------|-----------|---------------|------|');
  items.forEach(f=>{
    lines.push(`| ${f.tool} | ${f.package} | ${f.severity} | ${f.title || f.id} | ${f.installed} | ${f.fixAvailable || ''} | ${f.url ? `[ref](${f.url})` : ''} |`);
  });
  lines.push('');
  lines.push('**For submission (address at least the High/Critical):** For each item above, write:');
  lines.push('- What the issue is (short description).');
  lines.push('- Its severity.');
  lines.push('- Whether/how you addressed it (e.g., `npm install <pkg>@<fixed>` or marked as false positive).');
  lines.push('');
}

section('Dependency Vulnerabilities (npm audit)', auditFindings);
section('Library Vulnerabilities (retire.js)', retireFindings);

// write file
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(summaryPath, lines.join('\n'));

const shouldFail = totalHighCrit > 0;
console.log('Security summary written to', summaryPath, '| failOnHighOrCritical =', shouldFail);
process.exit(shouldFail ? 1 : 0);
