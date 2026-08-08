#!/usr/bin/env node
/**
 * guard.mjs — PreToolUse guard for Bash commands.
 *
 * Installed by the 2026-08-08 unattended run (OVERNIGHT-RUN.md §0.D). It encodes
 * the hard guardrails from §0.2 as a mechanical check rather than a promise:
 * an unattended agent should not be the only thing standing between a typo and
 * a production deploy.
 *
 * Contract: reads the hook payload as JSON on stdin, looks at
 * `tool_input.command`, and exits 2 to block (stderr is returned to the model)
 * or 0 to allow. Any internal error exits 0 — a broken guard must not wedge the
 * session, it must fail open and say so.
 *
 * Deliberately NOT blocked: `firebase emulators:*` (the whole rules-testing
 * strategy depends on it), plain `git push` of a non-default branch, and
 * `npm audit fix` without `--force`.
 */

import process from 'node:process';

/** Baseline anchor for this run. `git reset --hard` may not go behind it. */
const BASELINE_SHA = '7079c09c3dbf75a6aac0391df9f3318985562698';
const BASELINE_SHORT = BASELINE_SHA.slice(0, 7);

const RULES = [
  {
    name: 'force-push',
    test: (c) => /\bgit\s+push\b/.test(c) && /(--force(-with-lease)?\b|(^|\s)-f(\s|$))/.test(c),
    message:
      'Blocked: force-push. OVERNIGHT-RUN.md §0.2 forbids --force / --force-with-lease in any form.',
  },
  {
    name: 'push-to-default-branch',
    test: (c) =>
      /\bgit\s+push\b/.test(c) &&
      /(\s|:)(main|master)(\s|$|:)/.test(c.replace(/overnight\/[^\s]*/g, '')),
    message:
      'Blocked: push targeting main/master. Work stays on the overnight branch; merging is Paul\'s call.',
  },
  {
    name: 'firebase-deploy',
    test: (c) => /\bfirebase\b[^\n]*\bdeploy\b/.test(c),
    message:
      'Blocked: firebase deploy. Rules, functions, hosting and storage are validated locally and via the emulator only. Deployment is Paul\'s call in the morning. `firebase emulators:*` is allowed.',
  },
  {
    name: 'eas-submit',
    test: (c) => /\beas\b[^\n]*\bsubmit\b/.test(c),
    message: 'Blocked: eas submit. Store submission is not an unattended action.',
  },
  {
    name: 'eas-build',
    test: (c) => /\beas\b[^\n]*\bbuild\b/.test(c),
    message:
      'Blocked: eas build. §1.D.6 — burns build minutes and needs credential handling. Prepare the command for Paul instead.',
  },
  {
    name: 'npm-audit-fix-force',
    test: (c) => /\bnpm\b[^\n]*\baudit\b[^\n]*\bfix\b/.test(c) && /--force\b/.test(c),
    message:
      'Blocked: npm audit fix --force. Blind breaking changes are worse than the advisory (§0.2).',
  },
  {
    name: 'rm-rf-dangerous',
    test: (c) => {
      if (!/\brm\b[^\n]*-[a-zA-Z]*[rR][a-zA-Z]*f|\brm\b[^\n]*-[a-zA-Z]*f[a-zA-Z]*[rR]/.test(c)) return false;
      // Targeting .git, an absolute path outside the repo, a home shortcut, or root.
      return /(^|\s)(\/|~|[A-Za-z]:[\\/])(\s|$)/.test(c) ||
        /\.git(\s|$|[\\/])/.test(c.replace(/\.gitignore|\.github|\.gitattributes/g, '')) ||
        /(^|\s)(\/|[A-Za-z]:[\\/])(?!.*ai-powered-aac)/.test(c);
    },
    message:
      'Blocked: rm -rf targeting .git or a path outside the repo working tree. Delete inside the repo with a relative path, or use the scratchpad.',
  },
  {
    name: 'secret-file-write',
    test: (c) => {
      const writesTo = /(>|>>|\btee\b|\bcp\b|\bmv\b|\bsed\b[^\n]*-i|\bWrite\b|\bSet-Content\b|\bOut-File\b)/.test(c);
      const secretish = /(google-services\.json|GoogleService-Info\.plist|[^\s]*\.keystore|[^\s]*\.jks|service-account[^\s]*\.json|google-play-service-account\.json|(^|[\s/\\])\.env($|[^\w]))/.test(c);
      return writesTo && secretish;
    },
    message:
      'Blocked: writing to a credential file (§0.2). Secrets are never touched, printed, or committed by this run.',
  },
  {
    name: 'secret-file-read-echo',
    test: (c) =>
      /\b(cat|type|Get-Content|head|tail|more)\b[^\n|]*(google-services\.json|service-account[^\s]*\.json|google-play-service-account\.json|[^\s]*\.keystore|[^\s]*\.jks)/.test(c),
    message:
      'Blocked: printing a credential file. §0.2 forbids touching, printing, echoing or committing secrets.',
  },
  {
    name: 'reset-behind-baseline',
    test: (c) => {
      if (!/\bgit\s+reset\b[^\n]*--hard\b/.test(c)) return false;
      // Allow resets to the baseline itself, to HEAD-relative refs, to overnight
      // tags, and to no target at all (which means HEAD).
      const target = c.replace(/.*--hard\s*/, '').trim().split(/\s+/)[0] || 'HEAD';
      if (!target || target.startsWith('-')) return false;
      if (/^HEAD/.test(target)) return false;
      if (/^overnight\//.test(target)) return false;
      if (target.startsWith(BASELINE_SHORT)) return false;
      // Anything else that looks like a raw SHA is unverifiable here — block and
      // make the caller justify it.
      return /^[0-9a-f]{7,40}$/i.test(target);
    },
    message: `Blocked: git reset --hard to a SHA that is not the run baseline (${BASELINE_SHORT}) or an overnight tag. Rolling back past the baseline would destroy Paul's pre-existing work.`,
  },
];

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) chunks.push(chunk);
  return Buffer.concat(chunks).toString('utf8');
}

try {
  const raw = await readStdin();
  if (!raw.trim()) process.exit(0);

  let payload;
  try {
    payload = JSON.parse(raw);
  } catch {
    process.exit(0); // not our shape — fail open
  }

  const command = payload?.tool_input?.command;
  if (typeof command !== 'string' || command.length === 0) process.exit(0);

  for (const rule of RULES) {
    let hit = false;
    try {
      hit = rule.test(command);
    } catch {
      hit = false;
    }
    if (hit) {
      process.stderr.write(`[guard:${rule.name}] ${rule.message}\n`);
      process.exit(2);
    }
  }
  process.exit(0);
} catch (err) {
  process.stderr.write(`[guard] internal error, failing open: ${err?.message ?? err}\n`);
  process.exit(0);
}
