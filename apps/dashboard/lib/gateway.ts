import { getFileContent, updateFile, isLocal, commitAndPush } from './github'
import { updateGatewayInConfig } from './config'
import type { GatewayProvider } from './types'

// Set aeon.yml's gateway.provider and make the change land on the repo the
// workflow reads. Always pins `auto`, so the workflow resolves the live provider
// at run time from whichever secrets are set (scripts/llm-gateway.sh). No-ops
// when the provider is already correct.
export async function syncGatewayProvider() {
  const next: GatewayProvider = 'auto'
  const { content, sha } = await getFileContent('aeon.yml')
  const updated = updateGatewayInConfig(content, next)
  if (updated === content) return

  const message = `chore: set LLM gateway provider to ${next}`
  await updateFile('aeon.yml', updated, sha, message)
  // Remote mode (GITHUB_TOKEN+GITHUB_REPO) already committed via the API;
  // local mode wrote only the working copy, so commit & push it.
  if (isLocal()) commitAndPush(['aeon.yml'], message)
}
