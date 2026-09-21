#!/usr/bin/env node
// One-shot driver for the arc-studio skill. The model runs this and stops.
// It writes memory/arc-studio.json itself, so a later run can attach.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = process.cwd();
const STATE_BIN = path.join(path.dirname(fileURLToPath(import.meta.url)), 'arc-studio-state.mjs');
const SESSION = 'aeon-arc';
const PREAMBLE = [
  'Arc testnet only. Do not deploy to mainnet.',
  'Do not ask for a secret, a seed phrase, or a private key.',
].join(' ');

function scrub(value) {
  return String(value || '')
    .replace(/origin_pat_[A-Za-z0-9._-]+/g, '[token]')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, 400);
}

function stateCmd(args) {
  return spawnSync(process.execPath, [STATE_BIN, ...args], {
    cwd: ROOT,
    encoding: 'utf8',
  });
}

function show() {
  const res = stateCmd(['show']);
  if (res.status !== 0) throw new Error(scrub(res.stderr) || 'state show failed');
  return JSON.parse(res.stdout);
}

function scratchDir() {
  const candidates = [
    path.join(os.homedir(), '.arc-studio-run'),
    path.join(ROOT, 'memory', '.arc-studio-run'),
  ];
  const errors = [];
  for (const dir of candidates) {
    try {
      fs.mkdirSync(dir, { recursive: true });
      const probe = path.join(dir, '.write-probe');
      fs.writeFileSync(probe, 'ok');
      fs.unlinkSync(probe);
      return dir;
    } catch (error) {
      errors.push(scrub(error instanceof Error ? error.message : error));
    }
  }
  throw new Error(`no writable scratch dir (${errors.join('; ')})`);
}

function cli(args, { input, timeout } = {}) {
  return spawnSync('arc-studio', args, {
    cwd: ROOT,
    encoding: 'utf8',
    input,
    timeout,
    env: process.env,
  });
}

function parseJson(stdout) {
  // The CLI streams compact per-event JSON objects during a turn, then writes the
  // final result. In --output json that final object is pretty-printed across
  // several lines (arc-studio renders it with JSON.stringify(result, null, 2)), so
  // a per-line "starts with {" filter grabs only its bare opening brace and cannot
  // parse it. Scan the whole stream for balanced top-level objects and return the
  // last one that parses (the final result), which also handles compact JSONL.
  const text = String(stdout || '');
  const objects = [];
  let depth = 0;
  let inStr = false;
  let esc = false;
  let start = -1;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inStr) {
      if (esc) esc = false;
      else if (ch === '\\') esc = true;
      else if (ch === '"') inStr = false;
      continue;
    }
    if (ch === '"') {
      inStr = true;
    } else if (ch === '{') {
      if (depth === 0) start = i;
      depth += 1;
    } else if (ch === '}') {
      if (depth > 0) {
        depth -= 1;
        if (depth === 0 && start !== -1) {
          objects.push(text.slice(start, i + 1));
          start = -1;
        }
      }
    }
  }
  for (let i = objects.length - 1; i >= 0; i -= 1) {
    try {
      return JSON.parse(objects[i]);
    } catch {
      // keep scanning older objects
    }
  }
  return null;
}

function classify(raw) {
  const text = String(raw || '').trim();
  if (!text || text === 'poll') return { kind: 'poll' };
  if (text.startsWith('answer:')) {
    const rest = text.slice('answer:'.length).trim();
    if (rest.startsWith('[')) return { kind: 'answer-json', text: rest };
    return { kind: 'answer-text', text: rest };
  }
  return { kind: 'prompt', text };
}

function report(code, state, note) {
  const lines = [
    '### arc-studio',
    `- Result: ${code}`,
    `- Phase: ${state.phase || 'idle'}`,
    `- Session: ${SESSION}`,
    `- App: ${state.appId || 'none'}`,
    `- Thread: ${state.threadId || 'none'}`,
  ];
  if (note) lines.push(`- Note: ${scrub(note)}`);
  process.stdout.write(`${lines.join('\n')}\n`);
}

