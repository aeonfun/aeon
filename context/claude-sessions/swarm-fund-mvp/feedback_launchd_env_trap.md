---
name: launchd env-var loader trap
description: launchd-managed processes don't load .env or shell rc — code that reads os.environ will silently disagree with .env-loading helpers
type: feedback
originSessionId: 63521ebc-9790-4737-af0d-9c88863bed5a
---
When patching code that runs under launchd (e.g. `ai.rswarm.trading-loop.plist`), always grep the detection logic for `os.environ.get(...)` and verify it matches whatever loader the actual code path uses.

**Why:** launchd ignores shell rc files AND `.env` by default — only `EnvironmentVariables` declared inside the plist itself reach the process environment. So `os.environ.get("HYPERLIQUID_PRIVATE_KEY")` returns `None` under launchd even when `.env` has the key. Helpers like `HyperliquidAdapter._load_env_key()` parse `.env` themselves, so they DO see the key. If your detection code uses one source and the helper uses the other, you get silent disagreement: the helper happily returns balance while your gate decides "no key, fall through to paper mode" — exactly the failure mode behind incident 2026-04-25 18:50:24 (loop logged "NAV: $10000.00 (paper mode — no HL key)" with "HL balance: $4.96" right below).

**How to apply:**
- Detection chain MUST mirror the helper's chain: `os.environ.get(KEY) or adapter._load_env_key()`, not just one source.
- Smoke-testing in a terminal where you `source .env` will pass even when launchd is broken. To replicate launchd's environment locally: `env -i PATH=$PATH HOME=$HOME .venv/bin/python ...` (strips inherited env to nothing).
- After any change touching env-var detection in launchd-managed code, restart the launchd job (`kill <PID>` — launchd respawns within `ThrottleInterval`s) and grep the next bootstrap log for the expected mode line.
- If you must add an env var that launchd should see, declare it in the `<key>EnvironmentVariables</key>` block of the plist; don't rely on the .env reader.
