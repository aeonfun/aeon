"""
Verdikta on-chain interaction — submit, monitor, and finalize bounties on Base L2.

Handles the full submission flow:
  1. prepareSubmission (gas only)
  2. confirm (backend, no TX)
  3. startPreparedSubmission (with ETH value)
  4. finalizeSubmission (claim refund/reward)

Usage:
    from verdikta_onchain import VerdiktaOnchain
    chain = VerdiktaOnchain(api_key="bot-xxxx", priv_key="0xxxxx")

    # Full submission flow
    result = chain.submit_bounty(
        bounty_id=97,
        report_path="report.md",
        alpha=200,
    )

    # Check status
    status = chain.get_submission_status(bounty_id=97, submission_id=0)

    # Finalize (claim refund)
    chain.finalize(bounty_id=97, submission_id=0)
"""

import json
import time
import requests
from pathlib import Path
from typing import Optional

try:
    from eth_account import Account
except ImportError:
    raise ImportError("pip install eth-account")

from verdikta_api import VerdiktaClient

# Constants
CONTRACT = "0x2Ae271f5E86bee449a36B943414b7C1a7b39772D"
CHAIN_ID = 8453
BASE_RPC = "https://mainnet.base.org"

# Gas limits
GAS_PREPARE = 1_000_000
GAS_START = 4_000_000
GAS_FINALIZE = 300_000
GAS_TIMEOUT = 2_000_000

# Function selectors (keccak256)
SELECTOR_PREPARE = "0xfae4a73d"
SELECTOR_START = "0xcb493514"
SELECTOR_FINALIZE = "0x1485eb7a"
SELECTOR_TIMEOUT = "0x6c2bf560"


