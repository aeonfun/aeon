#!/usr/bin/env node
// Durable session record for the arc-studio skill.
// memory/arc-studio.json is committed and survives the next runner.
// ~/.arc-studio/sessions.json is runner-local. restore rebuilds it.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const STATE = 'memory/arc-studio.json';
const SESSION = 'aeon-arc';
const sessionsFile = path.join(os.homedir(), '.arc-studio', 'sessions.json');

const ID = /^[A-Za-z0-9_-]{8,80}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const TX = /^0x[a-fA-F0-9]{64}$/;
const HTTPS = /^https:\/\/[^\s]+$/;

function readJson(file) {
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8'));
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error(`${file} is not a JSON object`);
  }
  return parsed;
}

function readState() {
  try {
    return readJson(STATE);
  } catch {
    return null;
  }
}

function writeState(state) {
  fs.mkdirSync(path.dirname(STATE), { recursive: true });
  const tmp = `${STATE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(tmp, STATE);
}

function readSessions() {
  try {
    const parsed = readJson(sessionsFile);
    return {
      sessions: parsed.sessions && typeof parsed.sessions === 'object' ? parsed.sessions : {},
      byCwd: parsed.byCwd && typeof parsed.byCwd === 'object' ? parsed.byCwd : {},
    };
  } catch {
    return { sessions: {}, byCwd: {} };
  }
}

function cleanId(value) {
  return typeof value === 'string' && ID.test(value) ? value : null;
}

function scrub(value, max) {
  if (typeof value !== 'string') return null;
  const cleaned = value
    .replace(/origin_pat_[A-Za-z0-9._-]+/g, '[token]')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, max);
  return cleaned || null;
}

function cleanUrl(value) {
  return typeof value === 'string' && HTTPS.test(value) ? value.slice(0, 300) : null;
}

function previewFrom(arg) {
  if (!arg) return '';
  try {
    if (fs.existsSync(arg) && fs.statSync(arg).isFile()) {
      return scrub(fs.readFileSync(arg, 'utf8'), 180) || '';
    }
  } catch {
    /* fall through to the literal */
  }
  return scrub(String(arg), 180) || '';
}

function cleanDeployments(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object') continue;
    const address = typeof item.address === 'string' && ADDRESS.test(item.address) ? item.address : null;
    if (!address) continue;
    out.push({
      contract: scrub(item.contract, 80),
      address,
      network: scrub(item.network, 80),
      explorerUrl: cleanUrl(item.explorerUrl),
      txHash: typeof item.txHash === 'string' && TX.test(item.txHash) ? item.txHash : null,
    });
    if (out.length === 20) break;
  }
  return out;
}

function cleanQuestions(payload) {
  if (!payload || typeof payload !== 'object' || !Array.isArray(payload.questions)) return null;
  const questions = [];
  for (const question of payload.questions) {
    if (!question || typeof question !== 'object') continue;
    const id = cleanId(question.id) || scrub(question.id, 40);
    const prompt = scrub(question.prompt, 300);
    if (!id || !prompt) continue;
    const options = [];
    if (Array.isArray(question.options)) {
      for (const option of question.options) {
        if (!option || typeof option !== 'object') continue;
        const optionId = cleanId(option.id) || scrub(option.id, 40);
        const label = scrub(option.label, 120);
        if (!optionId || !label) continue;
        options.push({ id: optionId, label });
        if (options.length === 12) break;
      }
    }
    questions.push({
      id,
      prompt,
      options,
      allowMultiple: question.allowMultiple === true,
      allowFreeform: question.allowFreeform === true,
    });
    if (questions.length === 8) break;
  }
  if (questions.length === 0) return null;
  return {
    title: scrub(payload.title, 120),
    allowSkip: payload.allowSkip === true,
    questions,
  };
}

function blank() {
  return {
    session: SESSION,
    phase: 'idle',
    appId: null,
    threadId: null,
    baselineMessageId: null,
    baseUrl: null,
    sandboxId: null,
    prompt: '',
    webUrl: null,
    deployments: [],
    filesChanged: [],
    questions: null,
    errorMessage: null,
    startedAt: null,
    updatedAt: null,
    lastStatus: null,
    lastNotified: null,
  };
}

function emit(payload) {
  process.stdout.write(`${JSON.stringify(payload, null, 2)}\n`);
}

const cmd = process.argv[2];

if (cmd === 'show') {
  emit(readState() ?? { phase: 'idle' });
  process.exit(0);
}

if (cmd === 'restore') {
  const state = readState();
  const appId = state && cleanId(state.appId);
  const threadId = state && cleanId(state.threadId);
  if (!appId || !threadId) {
    process.stderr.write('no session ids to restore\n');
    process.exit(2);
  }
  const name = cleanId(state.session) || SESSION;
  const store = readSessions();
  store.sessions[name] = {
    appId,
    threadId,
    ...(cleanUrl(state.baseUrl) ? { baseUrl: state.baseUrl } : {}),
    ...(cleanId(state.baselineMessageId) ? { baselineMessageId: state.baselineMessageId } : {}),
    ...(cleanId(state.sandboxId) ? { sandboxId: state.sandboxId } : {}),
    lastUsed: new Date().toISOString(),
  };
  fs.mkdirSync(path.dirname(sessionsFile), { recursive: true, mode: 0o700 });
  fs.writeFileSync(sessionsFile, `${JSON.stringify(store, null, 2)}\n`, { mode: 0o600 });
  emit({ restored: name, phase: state.phase || 'idle', appId, threadId });
  process.exit(0);
}

if (cmd === 'save-detach') {
  const file = process.argv[3];
  if (!file) {
    process.stderr.write('usage: save-detach <detach.json> [prompt-or-file]\n');
    process.exit(1);
  }
  const raw = readJson(file);
  const appId = cleanId(raw.appId);
  const threadId = cleanId(raw.threadId);
  if (raw.status !== 'detached' || !appId || !threadId) {
    process.stderr.write('detach json needs status=detached plus appId and threadId\n');
    process.exit(1);
  }
  const name = (typeof raw.session === 'string' && /^[a-z0-9-]{1,40}$/.test(raw.session) && raw.session) || SESSION;
  const local = readSessions().sessions[name] || {};
  const prev = readState() || blank();
  const next = {
    ...blank(),
    session: name,
    phase: 'detached',
    appId,
    threadId,
    baselineMessageId: cleanId(local.baselineMessageId),
    baseUrl: cleanUrl(local.baseUrl),
    sandboxId: cleanId(local.sandboxId),
    prompt: previewFrom(process.argv[4]) || prev.prompt || '',
    startedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    lastStatus: 'detached',
    lastNotified: null,
  };
  writeState(next);
  emit({ phase: 'detached', session: name, appId, threadId });
  process.exit(0);
}

if (cmd === 'save-result') {
  const file = process.argv[3];
  if (!file) {
    process.stderr.write('usage: save-result <result.json>\n');
    process.exit(1);
  }
  const raw = readJson(file);
  const status = raw.status;
  const phaseByStatus = {
    completed: 'settled',
    needs_input: 'needs_input',
    budget_exceeded: 'budget',
    error: 'error',
  };
  const phase = phaseByStatus[status];
  if (!phase) {
    process.stderr.write(`unexpected status ${String(status)}\n`);
    process.exit(1);
  }
  const prev = readState() || blank();
  const next = {
    ...prev,
    phase,
    webUrl: cleanUrl(raw.webUrl),
    deployments: cleanDeployments(raw.deployments),
    filesChanged: Array.isArray(raw.filesChanged)
      ? raw.filesChanged.filter((item) => typeof item === 'string' && item.length < 200 && !item.includes('..')).slice(0, 40)
      : [],
    questions: phase === 'needs_input' ? cleanQuestions(raw.questions) : null,
    errorMessage: scrub(raw.errorMessage, 300),
    updatedAt: new Date().toISOString(),
    lastStatus: status,
    lastNotified: null,
  };
  if ('finalText' in next) delete next.finalText;
  writeState(next);
  emit({
    phase,
    status,
    webUrl: next.webUrl,
    deployments: next.deployments,
    filesChanged: next.filesChanged,
    questions: next.questions,
    errorMessage: next.errorMessage,
  });
  process.exit(0);
}

if (cmd === 'mark-notified') {
  const kind = process.argv[3];
  if (!kind || !/^[a-z_]{1,40}$/.test(kind)) {
    process.stderr.write('usage: mark-notified <kind>\n');
    process.exit(1);
  }
  const state = readState() || blank();
  if (state.lastNotified === kind) {
    process.stdout.write('already-noted\n');
    process.exit(0);
  }
  state.lastNotified = kind;
  state.updatedAt = new Date().toISOString();
  writeState(state);
  process.stdout.write('noted\n');
  process.exit(0);
}

process.stderr.write('usage: show | restore | save-detach <json> [prompt] | save-result <json> | mark-notified <kind>\n');
process.exit(2);
