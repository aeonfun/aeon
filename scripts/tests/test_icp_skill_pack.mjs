#!/usr/bin/env node

import assert from 'node:assert/strict';
import { isEndpointCanisterId, reconcile } from '../../skills/canister-status/reconcile.mjs';
import { parseNnsResponse, parseSnsListResponse, parseSnsResponse } from '../../skills/sns-digest/parse-proposals.mjs';

const id = 'ryjl3-tyaaa-aaaaa-aaaba-cai';
const hashA = 'a'.repeat(64);
const hashB = 'b'.repeat(64);
const now = '2026-11-07T12:00:00Z';

function canisterBody({ controllers = ['aaaaa-bbbbb-ccccc-ddddd-eee', 'fffff-ggggg-hhhhh-iiiii-jjj'], moduleHash = hashA } = {}) {
  return {
    canister_id: id,
    controllers,
    module_hash: moduleHash,
    name: 'Fixture',
    upgrades: [{ executed_timestamp_seconds: 200, module_hash: moduleHash, proposal_id: 99 }],
  };
}

function run(state, httpStatus, body, at = now) {
  return reconcile({ state, id, httpStatus, body, now: at });
}

assert.equal(isEndpointCanisterId(id), true);
assert.equal(isEndpointCanisterId('not-a-principal'), false);

let step = run(null, 200, canisterBody());
assert.equal(step.result.event, 'baseline');
assert.equal(step.result.alert, false);
assert.equal(step.result.current.latest_upgrade.proposal_id, 99, 'upgrades[0] is the newest upgrade');

step = run(step.state, 200, canisterBody({ controllers: [...canisterBody().controllers].reverse() }));
assert.equal(step.result.event, 'unchanged', 'controller ordering does not create a false change');
assert.equal(step.result.alert, false);

step = run(step.state, 200, canisterBody({ controllers: ['new-controller'] }));
assert.deepEqual(step.result.changes, ['controller-change']);
assert.equal(step.result.alert, true);

step = run(step.state, 200, canisterBody({ controllers: ['new-controller'], moduleHash: hashB }));
assert.deepEqual(step.result.changes, ['module-upgrade']);
assert.equal(step.result.alert, true);

step = run(step.state, 404, null, '2026-11-07T12:05:00Z');
assert.equal(step.result.event, 'went-missing');
assert.equal(step.result.alert, true);
const missingState = JSON.parse(JSON.stringify(step.state));

step = run(step.state, 404, null, '2026-11-07T12:10:00Z');
assert.equal(step.result.event, 'still-missing');
assert.equal(step.result.alert, false, 'repeated 404 is deduplicated');

step = run(step.state, 200, canisterBody({ controllers: ['new-controller'], moduleHash: hashB }), '2026-11-07T12:15:00Z');
assert.equal(step.result.event, 'reappeared');
assert.equal(step.result.alert, true);

const invalid = run(missingState, 422, null);
assert.equal(invalid.result.source, 'invalid-id');
assert.equal(invalid.persist, false);
assert.deepEqual(invalid.state, missingState, '422 does not overwrite the snapshot');

const serverError = run(missingState, 503, null);
assert.equal(serverError.result.source, 'http-503');
assert.equal(serverError.persist, false);
assert.deepEqual(serverError.state, missingState, 'unexpected HTTP status does not overwrite the snapshot');

const malformed = run(missingState, 200, { data: [] });
assert.equal(malformed.result.source, 'invalid-response');
assert.equal(malformed.persist, false);
assert.deepEqual(malformed.state, missingState, 'unexpected 200 JSON does not overwrite the snapshot');

const nns = parseNnsResponse({
  data: [
    {
      id: 125028,
      proposal_id: 144744,
      status: 'OPEN',
      action: 'InstallCode',
      title: 'Upgrade canister',
      deadline_timestamp_seconds: 1794350793,
      latest_tally: { yes: 10, no: 2, total: 12 },
    },
    { id: 1, proposal_id: 2, status: 'EXECUTED' },
  ],
});
assert.equal(nns.length, 1);
assert.equal(nns[0].proposal_id, '144744');
assert.equal(nns[0].key, 'nns:144744', 'NNS dedup uses proposal_id, never the row id');

const root = 'oh4fn-kyaaa-aaaaq-aaega-cai';
const snsList = parseSnsListResponse({
  data: [
    { root_canister_id: root, name: 'ALICE', active: true, enabled: true, swap_lifecycle: { lifecycle: 'LIFECYCLE_COMMITTED' } },
    { root_canister_id: 'inactive-root', name: 'INACTIVE', active: false, enabled: true },
    { root_canister_id: 'disabled-root', name: 'DISABLED', active: true, enabled: false },
  ],
});
assert.deepEqual(snsList.map((row) => row.root_canister_id), [root], 'SNS sweep keeps only active and enabled DAOs');

const sns = parseSnsResponse(
  {
    data: [
      {
        root_canister_id: root,
        id: '125',
        status: 'OPEN',
        proposal_title: 'Weekly Rewards',
        proposal_action_type: 'Motion',
        wait_for_quiet_state_current_deadline_timestamp_seconds: 1793908268,
        latest_tally: { yes: 10, no: 2, total: 12 },
      },
      { root_canister_id: root, id: '124', status: 'REJECTED' },
    ],
  },
  root,
);
assert.equal(sns.length, 1);
assert.equal(sns[0].id, '125');
assert.equal(sns[0].key, `sns:${root}:125`, 'SNS dedup uses the SNS id under its root');

assert.throws(() => parseNnsResponse({ data: [{ status: 'OPEN', id: 125028 }] }), /proposal_id/);
assert.throws(() => parseSnsResponse({ data: [{ status: 'OPEN', id: '1', root_canister_id: 'wrong' }] }, root), /does not match/);
assert.throws(() => parseNnsResponse({ data: [null] }), /must be an object/);
assert.throws(() => parseSnsListResponse({ data: [{ root_canister_id: root, name: 'ALICE', active: 'yes', enabled: true }] }), /must be booleans/);
assert.throws(() => parseNnsResponse({ results: [] }), /data array/);

console.log('PASS test_icp_skill_pack');