class VerdiktaOnchain:
    """On-chain interaction with Verdikta bounty contract on Base L2."""

    def __init__(self, api_key: str, priv_key: str, rpc_url: str = BASE_RPC):
        self.api = VerdiktaClient(api_key)
        self.account = Account.from_key(priv_key)
        self.address = self.account.address
        self.rpc_url = rpc_url
        self._nonce = None

    # ── RPC Helpers ───────────────────────────────────────────────────

    def _rpc(self, method: str, params: list = None) -> dict:
        """Make JSON-RPC call to Base node."""
        resp = requests.post(
            self.rpc_url,
            json={"jsonrpc": "2.0", "method": method, "params": params or [], "id": 1},
            timeout=30,
        )
        return resp.json().get("result")

    def get_balance(self) -> int:
        """Get wallet balance in wei."""
        result = self._rpc("eth_getBalance", [self.address, "latest"])
        return int(result, 16)

    def get_nonce(self) -> int:
        """Get current nonce (cached for batch operations)."""
        if self._nonce is None:
            result = self._rpc("getTransactionCount", [self.address, "latest"])
            self._nonce = int(result, 16)
        return self._nonce

    def increment_nonce(self):
        """Increment cached nonce after sending TX."""
        self._nonce = self.get_nonce() + 1

    def get_gas_price(self) -> int:
        """Get current gas price in wei."""
        result = self._rpc("gasPrice")
        return int(result, 16)

    def send_tx(self, tx: dict) -> str:
        """Sign and send transaction, return TX hash."""
        signed = Account.sign_transaction(tx, self.account.key)
        tx_hash = self._rpc("sendRawTransaction", ["0x" + signed.raw_transaction.hex()])
        self.increment_nonce()
        return tx_hash

    def wait_for_tx(self, tx_hash: str, timeout: int = 120) -> dict:
        """Wait for TX receipt with timeout."""
        start = time.time()
        while time.time() - start < timeout:
            receipt = self._rpc("getTransactionReceipt", [tx_hash])
            if receipt:
                return receipt
            time.sleep(2)
        raise TimeoutError(f"TX {tx_hash} not confirmed within {timeout}s")

    def eth_call(self, to: str, data: str) -> str:
        """Simulate a transaction call."""
        return self._rpc("eth_call", [{"to": to, "data": data}, "latest"])

    def check_balance_sufficient(self, value_wei: int, gas_limit: int, gas_price: int) -> bool:
        """Check if balance covers value + gas."""
        total_needed = value_wei + (gas_limit * gas_price)
        balance = self.get_balance()
        if balance < total_needed:
            raise ValueError(
                f"Insufficient balance: have {balance/1e18:.6f} ETH, "
                f"need {total_needed/1e18:.6f} ETH "
                f"(value: {value_wei/1e18:.6f} + gas: {gas_limit * gas_price/1e18:.6f})"
            )
        return True

    # ── Submission Flow ───────────────────────────────────────────────

    def submit_bounty(
        self,
        bounty_id: int,
        report_path: str,
        additional_files: list[tuple[str, str]] = None,
        alpha: int = 200,
        max_oracle_fee_wei: int = 300_000_000_000_000,
        gas_price_gwei: float = 5,
        dry_run: bool = False,
    ) -> dict:
        """Full submission flow: upload → prepare → confirm → start → poll.

        Args:
            bounty_id: On-chain bounty ID
            report_path: Path to the main report markdown file
            additional_files: Extra files as (filename, content) tuples
            alpha: Quality vs timeliness (lower = quality, default 200)
            max_oracle_fee_wei: Max oracle fee in wei (default 0.0003 ETH)
            gas_price_gwei: Gas price in gwei
            dry_run: If True, simulate without sending TXs

        Returns:
            dict with submission_id, tx hashes, and status
        """
        gas_price = int(gas_price_gwei * 1e9)

        # Read report file
        report_content = Path(report_path).read_text()
        files = [("report.md", report_content)]
        if additional_files:
            files.extend(additional_files)

        print(f"[1/5] Uploading report for bounty #{bounty_id}...")
        bundle = self.api.bundle_upload(
            bounty_id=bounty_id,
            files=files,
            hunter_address=self.address,
            alpha=alpha,
            max_oracle_fee=max_oracle_fee_wei,
        )

        step1_calldata = bundle["transactions"][0]["data"]
        hunter_cid = bundle.get("hunterCid", "")
        eval_cid = bundle.get("evaluationCid", "")

        print(f"[2/5] Sending prepareSubmission TX...")
        step1_tx = {
            "to": CONTRACT,
            "value": 0,
            "data": bytes.fromhex(step1_calldata[2:] if step1_calldata.startswith("0x") else step1_calldata),
            "chainId": CHAIN_ID,
            "nonce": self.get_nonce(),
            "gas": GAS_PREPARE,
            "maxFeePerGas": gas_price,
            "maxPriorityFeePerGas": gas_price,
            "type": 2,
        }

        if dry_run:
            print("  [DRY RUN] Would send prepareSubmission TX")
            step1_hash = "0xDUMMY"
        else:
            self.check_balance_sufficient(0, GAS_PREPARE, gas_price)
            step1_hash = self.send_tx(step1_tx)
            print(f"  TX: {step1_hash}")
            receipt = self.wait_for_tx(step1_hash)
            if receipt.get("status") != "0x1":
                raise RuntimeError(f"prepareSubmission reverted: {receipt}")

        # Parse submissionId from receipt logs
        submission_id = None
        if not dry_run and receipt.get("logs"):
            for log in receipt["logs"]:
                if log.get("topics", [b""])[0].hex().startswith("df7bc54a"):
                    submission_id = int(log["topics"][2], 16)
                    break

        if submission_id is None:
            # Fallback: get from API
            time.sleep(5)
            subs = self.api.get_submissions(bounty_id)
            for s in subs:
                if s.get("hunter", "").lower() == self.address.lower():
                    submission_id = s["submissionId"]
                    break

        print(f"  Submission ID: {submission_id}")

        print(f"[3/5] Confirming submission (backend)...")
        if not dry_run:
            confirm = self.api.confirm_submission(
                bounty_id=bounty_id,
                submission_id=submission_id,
                hunter=self.address,
                hunter_cid=hunter_cid,
                eval_wallet=self.address,
            )
            print(f"  Confirmed: {confirm.get('success', False)}")

        print(f"[4/5] Getting step 2 calldata...")
        if not dry_run:
            complete = self.api.bundle_complete(bounty_id, step1_hash)
            step2_calldata = complete["transactions"][0]["data"]
            eth_max_budget = int(complete.get("parsed", {}).get("ethMaxBudget", max_oracle_fee_wei))
            step3_calldata = complete.get("transactions", [None, None, {}])[2].get("data", "")
        else:
            eth_max_budget = max_oracle_fee_wei
            step2_calldata = "0xDUMMY"
            step3_calldata = "0xDUMMY"

        print(f"  ethMaxBudget: {eth_max_budget/1e18:.6f} ETH")

        print(f"[5/5] Sending startPreparedSubmission TX...")
        step2_tx = {
            "to": CONTRACT,
            "value": eth_max_budget,
            "data": bytes.fromhex(step2_calldata[2:] if step2_calldata.startswith("0x") else step2_calldata),
            "chainId": CHAIN_ID,
            "nonce": self.get_nonce(),
            "gas": GAS_START,
            "maxFeePerGas": gas_price,
            "maxPriorityFeePerGas": gas_price,
            "type": 2,
        }

        if dry_run:
            print("  [DRY RUN] Would send startPreparedSubmission TX")
            step2_hash = "0xDUMMY"
        else:
            self.check_balance_sufficient(eth_max_budget, GAS_START, gas_price)
            step2_hash = self.send_tx(step2_tx)
            print(f"  TX: {step2_hash}")
            receipt2 = self.wait_for_tx(step2_hash)
            if receipt2.get("status") != "0x1":
                raise RuntimeError(f"startPreparedSubmission reverted: {receipt2}")

        print(f"\n✅ Submission complete!")
        print(f"  Bounty: #{bounty_id}")
        print(f"  Submission ID: {submission_id}")
        print(f"  Step 1 TX: {step1_hash}")
        print(f"  Step 2 TX: {step2_hash}")
        print(f"  Oracle cost: {eth_max_budget/1e18:.6f} ETH (refunded on finalize)")

        return {
            "bounty_id": bounty_id,
            "submission_id": submission_id,
            "step1_tx": step1_hash,
            "step2_tx": step2_hash,
            "step3_calldata": step3_calldata,
            "eth_max_budget": eth_max_budget,
            "hunter_cid": hunter_cid,
        }

    # ── Status Monitoring ─────────────────────────────────────────────

    def get_submission_status(self, bounty_id: int, submission_id: int) -> str:
        """Get current status of a submission."""
        subs = self.api.get_submissions(bounty_id)
        for s in subs:
            if s.get("submissionId") == submission_id:
                return s.get("status", "UNKNOWN")
        return "NOT_FOUND"

    def poll_until_evaluated(
        self, bounty_id: int, submission_id: int, timeout: int = 600, interval: int = 30
    ) -> str:
        """Poll submission status until evaluated or timeout.

        Args:
            bounty_id: Bounty ID
            submission_id: Submission ID
            timeout: Max seconds to wait
            interval: Seconds between polls

        Returns:
            Final status string
        """
        start = time.time()
        while time.time() - start < timeout:
            status = self.get_submission_status(bounty_id, submission_id)
            print(f"  Status: {status} ({int(time.time() - start)}s elapsed)")

            if status in ("EVALUATED_PASSED", "EVALUATED_FAILED", "WINNER", "ACCEPTED"):
                return status
            if status in ("REJECTED", "CANCELLED"):
                return status

            time.sleep(interval)

        raise TimeoutError(f"Submission not evaluated within {timeout}s")

    # ── Finalize ──────────────────────────────────────────────────────

    def finalize(
        self,
        bounty_id: int,
        submission_id: int,
        gas_price_gwei: float = 5,
        dry_run: bool = False,
    ) -> str:
        """Finalize submission to claim refund/reward.

        Args:
            bounty_id: Bounty ID
            submission_id: Submission ID
            gas_price_gwei: Gas price in gwei
            dry_run: If True, simulate only

        Returns:
            TX hash of finalize transaction
        """
        status = self.get_submission_status(bounty_id, submission_id)
        print(f"Current status: {status}")

        if status == "WINNER":
            print("Already awarded — no finalize needed!")
            return None

        # Get step 3 calldata from bundle/complete response
        # In practice, you'd save this from the submit_bounty call
        # For now, we use the contract directly
        gas_price = int(gas_price_gwei * 1e9)

        print(f"Sending finalizeSubmission TX...")
        # Note: In production, use the API-returned step3 calldata
        # This is a simplified version that calls finalize directly
        from eth_abi import encode
        finalize_data = SELECTOR_FINALIZE + encode(
            ["uint256", "uint256"],
            [bounty_id, submission_id]
        ).hex()

        finalize_tx = {
            "to": CONTRACT,
            "value": 0,
            "data": bytes.fromhex(finalize_data[2:] if finalize_data.startswith("0x") else finalize_data),
            "chainId": CHAIN_ID,
            "nonce": self.get_nonce(),
            "gas": GAS_FINALIZE,
            "maxFeePerGas": gas_price,
            "maxPriorityFeePerGas": gas_price,
            "type": 2,
        }

        if dry_run:
            print("  [DRY RUN] Would send finalizeSubmission TX")
            return "0xDUMMY"

        self.check_balance_sufficient(0, GAS_FINALIZE, gas_price)
        tx_hash = self.send_tx(finalize_tx)
        print(f"  TX: {tx_hash}")
        receipt = self.wait_for_tx(tx_hash)

        if receipt.get("status") == "0x1":
            print(f"✅ Finalized successfully!")
        else:
            print(f"⚠️ TX reverted — may need retry")

        return tx_hash

    # ── Timeout ───────────────────────────────────────────────────────

    def timeout(
        self,
        bounty_id: int,
        submission_id: int,
        gas_price_gwei: float = 10,
    ) -> str:
        """Fail a timed-out submission (reclaim escrowed ETH).

        IMPORTANT: Only call after verifying on-chain that the submission
        is actually timed out. Check with eth_call first!

        Args:
            bounty_id: Bounty ID
            submission_id: Submission ID
            gas_price_gwei: Gas price (10 gwei minimum recommended)

        Returns:
            TX hash
        """
        gas_price = int(gas_price_gwei * 1e9)

        # Simulate first
        from eth_abi import encode
        timeout_data = SELECTOR_TIMEOUT + encode(
            ["uint256", "uint256"],
            [bounty_id, submission_id]
        ).hex()

        # eth_call to simulate
        result = self.eth_call(CONTRACT, timeout_data)
        if result == "0x" or (isinstance(result, str) and len(result) > 2):
            print(f"Simulation succeeded, sending TX...")
        else:
            print(f"⚠️ Simulation returned: {result}")
            print(f"TX may revert — proceed with caution")

        timeout_tx = {
            "to": CONTRACT,
            "value": 0,
            "data": bytes.fromhex(timeout_data[2:] if timeout_data.startswith("0x") else timeout_data),
            "chainId": CHAIN_ID,
            "nonce": self.get_nonce(),
            "gas": GAS_TIMEOUT,
            "maxFeePerGas": gas_price,
            "maxPriorityFeePerGas": gas_price,
            "type": 2,
        }

        self.check_balance_sufficient(0, GAS_TIMEOUT, gas_price)
        tx_hash = self.send_tx(timeout_tx)
        print(f"  TX: {tx_hash}")
        return tx_hash


# ── Convenience Functions ─────────────────────────────────────────────

def submit_bounty(api_key, priv_key, bounty_id, report_path, **kwargs):
    """Quick submit function."""
    chain = VerdiktaOnchain(api_key, priv_key)
    return chain.submit_bounty(bounty_id, report_path, **kwargs)


def check_status(api_key, bounty_id, submission_id):
    """Quick status check."""
    client = VerdiktaClient(api_key)
    subs = client.get_submissions(bounty_id)
    for s in subs:
        if s.get("submissionId") == submission_id:
            return s.get("status", "UNKNOWN")
    return "NOT_FOUND"


def finalize_submission(priv_key, bounty_id, submission_id, api_key=None):
    """Quick finalize."""
    chain = VerdiktaOnchain(api_key, priv_key)
    return chain.finalize(bounty_id, submission_id)
