#!/usr/bin/env node

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CANISTER_ID = /^([a-z0-9]{5}-){4}[a-z0-9]{3}$/;
const HASH = /^[a-f0-9]{64}$/;

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

export function isEndpointCanisterId(value) {
  return typeof value === 'string' && CANISTER_ID.test(value);
}

export function normalizeState(value) {
  if (isObject(value) && value.version === 1 && isObject(value.canisters)) {
    return JSON.parse(JSON.stringify(value));
  }

  // Migrate the first draft's direct {"<id>": snapshot} map without discarding it.
  if (isObject(value) && !('version' in value) && !('canisters' in value)) {
    return { version: 1, canisters: JSON.parse(JSON.stringify(value)) };
  }

  return { version: 1, canisters: {} };
}

function normalizeLatestUpgrade(value) {
  if (value === undefined) return null;
  if (!isObject(value)) throw new Error('upgrades[0] must be an object');
  if (!HASH.test(value.module_hash)) throw new Error('upgrades[0].module_hash is invalid');
  if (!Number.isInteger(value.executed_timestamp_seconds) || value.executed_timestamp_seconds < 0) {
    throw new Error('upgrades[0].executed_timestamp_seconds is invalid');
  }
  if (!(Number.isInteger(value.proposal_id) || (typeof value.proposal_id === 'string' && /^\d+$/.test(value.proposal_id)))) {
    throw new Error('upgrades[0].proposal_id is invalid');
  }
  return {
    executed_timestamp_seconds: value.executed_timestamp_seconds,
    module_hash: value.module_hash,
    proposal_id: value.proposal_id,
  };
}

export function normalizePublicResponse(value, expectedId) {
  if (!isObject(value)) throw new Error('response must be an object');
  if (value.canister_id !== expectedId) throw new Error('response canister_id does not match the request');
  if (!Array.isArray(value.controllers) || !value.controllers.every((item) => typeof item === 'string')) {
    throw new Error('controllers must be an array of strings');
  }
  if (!(value.module_hash === null || (typeof value.module_hash === 'string' && HASH.test(value.module_hash)))) {
    throw new Error('module_hash must be null or a 64-character lowercase hex string');
  }
  if (!Array.isArray(value.upgrades)) throw new Error('upgrades must be an array');
  if (!(value.name === null || value.name === undefined || typeof value.name === 'string')) {
    throw new Error('name must be a string or null');
  }

  return {
    controllers: [...value.controllers].sort(),
    module_hash: value.module_hash,
    name: value.name ?? null,
    // The API is newest-first. Never use the last element here.
    latest_upgrade: normalizeLatestUpgrade(value.upgrades[0]),
  };
}

function sameArray(left, right) {
  return JSON.stringify(left ?? []) === JSON.stringify(right ?? []);
}

export function reconcile({ state: stateInput, id, httpStatus, body, now }) {
  const state = normalizeState(stateInput);
  const previous = state.canisters[id] ?? null;
  const code = Number(httpStatus);

  if (!isEndpointCanisterId(id)) {
    return { state, persist: false, result: { ok: false, id, source: 'invalid-id', alert: false } };
  }

  if (code === 422) {
    return { state, persist: false, result: { ok: false, id, source: 'invalid-id', alert: false } };
  }

  if (code === 404) {
    const hadPublic = previous?.had_public === true || previous?.source === 'public';
    const wentMissing = hadPublic && previous?.source !== 'unindexed';
    state.canisters[id] = {
      ...(previous ?? {}),
      source: 'unindexed',
      had_public: hadPublic,
      missing_since: previous?.missing_since ?? now,
      last_checked_at: now,
    };
    return {
      state,
      persist: true,
      result: {
        ok: true,
        id,
        source: 'unindexed',
        event: wentMissing ? 'went-missing' : previous?.source === 'unindexed' ? 'still-missing' : 'baseline-unindexed',
        alert: wentMissing,
        previous,
        current: state.canisters[id],
      },
    };
  }

  if (code !== 200) {
    return {
      state,
      persist: false,
      result: { ok: false, id, source: `http-${Number.isFinite(code) ? code : 'unknown'}`, alert: false },
    };
  }

  let snapshot;
  try {
    snapshot = normalizePublicResponse(body, id);
  } catch (error) {
    return {
      state,
      persist: false,
      result: { ok: false, id, source: 'invalid-response', alert: false, error: error.message },
    };
  }

  const hadPublic = previous?.had_public === true || previous?.source === 'public';
  const reappeared = hadPublic && previous?.source === 'unindexed';
  const changes = [];
  if (hadPublic && !sameArray(previous?.controllers, snapshot.controllers)) changes.push('controller-change');
  if (hadPublic && previous?.module_hash !== snapshot.module_hash) changes.push('module-upgrade');

  state.canisters[id] = {
    source: 'public',
    had_public: true,
    ...snapshot,
    last_seen_at: now,
    last_checked_at: now,
    missing_since: null,
  };

  const alert = reappeared || changes.length > 0;
  return {
    state,
    persist: true,
    result: {
      ok: true,
      id,
      source: 'public',
      event: reappeared ? 'reappeared' : !hadPublic ? 'baseline' : changes.length ? 'changed' : 'unchanged',
      changes,
      alert,
      previous,
      current: state.canisters[id],
    },
  };
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key ?? '<end>'}`);
    args[key.slice(2)] = value;
  }
  for (const required of ['id', 'http', 'body', 'state', 'now']) {
    if (!args[required]) throw new Error(`missing --${required}`);
  }
  return args;
}

function readJsonIfPresent(file) {
  if (!fs.existsSync(file)) return null;
  const text = fs.readFileSync(file, 'utf8').trim();
  if (!text) return null;
  return JSON.parse(text);
}

function writeStateAtomic(file, state) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.tmp-${process.pid}`;
  fs.writeFileSync(temporary, `${JSON.stringify(state, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = readJsonIfPresent(args.state);
  let body = null;
  if (Number(args.http) === 200) {
    try {
      body = readJsonIfPresent(args.body);
    } catch (error) {
      process.stdout.write(`${JSON.stringify({ ok: false, id: args.id, source: 'invalid-response', alert: false, error: error.message })}\n`);
      return;
    }
  }
  const reconciled = reconcile({ state, id: args.id, httpStatus: args.http, body, now: args.now });
  if (reconciled.persist) writeStateAtomic(args.state, reconciled.state);
  process.stdout.write(`${JSON.stringify(reconciled.result)}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`canister-status reconcile: ${error.message}\n`);
    process.exitCode = 2;
  }
}