function notify(kind, severity, body) {
  const file = path.join(scratchDir(), `notify-${kind}.md`);
  fs.writeFileSync(file, `${body.trim()}\n`);
  const bin = path.join(ROOT, 'notify');
  if (!fs.existsSync(bin)) return false;
  const res = spawnSync(bin, [
    '--title', 'Arc Studio',
    '--severity', severity,
    '--mute-key', `arc-studio-${kind}`,
    '-f', file,
  ], { cwd: ROOT, encoding: 'utf8' });
  if (res.status !== 0) {
    process.stderr.write(`notify failed: ${scrub(res.stderr || res.stdout)}\n`);
    return false;
  }
  return true;
}

function finish(code, note, { notifyKind, severity, body } = {}) {
  if (notifyKind) {
    notify(notifyKind, severity || 'info', body || note || code);
    stateCmd(['mark-notified', notifyKind]);
  }
  report(code, show(), note);
}

function promptBody(text) {
  return `${PREAMBLE}\n\n${text.trim()}\n`;
}

function detach(prompt, extraArgs) {
  const dir = scratchDir();
  const promptFile = path.join(dir, 'prompt.txt');
  fs.writeFileSync(promptFile, prompt);
  const res = cli(['run', '-', '--session', SESSION, '--detach', '--output', 'json', ...extraArgs], {
    input: prompt,
    timeout: 120000,
  });
  const json = parseJson(res.stdout);
  if (!json || json.status !== 'detached') {
    finish('ARC_STUDIO_ERROR', scrub(res.stderr || res.stdout || 'detach returned no session'), {
      notifyKind: 'error',
      severity: 'warn',
      body: 'Arc Studio did not accept the turn.',
    });
    return;
  }
  const out = path.join(dir, 'detach.json');
  fs.writeFileSync(out, `${JSON.stringify(json)}\n`);
  const saved = stateCmd(['save-detach', out, promptFile]);
  if (saved.status !== 0) {
    finish('ARC_STUDIO_ERROR', scrub(saved.stderr) || 'could not save the session');
    return;
  }
  const state = show();
  finish('ARC_STUDIO_STARTED', 'turn accepted, this run will not wait for it', {
    notifyKind: 'started',
    severity: 'info',
    body: [
      'Arc Studio turn started.',
      `Session: ${SESSION}`,
      `App: ${state.appId || 'unknown'}`,
      'The next run attaches. Nothing is deployed yet.',
    ].join('\n'),
  });
}

function settle(res) {
  const json = parseJson(res.stdout);
  if (!json || !json.status) {
    const timedOut = /Timed out waiting/i.test(`${res.stderr || ''}\n${res.stdout || ''}`);
    if (timedOut || res.error?.code === 'ETIMEDOUT') {
      finish('ARC_STUDIO_STILL_RUNNING', 'attach timed out, session kept');
      return;
    }
    finish('ARC_STUDIO_ERROR', scrub(res.stderr || res.stdout || 'attach failed'), {
      notifyKind: 'error',
      severity: 'warn',
      body: 'Arc Studio attach failed. The session id was kept.',
    });
    return;
  }
  const dir = scratchDir();
  const file = path.join(dir, 'result.json');
  fs.writeFileSync(file, `${JSON.stringify(json)}\n`);
  const saved = stateCmd(['save-result', file]);
  if (saved.status !== 0) {
    finish('ARC_STUDIO_ERROR', scrub(saved.stderr) || 'could not save the result');
    return;
  }
  const summary = JSON.parse(saved.stdout);
  if (summary.phase === 'settled') {
    const lines = ['Reported by the Arc Studio sandbox. Not checked onchain.', ''];
    if (summary.webUrl) lines.push(summary.webUrl);
    for (const item of summary.deployments || []) {
      lines.push([item.contract, item.address, item.network, item.txHash].filter(Boolean).join(' '));
    }
    if ((summary.deployments || []).length === 0) lines.push('No deployments.');
    finish('ARC_STUDIO_DONE', 'turn finished', {
      notifyKind: 'completed',
      severity: 'success',
      body: lines.join('\n'),
    });
    return;
  }
  if (summary.phase === 'needs_input') {
    const questions = summary.questions?.questions || [];
    const lines = ['Arc Studio is waiting for an answer.', summary.webUrl || ''];
    for (const question of questions) {
      lines.push(question.prompt);
      for (const option of question.options || []) lines.push(`- ${option.id}: ${option.label}`);
    }
    lines.push('Next var: answer:<json array> or answer:<sentence>');
    finish('ARC_STUDIO_NEEDS_INPUT', 'waiting for answer', {
      notifyKind: 'needs_input',
      severity: 'warn',
      body: lines.filter(Boolean).join('\n'),
    });
    return;
  }
  if (summary.phase === 'budget') {
    finish('ARC_STUDIO_BUDGET', 'budget spent', {
      notifyKind: 'budget',
      severity: 'warn',
      body: 'Arc Studio stopped because the turn hit its budget. No deploy is claimed.',
    });
    return;
  }
  finish('ARC_STUDIO_ERROR', summary.errorMessage || 'turn failed', {
    notifyKind: 'error',
    severity: 'warn',
    body: summary.errorMessage || 'Arc Studio turn failed.',
  });
}

