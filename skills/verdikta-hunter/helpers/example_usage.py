"""Example CLI usage for Verdikta bounty hunting helpers.

Demonstrates the complete workflow: discover → filter → rank → submit.

Usage:
    python -m helpers.example_usage discover
    python -m helpers.example_usage rubric 121
    python -m helpers.example_usage submit 121 --dry-run
    python -m helpers.example_usage monitor 121 5
"""

import argparse
import json
import os
import sys

from helpers.verdikta_api import VerdiktaClient
from helpers.verdikta_onchain import VerdiktaOnchain


def cmd_discover(args):
    """Discover and rank open bounties."""
    client = VerdiktaClient()
    bounties = client.list_open_bounties()
    print(f"\n📋 Found {len(bounties)} open bounties\n")

    filtered = client.filter_bounties(
        bounties,
        hunter_address=args.hunter,
        min_bounty_eth=args.min_reward,
        max_threshold=args.max_threshold,
        min_deadline_hours=args.min_hours,
        keywords=args.keywords.split(",") if args.keywords else None,
    )
    print(f"🔍 After filters: {len(filtered)} bounties\n")

    ranked = client.rank_bounties(filtered)

    for i, b in enumerate(ranked[:args.top], 1):
        hours = b.get("_hours_until_deadline", "?")
        score = b.get("_opportunity_score", 0)
        windowed = "📌 windowed" if client._is_windowed_bounty(b) else ""
        print(f"  {i}. #{b['jobId']} — {b.get('bountyAmount', 0)} ETH "
              f"(threshold {b.get('threshold', '?')}%) "
              f"— {hours}h left — score: {score} {windowed}")
        print(f"     {b.get('title', 'No title')[:80]}")
        print()


def cmd_rubric(args):
    """Show rubric for a specific bounty."""
    client = VerdiktaClient()
    rubric = client.get_rubric(args.job_id)
    bounty = client.get_bounty(args.job_id)

    print(f"\n📝 Bounty #{args.job_id}: {bounty.get('title', 'N/A')}")
    print(f"   Reward: {bounty.get('bountyAmount', 0)} ETH")
    print(f"   Threshold: {bounty.get('threshold', '?')}%")
    print(f"   Windowed: {VerdiktaClient._is_windowed_bounty(bounty)}")
    print(f"\n   Rubric:")

    for c in rubric.get("criteria", []):
        must = "⚠️ MUST-PASS" if c.get("must") else f"weight {c.get('weight', 0)}"
        print(f"   - [{must}] {c.get('description', '')[:100]}")


def cmd_submit(args):
    """Submit to a bounty (or dry-run)."""
    client = VerdiktaClient()
    chain = VerdiktaOnchain()

    if not chain.address:
        print("❌ No wallet configured (set VERDIKTA_WALLET_KEY)")
        sys.exit(1)

    bounty = client.get_bounty(args.job_id)
    print(f"\n🎯 Submitting to #{args.job_id}: {bounty.get('title', 'N/A')}")
    print(f"   Reward: {bounty.get('bountyAmount', 0)} ETH")
    print(f"   Threshold: {bounty.get('threshold', '?')}%")

    # Check if windowed
    if VerdiktaClient._is_windowed_bounty(bounty):
        print("   ⚠️  This is a windowed (creator-approval) bounty")
        print("   Oracle prepay not required, but approval may take longer")

    # Check balance
    balance = chain.get_balance_eth()
    print(f"\n   💰 Balance: {balance:.6f} ETH")

    if args.dry_run:
        print("   🔍 DRY RUN — no transactions will be sent\n")

    # Step 1: Upload and get calldata
    if not os.path.exists(args.file):
        print(f"❌ File not found: {args.file}")
        sys.exit(1)

    print("   📤 Uploading files...")
    bundle = client.bundle_upload(
        job_id=args.job_id,
        files=[args.file],
        hunter_address=chain.address,
        alpha=args.alpha,
    )

    step1_data = bundle.get("transactions", [{}])[0].get("data", "")
    hunter_cid = bundle.get("hunterCid", "")
    print(f"   ✅ Upload complete, hunterCid: {hunter_cid[:20]}...")

    # Step 2: prepareSubmission
    print("   📝 Step 1: prepareSubmission...")
    result = chain.prepare_submission(
        job_id=args.job_id,
        calldata=step1_data,
        dry_run=args.dry_run,
    )
    if not result.get("success"):
        print(f"   ❌ Failed: {result.get('error')}")
        sys.exit(1)

    if args.dry_run:
        print("   ✅ Simulation passed — ready for real submission")
        return

    step1_tx = result["tx_hash"]
    print(f"   ✅ TX: {step1_tx}")

    # Parse receipt for submissionId
    receipt = chain.w3.eth.get_receipt(step1_tx)
    parsed = chain.parse_submission_prepared(receipt)
    if parsed:
        submission_id = parsed["submission_id"]
        eval_wallet = parsed["eval_wallet"]
        print(f"   📋 Submission ID: {submission_id}")

    print("\n   ⏸️  Submission queued. Complete the flow with:")
    print(f"   1. POST /api/jobs/{args.job_id}/submissions/confirm")
    print(f"   2. bundle_complete with step1 tx hash")
    print(f"   3. startPreparedSubmission with ethMaxBudget")
    print(f"   4. Poll until evaluated")
    print(f"   5. finalizeSubmission to claim")


