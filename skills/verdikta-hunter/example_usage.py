#!/usr/bin/env python3
"""
Example: Autonomous Verdikta bounty hunting.

Demonstrates the full workflow:
1. Discover open bounties
2. Filter by criteria
3. Check rubric
4. Submit a report
5. Monitor evaluation
6. Finalize to claim reward
"""

import os
from verdikta_api import VerdiktaClient
from verdikta_onchain import VerdiktaOnchain

# Configuration
API_KEY = os.environ.get("VERDIKTA_API_KEY", "bot-your-key-here")
PRIV_KEY = os.environ.get("BASE_WALLET_KEY", "0xyourprivatekey")
HUNTER_ADDRESS = "0xYourWalletAddress"


def discover_bounties():
    """Find the best bounties to target."""
    client = VerdiktaClient(API_KEY)

    print("=== Open Bounties ===\n")
    bounties = client.filter_bounties(
        min_bounty_eth=0.001,
        max_threshold=85,       # Easier thresholds
        max_submissions=5,      # Less competition
    )

    for b in bounties[:10]:
        rubric = b.get("_rubric", {})
        print(f"#{b['jobId']} | {b['bountyAmount']} ETH | threshold: {b['threshold']}%")
        print(f"  {b['title'][:70]}")
        print(f"  Submissions: {b['submissionCount']} | Must-pass: {rubric['must_pass']} | Weighted: {rubric['weighted']}")

        # Show rubric criteria
        for c in rubric.get("criteria", []):
            must = "MUST-PASS" if c.get("must") else f"weight {c.get('weight')}"
            print(f"    [{must}] {c['id']}: {c['description'][:60]}")
        print()

    return bounties


def check_rubric(bounty_id: int):
    """Analyze rubric for a specific bounty."""
    client = VerdiktaClient(API_KEY)
    rubric = client.get_rubric(bounty_id)

    print(f"\n=== Rubric for #{bounty_id} ===")
    print(f"Title: {rubric.get('title', 'N/A')}")

    for c in rubric.get("criteria", []):
        must = "MUST-PASS" if c.get("must") else f"weight {c.get('weight')}"
        print(f"\n  [{must}] {c['id']}")
        print(f"  {c['description']}")

        if c.get("must"):
            print(f"  ⚠️ Binary gate — fail this = score 0 regardless of other criteria")


def submit_to_bounty(bounty_id: int, report_path: str):
    """Submit a report to a bounty."""
    chain = VerdiktaOnchain(API_KEY, PRIV_KEY)

    # Check balance first
    balance = chain.get_balance()
    print(f"\nWallet balance: {balance/1e18:.6f} ETH")

    if balance < 0.005 * 1e18:
        print("⚠️ Low balance — may not cover oracle prepay + gas")
        print("  Consider reducing gas_price_gwei or topping up wallet")

    # Submit
    result = chain.submit_bounty(
        bounty_id=bounty_id,
        report_path=report_path,
        alpha=200,              # Quality focus
        max_oracle_fee_wei=300_000_000_000_000,  # 0.0003 ETH
        gas_price_gwei=5,
        dry_run=False,          # Set True to simulate
    )

    print(f"\nSubmission result:")
    print(f"  Submission ID: {result['submission_id']}")
    print(f"  Step 1 TX: {result['step1_tx']}")
    print(f"  Step 2 TX: {result['step2_tx']}")

    return result


def monitor_and_finalize(bounty_id: int, submission_id: int):
    """Monitor evaluation and finalize when ready."""
    chain = VerdiktaOnchain(API_KEY, PRIV_KEY)

    print(f"\nMonitoring submission #{submission_id} on bounty #{bounty_id}...")

    # Poll until evaluated
    status = chain.poll_until_evaluated(
        bounty_id=bounty_id,
        submission_id=submission_id,
        timeout=600,
        interval=30,
    )

    print(f"\nFinal status: {status}")

    if status in ("EVALUATED_PASSED", "EVALUATED_FAILED"):
        print("Finalizing to claim refund...")
        tx_hash = chain.finalize(bounty_id, submission_id)
        if tx_hash:
            print(f"Finalize TX: {tx_hash}")

    elif status == "WINNER":
        print("🎉 Bounty awarded! Payment sent to wallet.")

    return status


# ── Main ──────────────────────────────────────────────────────────────

if __name__ == "__main__":
    import sys

    if len(sys.argv) < 2:
        print("Usage:")
        print("  python example_usage.py discover          # List best bounties")
        print("  python example_usage.py rubric <id>       # Check rubric")
        print("  python example_usage.py submit <id> <md>  # Submit report")
        print("  python example_usage.py monitor <id> <sub> # Monitor + finalize")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "discover":
        discover_bounties()

    elif cmd == "rubric" and len(sys.argv) > 2:
        check_rubric(int(sys.argv[2]))

    elif cmd == "submit" and len(sys.argv) > 3:
        submit_to_bounty(int(sys.argv[2]), sys.argv[3])

    elif cmd == "monitor" and len(sys.argv) > 3:
        monitor_and_finalize(int(sys.argv[2]), int(sys.argv[3]))

    else:
        print(f"Unknown command: {cmd}")
