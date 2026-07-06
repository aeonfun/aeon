# Verdikta Hunter Helpers

Python utilities for autonomous Verdikta bounty hunting on Base L2.

## Modules

### `verdikta_api.py` — API Client

Wraps `bounties.verdikta.org` REST API with auth, filtering, and submission flow.

```python
from helpers.verdikta_api import VerdiktaClient

client = VerdiktaClient(api_key="your-key")

# Discovery
bounties = client.list_open_bounties()
filtered = client.filter_bounties(
    bounties,
    min_bounty_eth=0.001,
    max_threshold=85,
    min_deadline_hours=48,
    keywords=["math", "graph"],
)
ranked = client.rank_bounties(filtered)

# Rubric
rubric = client.get_rubric(job_id=121)
for criterion in rubric["criteria"]:
    print(f"  {'⚠️ MUST' if criterion['must'] else f'weight {criterion[\"weight\"]}'}: "
          f"{criterion['description'][:80]}")
```

**Key features:**
- `filter_bounties()` — filter by reward, threshold, deadline, keywords, competition
- `_is_windowed_bounty()` — detect creator-approval vs oracle-evaluated bounties
- `rank_bounties()` — score by reward-to-difficulty ratio
- `bundle_upload()` / `bundle_complete()` / `confirm_submission()` — full submit flow

### `verdikta_onchain.py` — On-Chain Interaction

Handles the 5-step submission flow on Base L2 (chainId 8453).

```python
from helpers.verdikta_onchain import VerdiktaOnchain

chain = VerdiktaOnchain(
    rpc_url="https://mainnet.base.org",
    private_key="0x...",
)

# Balance check
print(f"Balance: {chain.get_balance_eth():.6f} ETH")

# Step 1: prepareSubmission (uses API-returned calldata)
result = chain.prepare_submission(
    job_id=97,
    calldata=api_calldata,  # From /submit/bundle
    dry_run=True,  # Always simulate first!
)

# Step 2: startPreparedSubmission (triggers oracle)
result = chain.start_submission(
    job_id=97,
    calldata=step2_calldata,  # From /bundle/complete
    eth_max_budget_wei=3600000000000000,  # From API
)

# Step 3: finalizeSubmission (claim refund/reward)
result = chain.finalize_submission(
    job_id=97,
    submission_id=5,
    calldata=step3_calldata,  # From /bundle/complete or cached
)
```

**Key features:**
- All RPC calls use standard `eth_` method names (`eth_getBalance`, `eth_gasPrice`, etc.)
- Prefers API-returned calldata over manual encoding
- Balance verification before every TX
- `dry_run` mode — simulates with `eth_call` before sending
- Automatic timeout simulation check (prevents wasted gas)
- Step 3 calldata caching from bundle/complete response
- Event log parsing for SubmissionPrepared

### `example_usage.py` — CLI

```bash
# Discover bounties
python -m helpers.example_usage discover --top 5 --max-threshold 85

# Check rubric
python -m helpers.example_usage rubric 121

# Submit (dry run first!)
python -m helpers.example_usage submit 121 --file report.md --dry-run

# Monitor evaluation
python -m helpers.example_usage monitor 121 5

# Finalize
python -m helpers.example_usage finalize 121 5 --dry-run
```

## Dependencies

```
requests>=2.28
web3>=6.0
eth-account>=0.10
eth-abi>=4.0
```

## Safety Notes

- **Always use `dry_run=True` first** — catches calldata errors, balance issues, and simulation failures before committing gas
- **Never hardcode private keys** — use `VERDIKTA_WALLET_KEY` env var
- **Balance formula**: `balance >= ethMaxBudget + (gas_limit × gas_price)` — check before every TX
- **Gas limits**: prepare=1M, start=4M, finalize=300K, timeout=2M+10gwei minimum
