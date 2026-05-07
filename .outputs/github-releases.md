*GitHub Releases — 2026-05-07* — 34 updates · 🔴 4 asap · 🟡 1 soon · 🔵 24 fyi · ⚪ 5 skipped

🔴 UPGRADE ASAP
🔴 [vercel/next.js v16.2.5](https://github.com/vercel/next.js/releases/tag/v16.2.5) — Patches DoS in Server Components, middleware/proxy bypass via segment-prefetch, Cache-Components connection exhaustion.
🔴 [vercel/next.js v15.5.16](https://github.com/vercel/next.js/releases/tag/v15.5.16) — Backports the same three GHSA fixes to the v15 line.
🔴 [langchain-ai/langchain langchain==0.3.29](https://github.com/langchain-ai/langchain/releases/tag/langchain%3D%3D0.3.29) — Restricts deserialization in storage._lc_store; hardens load() against untrusted manifests.
🔴 [langchain-ai/langchain langchain-core==1.3.3](https://github.com/langchain-ai/langchain/releases/tag/langchain-core%3D%3D1.3.3) — Hardens load() against untrusted manifests; same fix mirrored in core.

🟡 UPGRADE SOON
🟡 [openai/openai-python v2.35.0](https://github.com/openai/openai-python/releases/tag/v2.35.0) — Removes legacy python CLI entrypoint (renamed); ships image-2 API.

🔵 FYI
🔵 [ggerganov/llama.cpp b9050](https://github.com/ggml-org/llama.cpp/releases/tag/b9050) — Fixes missing ggml_backend_load_all() call on llama init.
🔵 [openai/openai-agents-python v0.16.0](https://github.com/openai/openai-agents-python/releases/tag/v0.16.0) — Switches SDK default model to gpt-5.4-mini; pin a model to keep prior behavior.
🔵 [anthropics/claude-agent-sdk-python v0.1.76](https://github.com/anthropics/claude-agent-sdk-python/releases/tag/v0.1.76) — Adds api_error_status on ResultMessage; fixes ToolPermissionContext suggestions deserialization.
🔵 [anthropics/claude-code v2.1.132](https://github.com/anthropics/claude-code/releases/tag/v2.1.132) — Adds CLAUDE_CODE_SESSION_ID env and alt-screen-disable env; fixes external SIGINT graceful shutdown.
🔵 [ggerganov/llama.cpp b9049](https://github.com/ggml-org/llama.cpp/releases/tag/b9049) — Adds MiniCPM-V 4.6 multimodal model support.
🔵 [openai/openai-python v2.35.1](https://github.com/openai/openai-python/releases/tag/v2.35.1) — Fixes imagegen size enum regression from prior release.
🔵 [ggerganov/llama.cpp b9048](https://github.com/ggml-org/llama.cpp/releases/tag/b9048) — Fixes crash on unsupported model architecture.
🔵 [ggerganov/llama.cpp b9047](https://github.com/ggml-org/llama.cpp/releases/tag/b9047) — Fixes device-memory fit logic for unknown GPUs.
🔵 [anthropics/anthropic-sdk-python v0.100.0](https://github.com/anthropics/anthropic-sdk-python/releases/tag/v0.100.0) — Adds Managed Agents multiagents and outcomes, webhooks, and vault validation.
🔵 [anthropics/anthropic-sdk-typescript sdk-v0.95.0](https://github.com/anthropics/anthropic-sdk-typescript/releases/tag/sdk-v0.95.0) — Adds Managed Agents multiagents and outcomes, webhooks, and vault validation.
… +14 more

⚪ SKIP
⚪ [vercel/next.js v16.3.0-canary.14](https://github.com/vercel/next.js/releases/tag/v16.3.0-canary.14) — Canary: shrinks JsValue from 64 to 32 bytes; loader-tree depth ordering.
⚪ [vercel/next.js v16.3.0-canary.13](https://github.com/vercel/next.js/releases/tag/v16.3.0-canary.13) — Canary: disables instant validations in draft mode.
⚪ [vercel/next.js v16.3.0-canary.12](https://github.com/vercel/next.js/releases/tag/v16.3.0-canary.12) — Canary: detects use-cache module-scope deadlocks early; React upstream bump.
… +2 more

_sources: ok=18 notfound=0 ratelimited=0 error=0_

