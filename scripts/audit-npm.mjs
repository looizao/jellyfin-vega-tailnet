import {spawnSync} from 'node:child_process';
import fs from 'node:fs';
const scan = spawnSync('npm', ['audit', '--json'], {
  encoding: 'utf8',
  maxBuffer: 16 * 1024 * 1024,
});
if (scan.error || scan.status > 1)
  throw new Error('npm audit could not complete');
const report = JSON.parse(scan.stdout);
if (report.error) throw new Error('npm audit returned a registry error');
const exceptions = JSON.parse(
  fs.readFileSync('security/npm-advisories.json', 'utf8'),
);
const known = new Set(exceptions.advisories.map(a => a.url));
const found = new Map();
for (const item of Object.values(report.vulnerabilities ?? {})) {
  for (const advisory of item.via)
    if (typeof advisory === 'object') found.set(advisory.url, advisory.title);
}
const unknown = [...found].filter(([url]) => !known.has(url));
console.log(
  `${found.size} upstream npm advisories; ${unknown.length} outside the documented SDK exceptions.`,
);
for (const [url, title] of unknown) console.error(`${title}: ${url}`);
if (unknown.length) process.exitCode = 1;