def cmd_monitor(args):
    """Monitor a submission until evaluated."""
    client = VerdiktaClient()
    chain = VerdiktaOnchain()

    print(f"\n⏳ Monitoring bounty #{args.job_id}, submission #{args.submission_id}")
    result = chain.poll_until_evaluated(
        api_client=client,
        job_id=args.job_id,
        submission_id=args.submission_id,
        timeout_minutes=args.timeout,
    )

    status = result.get("status", "UNKNOWN")
    score = result.get("score", "N/A")
    print(f"\n📊 Final status: {status}")
    if score:
        print(f"   Score: {score}")

    if status in ("EVALUATED_PASSED", "WINNER", "ACCEPTED"):
        print("   🎉 Ready to finalize!")
    elif status == "EVALUATED_FAILED":
        print("   💀 Failed — finalize to reclaim escrow")


def cmd_finalize(args):
    """Finalize a submission to claim refund/reward."""
    chain = VerdiktaOnchain()

    print(f"\n🏁 Finalizing bounty #{args.job_id}, submission #{args.submission_id}")

    if args.dry_run:
        print("   🔍 DRY RUN — simulating only\n")

    result = chain.finalize_submission(
        job_id=args.job_id,
        submission_id=args.submission_id,
        calldata=args.calldata,
        dry_run=args.dry_run,
    )

    if result.get("success"):
        if args.dry_run:
            print("   ✅ Simulation passed")
        else:
            print(f"   ✅ TX: {result['tx_hash']}")
    else:
        print(f"   ❌ Failed: {result.get('error')}")


def main():
    parser = argparse.ArgumentParser(
        description="Verdikta Bounty Hunter CLI",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python -m helpers.example_usage discover --top 5
  python -m helpers.example_usage rubric 121
  python -m helpers.example_usage submit 121 --file report.md --dry-run
  python -m helpers.example_usage monitor 121 5
  python -m helpers.example_usage finalize 121 5 --dry-run
        """,
    )
    sub = parser.add_subparsers(dest="command", required=True)

    # discover
    p = sub.add_parser("discover", help="Find and rank open bounties")
    p.add_argument("--hunter", default="", help="Our wallet address")
    p.add_argument("--min-reward", type=float, default=0.001, help="Min reward ETH")
    p.add_argument("--max-threshold", type=int, default=90, help="Max threshold %")
    p.add_argument("--min-hours", type=float, default=24, help="Min hours to deadline")
    p.add_argument("--keywords", default="", help="Comma-separated keywords")
    p.add_argument("--top", type=int, default=10, help="Show top N results")

    # rubric
    p = sub.add_parser("rubric", help="Show bounty rubric")
    p.add_argument("job_id", type=int, help="Bounty ID")

    # submit
    p = sub.add_parser("submit", help="Submit to a bounty")
    p.add_argument("job_id", type=int, help="Bounty ID")
    p.add_argument("--file", required=True, help="Report file to submit")
    p.add_argument("--alpha", type=int, default=200, help="Quality weight (0-1000)")
    p.add_argument("--dry-run", action="store_true", help="Simulate only")

    # monitor
    p = sub.add_parser("monitor", help="Monitor submission status")
    p.add_argument("job_id", type=int, help="Bounty ID")
    p.add_argument("submission_id", type=int, help="Submission ID")
    p.add_argument("--timeout", type=int, default=30, help="Timeout minutes")

    # finalize
    p = sub.add_parser("finalize", help="Finalize a submission")
    p.add_argument("job_id", type=int, help="Bounty ID")
    p.add_argument("submission_id", type=int, help="Submission ID")
    p.add_argument("--calldata", default=None, help="Step 3 calldata (optional)")
    p.add_argument("--dry-run", action="store_true", help="Simulate only")

    args = parser.parse_args()
    cmd_map = {
        "discover": cmd_discover,
        "rubric": cmd_rubric,
        "submit": cmd_submit,
        "monitor": cmd_monitor,
        "finalize": cmd_finalize,
    }
    cmd_map[args.command](args)


if __name__ == "__main__":
    main()
