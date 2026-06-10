import { execFileSync } from 'child_process'
import { REPO_ROOT } from './gh'
import { getFileContent, updateFile, isLocal } from './github'
import { updateGatewayInConfig } from './config'
import { GATEWAY_PROVIDERS } from './types'
import type { GatewayProvider } from './types'

// Commit a working-tree file and push it to the instance repo. In local mode
// updateFile() only writes the working copy, so without this the GitHub Actions
// workflow — which reads gateway.provider from aeon.yml on the remote default
// branch — would never see the change.
function commitAndPush(file: string, message: string) {
  const git = (args: string[]) =>
    execFileSync('git', ['-C', REPO_ROOT, ...args], { stdio: ['pipe', 'pipe', 'pipe'] })
  git(['add', file])
  git(['-c', 'user.name=Aeon Dashboard', '-c', 'user.email=dashboard@aeon.local', 'commit', '-m', message])
  git(['push'])
}

// Set aeon.yml's gateway.provider and make the change land on the repo the
// workflow reads. Adding/removing a key keeps this on `auto`, so the workflow
// resolves the live provider at run time from whichever secrets are set
// (scripts/llm-gateway.sh). Callers may still pass an explicit name to pin one.
// No-ops when the provider is already correct.
export async function syncGatewayProvider(provider: string) {
  const next: GatewayProvider = GATEWAY_PROVIDERS.includes(provider as GatewayProvider)
    ? (provider as GatewayProvider) : 'direct'
  const { content, sha } = await getFileContent('aeon.yml')
  const updated = updateGatewayInConfig(content, next)
  if (updated === content) return

  const message = `chore: set LLM gateway provider to ${next}`
  await updateFile('aeon.yml', updated, sha, message)
  // Remote mode (GITHUB_TOKEN+GITHUB_REPO) already committed via the API;
  // local mode wrote only the working copy, so commit & push it.
  if (isLocal()) commitAndPush('aeon.yml', message)
}
