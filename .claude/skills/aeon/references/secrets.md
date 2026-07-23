# Aeon secrets and variables — where to get each one

## How to set anything

**Secrets** (credentials — write-only, can't be read back):

```bash
./aeon secrets set NAME --stdin      # paste the value, then Ctrl-D
./aeon secrets ls --set              # what's configured
./aeon secrets ls --unset            # what's missing
./aeon secrets rm NAME
```

Always `--stdin`. Passing a key as an argument puts it in shell history.

**Variables** (non-secret behaviour toggles — readable):

```bash
gh variable set NAME "value"
gh variable list
```

Getting the two mixed up is the most common setup mistake. A credential in variables is exposed; a toggle in secrets works but you can't read it back to check what it's set to.

Three things worth knowing:

- **Secrets are per-repo.** A forked instance inherits none of the parent's keys. That's deliberate — billing isolation and blast-radius containment.
- **Optional keys** are marked `KEY?` in a skill's `requires:`. Missing means the skill degrades to a public/lower-quality path, not that it breaks.
- **Two secrets have side effects when set:** `TELEGRAM_BOT_TOKEN` auto-registers the Telegram slash-command menu, and any gateway key re-resolves which provider the runs route through.

---

## 1. Model auth — need at least one

The first two are the direct-to-Anthropic options; the rest are gateways. Setting several is fine and encouraged — the runner cascades through them and fails over.

| Secret | Where to get it |
|---|---|
| `CLAUDE_CODE_OAUTH_TOKEN` | Run `claude setup-token` locally → paste the `sk-ant-oat01-…` (valid 1 year). Or click AUTH in the dashboard. Runs on your Pro/Max subscription, no per-token billing |
| `ANTHROPIC_API_KEY` | console.anthropic.com — pay-as-you-go `sk-ant-…`. Also accepts any Anthropic-compatible key for a proxy |
| `OPENROUTER_API_KEY` | openrouter.ai/keys — `sk-or-…` |
| `BANKR_LLM_KEY` | bankr.bot/api-keys — `bk_…`, discounted Opus |
| `USEPOD_TOKEN` | usepod.ai — token is embedded in the base URL, treat as secret |
| `VENICE_API_KEY` | venice.ai/settings/api — routed through a local translator sidecar |
| `SURPLUS_API_KEY` | surplusintelligence.ai — `inf_…`, settles USDC on Base. Fund the wallet and `approve()` once before first use |
| `XAI_API_KEY` | console.x.ai — `xai-…`. Triple duty: X/tweet skills, the Grok gateway, and API-key auth for the grok harness |
| `GROK_CREDENTIALS` | Dashboard → AUTH → **Connect X account**. Base64 of your `~/.grok` session; runs the grok harness on a SuperGrok / X Premium+ entitlement. No CLI path for this one |

## 2. Notification channels — need at least one

| Secret | Where to get it |
|---|---|
| `TELEGRAM_BOT_TOKEN` | Message @BotFather → `/newbot` → copy the token |
| `TELEGRAM_CHAT_ID` | Message your new bot, then open `api.telegram.org/bot<TOKEN>/getUpdates` and read `message.chat.id` |
| `DISCORD_WEBHOOK_URL` | Channel Settings → Integrations → Webhooks → New Webhook → Copy URL (outbound only) |
| `DISCORD_BOT_TOKEN` + `DISCORD_CHANNEL_ID` | discord.com/developers/applications → your app → Bot. Add the `channels:history` scope. Only needed for inbound commands |
| `SLACK_WEBHOOK_URL` | api.slack.com/apps → Create App → Incoming Webhooks → Install → Copy URL |
| `SLACK_BOT_TOKEN` + `SLACK_CHANNEL_ID` | Same app → add `channels:history` + `reactions:write` scopes. Only for inbound |
| `RESEND_API_KEY` + `NOTIFY_EMAIL_TO` | resend.com/api-keys. Powers **all** outbound email — the notification channel, emailed digests, and security disclosures |

Telegram is the fastest to set up and the only one with inline buttons and slash-commands. Start there.

**If the channel isn't private to you**, set `DISCORD_ALLOWED_AUTHOR_ID` / `SLACK_ALLOWED_USER_ID` (variables). Left unset, *anyone* in the channel can command the agent. Telegram is already scoped to a single chat ID.

## 3. GitHub tokens

| Secret | Where to get it |
|---|---|
| `GITHUB_TOKEN` | Built in — nothing to set. Scoped to this repo only |
| `GH_GLOBAL` | github.com/settings/tokens → Fine-grained → select repos → Contents, Pull requests, Issues (read/write). Needed for anything cross-repo (`github-monitor`, `pr-review`, `feature`, `changelog push-to`). Auto-promoted to the run's `GITHUB_TOKEN` |
| `GH_READ_PAT` | Same page, read-only. Optional — enriches cross-repo/private reads (`bd-radar`) without granting write |
| `MCP_SECRETS_PAT` | github.com/settings/personal-access-tokens → **add this repo under Repository access** (a PAT without it 404s) → Repository permissions → Secrets: Read and write. Only needed if you use OAuth-connected MCP servers |

`MCP_SECRETS_PAT` gotcha: providers rotate the refresh token every run, and the runner needs this PAT to save each rotation back. Without it, auth breaks exactly one run after you connect. After adding it, re-connect any already-connected server once.

## 4. Skill API keys — all optional

Each is opt-in. Unset means the skills that want it skip or degrade.

| Secret | Used by | Where |
|---|---|---|
| `XAI_API_KEY` | tweet/X skills, `digest`, `shiplog`, `soul-builder` | console.x.ai |
| `COINGECKO_API_KEY` | crypto price/market skills | coingecko.com/en/api |
| `ALCHEMY_API_KEY` | on-chain RPC/data | dashboard.alchemy.com |
| `ETHERSCAN_API_KEY` | `tx-explain`, `investigation-report`, `onchain-monitor` | etherscan.io/apis — V2 is one multichain key covering Ethereum + Base |
| `BASESCAN_KEY` | `investigation-report` | Simplest is the **same value** as `ETHERSCAN_API_KEY` |
| `BASE_RPC_URL` | Base on-chain skills | docs.base.org/chain/node-providers — a public RPC is used by default |
| `BANKR_API_KEY` | `distribute-tokens` (real on-chain sends) | bankr.bot/api-keys — Wallet API, not the LLM key |
| `VERCEL_TOKEN` | `deploy-prototype` | vercel.com/account/settings/tokens |
| `REPLICATE_API_TOKEN` | `article --visual` hero images | replicate.com/account/api-tokens |
| `ADMANAGE_API_KEY` | `schedule-ads` | admanage.ai/api-docs |
| `RESEND_API_KEY` | `send-email`, `vuln-scanner` disclosures | resend.com |

## 5. Observability — optional

| Secret | Where |
|---|---|
| `LANGFUSE_PUBLIC_KEY` | Langfuse → Settings → API Keys — `pk-lf-…` |
| `LANGFUSE_SECRET_KEY` | Same page — `sk-lf-…` |

Both must be set for tracing to activate. Then every run streams to Langfuse as a trace with LLM calls, tokens, cost, and prompts.

## 6. Repo variables (not secrets)

Set with `gh variable set NAME "value"`.

| Variable | Effect |
|---|---|
| `ANTHROPIC_BASE_URL` | Point `ANTHROPIC_API_KEY` at any Anthropic-compatible endpoint, e.g. `https://api.deepseek.com/anthropic` |
| `GATEWAY_ORDER` | Space-separated provider names — override the failover priority |
| `GROK_MODEL` | Model for the Grok gateway path |
| `STATE_BACKEND` | `file` (default) · `dual` · `issues` — where run state lives |
| `HEALTH_ISSUES` | `0` disables the votable per-skill health Issues |
| `NOTIFY_MIN_SEVERITY` | Suppress notifications below this level |
| `NOTIFY_EMAIL_FROM` | Default `aeon@notifications.aeon.bot` — **must be a Resend-verified sender** |
| `NOTIFY_EMAIL_SUBJECT_PREFIX` | Default `[Aeon]` |
| `LANGFUSE_HOST` | Default `https://cloud.langfuse.com` (EU). Set the US host to switch region |
| `LANGFUSE_TRACING` | `0` to disable |
| `LANGFUSE_LOG_CONTENT` | `0` = metadata only, no prompt bodies |
| `DISCORD_ALLOWED_AUTHOR_ID` / `SLACK_ALLOWED_USER_ID` | Restrict who can command the agent inbound |
| `VENICE_BASE_URL` | Point Venice at a compatible endpoint |
