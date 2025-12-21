const fs = require('fs');
const path = require('path');

const logPath = path.join(process.cwd(), 'SESSION_LOG.md');
const now = new Date();
const iso = now.toISOString();
const date = iso.slice(0, 10);
const args = process.argv.slice(2);

let mode = 'manual';
if (args[0] === '--auto') {
  mode = 'auto';
  args.shift();
}

const summary = args.join(' ').trim() || (mode === 'auto'
  ? 'Auto-log from git hook (no summary provided).'
  : 'No summary provided.');

const entry = `- ${date} — ${summary}\n`;

if (!fs.existsSync(logPath)) {
  fs.writeFileSync(
    logPath,
    '# Session Log\n\n' +
    '**Governance sentence:** Every session must append one entry that includes intent, changes, verification, and next steps. If verification was skipped, say why.\n\n' +
    '## Entries\n\n'
  );
}

fs.appendFileSync(logPath, entry);
console.log(`Appended session log entry (${mode}).`);
