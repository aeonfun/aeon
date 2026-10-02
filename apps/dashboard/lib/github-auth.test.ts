import { describe, it } from 'node:test'
import { strict as assert } from 'node:assert'

import { GhGlobalScopeError, assertGhGlobalScopes, missingScopes, parseGhAuthToken, parseOAuthScopes } from './github-auth'

describe('parseGhAuthToken', () => {
  it('accepts GitHub CLI OAuth tokens', () => {
    assert.equal(parseGhAuthToken('gho_abcdefghijklmnopqrstuvwx\n'), 'gho_abcdefghijklmnopqrstuvwx')
  })

  it('accepts classic and fine-grained PATs', () => {
    assert.equal(parseGhAuthToken('ghp_abcdefghijklmnopqrstuvwx'), 'ghp_abcdefghijklmnopqrstuvwx')
    assert.equal(parseGhAuthToken('github_pat_11AAAA_abcdefghijklmnopqrstuvwx'), 'github_pat_11AAAA_abcdefghijklmnopqrstuvwx')
  })

  it('rejects Actions installation tokens and junk', () => {
    assert.throws(() => parseGhAuthToken('ghs_abcdefghijklmnopqrstuvwx'), /Could not read a GitHub token/)
    assert.throws(() => parseGhAuthToken(''), /Could not read a GitHub token/)
    assert.throws(() => parseGhAuthToken('not-a-token'), /Could not read a GitHub token/)
  })
})

describe('GH_GLOBAL scope check', () => {
  const headers = (scopes: string | null) => [
    'HTTP/2.0 200 OK',
    'Access-Control-Expose-Headers: ETag, X-OAuth-Scopes, X-Accepted-OAuth-Scopes',
    'X-Accepted-Oauth-Scopes: ',
    ...(scopes === null ? [] : [`X-Oauth-Scopes: ${scopes}`]),
    '',
    '{"login":"someone","note":"X-Oauth-Scopes: repo, workflow"}',
  ].join('\r\n')

  it('reads the granted scopes from the response headers only', () => {
    assert.deepEqual(parseOAuthScopes(headers('gist, read:org, repo, workflow')), ['gist', 'read:org', 'repo', 'workflow'])
    assert.deepEqual(parseOAuthScopes(headers('')), [])
    assert.equal(parseOAuthScopes(headers(null)), null)
  })

  it('names the missing scopes', () => {
    assert.deepEqual(missingScopes(['repo', 'workflow', 'gist']), [])
    assert.deepEqual(missingScopes(['repo', 'read:org']), ['workflow'])
    assert.deepEqual(missingScopes([]), ['repo', 'workflow'])
  })

  it('accepts a token with repo + workflow and refuses one without', () => {
    assert.doesNotThrow(() => assertGhGlobalScopes('gho_x', ['repo', 'workflow']))
    assert.throws(() => assertGhGlobalScopes('gho_x', ['repo']), /missing the workflow scope.*classic PAT with repo \+ workflow.*gh auth refresh -h github.com -s repo,workflow/)
    assert.throws(() => assertGhGlobalScopes('ghp_x', ['gist']), GhGlobalScopeError)
    assert.throws(() => assertGhGlobalScopes('ghp_x', ['gist']), /repo \+ workflow scopes/)
  })

  it('refuses a token whose scopes cannot be read', () => {
    assert.throws(() => assertGhGlobalScopes('github_pat_x', null), /fine-grained/)
    assert.throws(() => assertGhGlobalScopes('gho_x', null), /Could not read this token's scopes/)
  })
})
