#!/usr/bin/env node

import fs from 'node:fs';
import { pathToFileURL } from 'node:url';

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

// Textual canister-id shape (same as skills/canister-status/reconcile.mjs). A root
// from this list is substituted into a shell curl, so anything that isn't a
// well-formed id is dropped before it can reach the command line.
const CANISTER_ID = /^([a-z0-9]{5}-){4}[a-z0-9]{3}$/;

function identifier(value, field) {
  if (Number.isInteger(value) && value >= 0) return String(value);
  if (typeof value === 'string' && /^\d+$/.test(value)) return value;
  throw new Error(`${field} must be a non-negative integer identifier`);
}

function tally(value) {
  if (!isObject(value)) throw new Error('latest_tally must be an object');
  for (const field of ['yes', 'no', 'total']) {
    if (!(typeof value[field] === 'number' || (typeof value[field] === 'string' && /^\d+$/.test(value[field])))) {
      throw new Error(`latest_tally.${field} must be numeric`);
    }
  }
  return { yes: value.yes, no: value.no, total: value.total };
}

function responseRows(value) {
  if (!isObject(value) || !Array.isArray(value.data)) throw new Error('response must be an object with a data array');
  return value.data;
}

function openRows(value) {
  return responseRows(value)
    .map((row, index) => {
      if (!isObject(row)) throw new Error(`data[${index}] must be an object`);
      if (typeof row.status !== 'string') throw new Error(`data[${index}].status must be a string`);
      return row;
    })
    .filter((row) => row.status === 'OPEN');
}

export function parseSnsListResponse(value) {
  // The SNS list is discovery, not a proposal source: a row we can't safely target
  // is skipped, not fatal — one malformed or empty-name DAO must not fail the whole
  // sweep. The envelope still fails closed via responseRows, and the proposal
  // parsers below stay strict (an unexpected proposal row never becomes a proposal).
  return responseRows(value)
    .filter(
      (row) =>
        isObject(row) &&
        typeof row.root_canister_id === 'string' &&
        CANISTER_ID.test(row.root_canister_id) &&
        typeof row.name === 'string' &&
        row.name &&
        typeof row.active === 'boolean' &&
        typeof row.enabled === 'boolean' &&
        row.active &&
        row.enabled,
    )
    .map((row) => ({
      root_canister_id: row.root_canister_id,
      name: row.name,
      active: row.active,
      enabled: row.enabled,
      swap_lifecycle: isObject(row.swap_lifecycle) ? row.swap_lifecycle : null,
    }));
}

export function parseNnsResponse(value) {
  return openRows(value)
    .map((row) => {
      const proposalId = identifier(row.proposal_id, 'proposal_id');
      if (!Number.isInteger(row.deadline_timestamp_seconds) || row.deadline_timestamp_seconds < 0) {
        throw new Error('deadline_timestamp_seconds must be a non-negative integer');
      }
      if (typeof row.action !== 'string') throw new Error('action must be a string');
      return {
        source: 'nns',
        key: `nns:${proposalId}`,
        proposal_id: proposalId,
        title: typeof row.title === 'string' && row.title ? row.title : row.action,
        action: row.action,
        status: row.status,
        deadline_timestamp_seconds: row.deadline_timestamp_seconds,
        latest_tally: tally(row.latest_tally),
      };
    });
}

export function parseSnsResponse(value, rootCanisterId) {
  if (typeof rootCanisterId !== 'string' || !rootCanisterId) throw new Error('root canister id is required');
  return openRows(value)
    .map((row) => {
      if (row.root_canister_id !== rootCanisterId) throw new Error('row root_canister_id does not match the requested SNS');
      const id = identifier(row.id, 'id');
      if (!Number.isInteger(row.wait_for_quiet_state_current_deadline_timestamp_seconds) || row.wait_for_quiet_state_current_deadline_timestamp_seconds < 0) {
        throw new Error('wait_for_quiet_state_current_deadline_timestamp_seconds must be a non-negative integer');
      }
      if (typeof row.proposal_title !== 'string') throw new Error('proposal_title must be a string');
      return {
        source: 'sns',
        root_canister_id: rootCanisterId,
        key: `sns:${rootCanisterId}:${id}`,
        id,
        title: row.proposal_title,
        action: typeof row.proposal_action_type === 'string' ? row.proposal_action_type : String(row.action ?? ''),
        status: row.status,
        deadline_timestamp_seconds: row.wait_for_quiet_state_current_deadline_timestamp_seconds,
        latest_tally: tally(row.latest_tally),
      };
    });
}

function parseArgs(argv) {
  const args = {};
  for (let index = 0; index < argv.length; index += 2) {
    const key = argv[index];
    const value = argv[index + 1];
    if (!key?.startsWith('--') || value === undefined) throw new Error(`invalid argument near ${key ?? '<end>'}`);
    args[key.slice(2)] = value;
  }
  if (!['nns', 'sns', 'sns-list'].includes(args.source)) throw new Error('--source must be nns, sns, or sns-list');
  if (!args.input) throw new Error('missing --input');
  if (args.source === 'sns' && !args.root) throw new Error('missing --root for SNS proposals');
  return args;
}

function main() {
  const args = parseArgs(process.argv.slice(2));
  const text = fs.readFileSync(args.input, 'utf8').trim();
  if (!text) throw new Error('response body is empty');
  const payload = JSON.parse(text);
  const data = args.source === 'nns'
    ? parseNnsResponse(payload)
    : args.source === 'sns'
      ? parseSnsResponse(payload, args.root)
      : parseSnsListResponse(payload);
  process.stdout.write(`${JSON.stringify({ source: args.source, count: data.length, data })}\n`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (error) {
    process.stderr.write(`sns-digest parser: ${error.message}\n`);
    process.exitCode = 2;
  }
}
