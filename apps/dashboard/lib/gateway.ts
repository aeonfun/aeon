import { getFileContent, updateFile, isLocal, commitAndPush, type CommitResult } from './github'
import { updateGatewayInConfig, updateHarnessInConfig, updateModelInConfig, parseConfig } from './config'
import { modelsForHarness } from './constants'
import type { GatewayProvider, Harness } from './types'

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

// Set aeon.yml's top-level harness and make the change land on the repo the
// workflow reads — the harness counterpart of syncGatewayProvider. Called when
// connecting a harness should also switch to it (e.g. the grok X-account OAuth
// flow), so connecting the harness auto-configures + pushes exactly the way
// setting a provider key auto-configures the gateway. No-ops when the harness is
// already correct. Returns whether the change reached the repo.
export async function syncHarness(harness: Harness): Promise<CommitResult> {
  const { content, sha } = await getFileContent('aeon.yml')
  let updated = updateHarnessInConfig(content, harness)
  // Keep the default model consistent with the harness — same as the TopBar
  // harness switch: if the current model doesn't belong to the new harness, snap
  // it to that harness's default so aeon.yml never reads e.g. harness=grok +
  // model=claude-opus.
  const currentModel = parseConfig(content).model
  const list = modelsForHarness(harness)
  if (currentModel && !list.some((m) => m.id === currentModel) && list[0]) {
    updated = updateModelInConfig(updated, list[0].id)
  }
  if (updated === content) return { synced: true }

  const message = `chore: set harness to ${harness}`
  await updateFile('aeon.yml', updated, sha, message)
  // Hosted mode committed via the Contents API; commitAndPush self-guards on
  // isLocal(), pushing only the local working copy and no-opping otherwise.
  return commitAndPush(['aeon.yml'], message)
}
