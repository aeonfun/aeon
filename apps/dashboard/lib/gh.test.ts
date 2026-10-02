import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { workflowPermissionsUpdate } from './gh'

describe('ensureActionsCanOpenPRs settings change', () => {
  it('only turns on PR creation and echoes the default token permission back unchanged', () => {
    for (const level of ['read', 'write']) {
      const args = workflowPermissionsUpdate('o/r', { default_workflow_permissions: level, can_approve_pull_request_reviews: false })!
      assert.deepEqual(args, ['api', '-X', 'PUT', 'repos/o/r/actions/permissions/workflow',
        '-f', `default_workflow_permissions=${level}`, '-F', 'can_approve_pull_request_reviews=true'])
    }
  })

  it('never widens a read-only default to write', () => {
    const args = workflowPermissionsUpdate('o/r', { default_workflow_permissions: 'read' })!
    assert.ok(!args.includes('default_workflow_permissions=write'))
  })

  it('omits the default when it could not be read, and does nothing when already on', () => {
    assert.deepEqual(workflowPermissionsUpdate('o/r', {}), ['api', '-X', 'PUT', 'repos/o/r/actions/permissions/workflow', '-F', 'can_approve_pull_request_reviews=true'])
    assert.equal(workflowPermissionsUpdate('o/r', { default_workflow_permissions: 'read', can_approve_pull_request_reviews: true }), null)
  })
})