function attach() {
  const restored = stateCmd(['restore']);
  if (restored.status !== 0) {
    finish('ARC_STUDIO_ERROR', scrub(restored.stderr) || 'could not restore the session');
    return;
  }
  const res = cli(['attach', '--session', SESSION, '--output', 'json', '--timeout', '12'], {
    timeout: 13 * 60 * 1000,
  });
  settle(res);
}

function main() {
  const who = cli(['whoami'], { timeout: 60000 });
  if (who.status !== 0) {
    const marked = stateCmd(['mark-notified', 'auth']);
    const already = (marked.stdout || '').includes('already-noted');
    if (!already) {
      notify('auth', 'warn', [
        'Arc Studio auth failed.',
        'Mint a token with arc-studio login --paste and store it with ./aeon secrets set ARC_STUDIO_TOKEN --stdin.',
      ].join('\n'));
      stateCmd(['mark-notified', 'auth']);
    }
    report('ARC_STUDIO_AUTH', show(), already ? 'auth already reported' : 'whoami failed');
    // Exit non-zero so a missing/invalid ARC_STUDIO_TOKEN shows up as a failed
    // run instead of a green one that silently did nothing. The notify is still
    // deduped by mark-notified above, so the operator is pinged only once even
    // though every scheduled run keeps flagging red until the token is fixed.
    process.exitCode = 1;
    return;
  }

  const state = show();
  const request = classify(process.env.SKILL_VAR || '');
  if (state.appId && state.threadId && state.phase !== 'idle') stateCmd(['restore']);

  if (state.phase === 'detached') {
    const busy = request.kind === 'prompt' || request.kind.startsWith('answer');
    attach();
    if (busy) process.stdout.write('- Note: a new prompt was ignored because a turn is already in flight\n');
    return;
  }

  if (state.phase === 'needs_input') {
    if (request.kind === 'answer-json') {
      let parsed;
      try { parsed = JSON.parse(request.text); } catch { parsed = null; }
      if (!Array.isArray(parsed)) {
        finish('ARC_STUDIO_ERROR', 'answer JSON must be an array');
        return;
      }
      detach('answers', ['--answers-json', JSON.stringify(parsed)]);
      return;
    }
    if (request.kind === 'answer-text') {
      detach(promptBody(request.text), []);
      return;
    }
    if (state.lastNotified === 'needs_input') {
      report('ARC_STUDIO_NEEDS_INPUT', state, 'already reported');
      return;
    }
    finish('ARC_STUDIO_NEEDS_INPUT', 'waiting for answer', {
      notifyKind: 'needs_input',
      severity: 'warn',
      body: 'Arc Studio is still waiting. Next var: answer:<json array> or answer:<sentence>.',
    });
    return;
  }

  if (request.kind === 'poll') {
    report('ARC_STUDIO_IDLE', state, 'nothing in flight');
    return;
  }

  if (state.phase === 'budget' && state.prompt && request.text.startsWith(state.prompt)) {
    report('ARC_STUDIO_BUDGET', state, 'same prompt was not retried');
    return;
  }

  detach(promptBody(request.text), []);
}

try {
  main();
} catch (error) {
  process.stderr.write(`${scrub(error instanceof Error ? error.stack || error.message : error)}\n`);
  process.exit(1);
}
