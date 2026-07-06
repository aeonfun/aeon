"""Verdikta on-chain interaction for Base L2 (chainId 8453).

Handles the full submission flow: prepare → confirm → start → poll → finalize.
All RPC calls use standard eth_ method names. Prefers API-returned calldata
over manual encoding. Includes dry_run mode and balance verification.

Usage:
    from helpers.verdikta_onchain import VerdiktaOnchain

    chain = VerdiktaOnchain(rpc_url="https://mainnet.base.org", private_key="0x...")
    result = chain.submit_bounty(job_id=97, step1_calldata="0x...", ...)
    chain.finalize(job_id=97, submission_id=5, step3_calldata="0x...")
"""

import os
import time
import json
from typing import Optional

from web3 import Web3
from eth_account import Account

# Known contract address
BOUNTY_CONTRACT = "0x2Ae271f5E86bee449a36B943414b7C1a7b39772D"
CHAIN_ID = 8453  # Base L2


class VerdiktaOnchain:
    """On-chain interaction with Verdikta BountyEscrow contract on Base."""

    def __init__(
        self,
        rpc_url: Optional[str] = None,
        private_key: Optional[str] = None,
        contract_address: str = BOUNTY_CONTRACT,
        chain_id: int = CHAIN_ID,
    ):
        self.rpc_url = rpc_url or os.environ.get("VERDIKTA_RPC_URL", "https://mainnet.base.org")
        self.private_key = private_key or os.environ.get("VERDIKTA_WALLET_KEY", "")
        self.contract_address = Web3.to_checksum_address(contract_address)
        self.chain_id = chain_id

        self.w3 = Web3(Web3.HTTPProvider(self.rpc_url))
        if self.private_key:
            self.account = Account.from_key(self.private_key)
            self.address = self.account.address
        else:
            self.account = None
            self.address = None

        # Cache for step3 calldata from bundle/complete
        self._step3_calldata_cache: dict[tuple[int, int], str] = {}

    # ── Balance & Gas ─────────────────────────────────────────────────

    def get_balance(self, address: Optional[str] = None) -> int:
        """Get ETH balance in wei using eth_getBalance.

        Args:
            address: Wallet address (defaults to our address).

        Returns:
            Balance in wei.
        """
        addr = address or self.address
        if not addr:
            raise ValueError("No address configured")
        return self.w3.eth.get_balance(Web3.to_checksum_address(addr))

    def get_balance_eth(self, address: Optional[str] = None) -> float:
        """Get ETH balance as float."""
        return Web3.from_wei(self.get_balance(address), "ether")

    def get_gas_price(self) -> int:
        """Get current gas price using eth_gasPrice."""
        return self.w3.eth.gas_price

    def get_nonce(self, address: Optional[str] = None) -> int:
        """Get transaction count (nonce) using eth_getTransactionCount."""
        addr = address or self.address
        return self.w3.eth.get_transaction_count(
            Web3.to_checksum_address(addr), "pending"
        )

    def estimate_gas(self, tx: dict) -> int:
        """Estimate gas for a transaction using eth_estimateGas."""
        return self.w3.eth.estimate_gas(tx)

    def check_balance_for_tx(
        self,
        value_wei: int,
        gas_limit: int,
        gas_price_wei: int,
    ) -> tuple[bool, str]:
        """Verify sufficient balance for a transaction.

        Args:
            value_wei: Transaction value in wei.
            gas_limit: Gas limit.
            gas_price_wei: Gas price in wei.

        Returns:
            (is_sufficient, message) tuple.
        """
        balance = self.get_balance()
        total_needed = value_wei + (gas_limit * gas_price_wei)
        if balance < total_needed:
            return False, (
                f"Insufficient balance: have {Web3.from_wei(balance, 'ether'):.6f} ETH, "
                f"need {Web3.from_wei(total_needed, 'ether'):.6f} ETH "
                f"(value={Web3.from_wei(value_wei, 'ether'):.6f} + "
                f"gas={Web3.from_wei(gas_limit * gas_price_wei, 'ether'):.6f})"
            )
        return True, f"Balance OK: {Web3.from_wei(balance, 'ether'):.6f} ETH"

    # ── Transaction Helpers ───────────────────────────────────────────

    def build_and_send_tx(
        self,
        to: str,
        data: str,
        value_wei: int = 0,
        gas_limit: int = 300_000,
        gas_price_gwei: float = 5.0,
        dry_run: bool = False,
    ) -> dict:
        """Build, sign, and send a transaction.

        Args:
            to: Destination address.
            data: Calldata (hex string starting with 0x).
            value_wei: ETH value in wei.
            gas_limit: Gas limit.
            gas_price_gwei: Gas price in gwei.
            dry_run: If True, simulate only (eth_call), don't send.

        Returns:
            Dict with tx_hash, receipt, or simulation result.
        """
        gas_price_wei = Web3.to_wei(gas_price_gwei, "gwei")

        # Balance check
        ok, msg = self.check_balance_for_tx(value_wei, gas_limit, gas_price_wei)
        if not ok:
            return {"success": False, "error": msg}

        tx = {
            "to": Web3.to_checksum_address(to),
            "value": value_wei,
            "data": bytes.fromhex(data.replace("0x", "")),
            "chainId": self.chain_id,
            "nonce": self.get_nonce(),
            "gas": gas_limit,
            "maxFeePerGas": gas_price_wei,
            "maxPriorityFeePerGas": gas_price_wei,
            "type": 2,  # EIP-1559
        }

        if dry_run:
            # Simulate with eth_call
            try:
                result = self.w3.eth.call(tx)
                return {
                    "success": True,
                    "dry_run": True,
                    "simulation": "passed",
                    "result": result.hex(),
                }
            except Exception as e:
                return {"success": False, "dry_run": True, "error": str(e)}

        # Sign and send
        signed = Account.sign_transaction(tx, self.private_key)
        tx_hash = self.w3.eth.send_raw_transaction(signed.raw_transaction)
        receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash, timeout=120)

        return {
            "success": receipt["status"] == 1,
            "tx_hash": tx_hash.hex(),
            "block_number": receipt["blockNumber"],
            "gas_used": receipt["gasUsed"],
            "status": receipt["status"],
        }

    # ── Submission Flow ───────────────────────────────────────────────

    def prepare_submission(
        self,
        job_id: int,
        calldata: str,
        gas_limit: int = 1_000_000,
        gas_price_gwei: float = 5.0,
        dry_run: bool = False,
    ) -> dict:
        """Step 1: prepareSubmission — creates submission record on-chain.

        Uses API-returned calldata from /submit/bundle or /submit/prepare.
        Value is 0 (gas only).

        Args:
            job_id: Bounty ID.
            calldata: API-returned calldata for prepareSubmission.
            gas_limit: 1M recommended.
            gas_price_gwei: 5 gwei recommended.
            dry_run: Simulate only.

        Returns:
            TX result dict.
        """
        return self.build_and_send_tx(
            to=self.contract_address,
            data=calldata,
            value_wei=0,
            gas_limit=gas_limit,
            gas_price_gwei=gas_price_gwei,
            dry_run=dry_run,
        )

    def start_submission(
        self,
        job_id: int,
        calldata: str,
        eth_max_budget_wei: int,
        gas_limit: int = 4_000_000,
        gas_price_gwei: float = 1.0,
        dry_run: bool = False,
    ) -> dict:
        """Step 2: startPreparedSubmission — triggers oracle evaluation.

        Uses API-returned calldata from /bundle/complete.
        Value = ethMaxBudget (from API, in wei).

        Args:
            job_id: Bounty ID.
            calldata: API-returned calldata for startPreparedSubmission.
            eth_max_budget_wei: Oracle prepay in wei (from API).
            gas_limit: 4M recommended (lower causes out-of-gas).
            gas_price_gwei: 0.5-1 gwei recommended for low balance.
            dry_run: Simulate only.

        Returns:
            TX result dict.
        """
        return self.build_and_send_tx(
            to=self.contract_address,
            data=calldata,
            value_wei=eth_max_budget_wei,
            gas_limit=gas_limit,
            gas_price_gwei=gas_price_gwei,
            dry_run=dry_run,
        )

    def finalize_submission(
        self,
        job_id: int,
        submission_id: int,
        calldata: Optional[str] = None,
        gas_limit: int = 300_000,
        gas_price_gwei: float = 5.0,
        dry_run: bool = False,
    ) -> dict:
        """Step 3: finalizeSubmission — claim refund/reward.

        Uses cached calldata from bundle/complete if available,
        falls back to manual encoding.

        Args:
            job_id: Bounty ID.
            submission_id: Submission ID.
            calldata: API-returned calldata (preferred). If None, uses cache.
            gas_limit: 300K recommended.
            gas_price_gwei: 5 gwei recommended.
            dry_run: Simulate only.

        Returns:
            TX result dict.
        """
        # Priority: provided > cached > manual fallback
        finalize_data = (
            calldata
            or self._step3_calldata_cache.get((job_id, submission_id))
            or self._encode_finalize_fallback(job_id, submission_id)
        )

        return self.build_and_send_tx(
            to=self.contract_address,
            data=finalize_data,
            value_wei=0,
            gas_limit=gas_limit,
            gas_price_gwei=gas_price_gwei,
            dry_run=dry_run,
        )

    def timeout_submission(
        self,
        job_id: int,
        submission_id: int,
        gas_limit: int = 2_000_000,
        gas_price_gwei: float = 10.0,
        dry_run: bool = False,
    ) -> dict:
        """Fail a timed-out submission to reclaim escrow.

        IMPORTANT: Always verify on-chain that the submission is actually
        timed out before calling this. Use eth_call to simulate first.

        Args:
            job_id: Bounty ID.
            submission_id: Submission ID.
            gas_limit: 2M recommended.
            gas_price_gwei: 10 gwei MINIMUM (5 gwei causes revert).
            dry_run: Simulate only (ALWAYS simulate first!).

        Returns:
            TX result dict.
        """
        calldata = self._encode_timeout(job_id, submission_id)

        # Always simulate first
        sim = self.build_and_send_tx(
            to=self.contract_address,
            data=calldata,
            value_wei=0,
            gas_limit=gas_limit,
            gas_price_gwei=gas_price_gwei,
            dry_run=True,
        )
        if not sim.get("success"):
            return {
                "success": False,
                "error": f"Simulation failed: {sim.get('error')}. "
                         "Submission may not be timed out yet.",
                "simulation": sim,
            }

        if dry_run:
            return sim

        return self.build_and_send_tx(
            to=self.contract_address,
            data=calldata,
            value_wei=0,
            gas_limit=gas_limit,
            gas_price_gwei=gas_price_gwei,
            dry_run=False,
        )

    # ── Calldata Encoding ─────────────────────────────────────────────

    def _encode_finalize_fallback(self, job_id: int, submission_id: int) -> str:
        """Manual calldata encoding for finalizeSubmission (fallback only).

        Prefer API-returned calldata. This is a last resort when cache is empty.
        """
        from eth_abi import encode
        from Crypto.Hash import keccak

        k = keccak.new(digest_bits=256)
        k.update(b"finalizeSubmission(uint256,uint256)")
        selector = k.hexdigest()[:8]

        encoded = encode(
            ["uint256", "uint256"],
            [job_id, submission_id],
        )
        return "0x" + selector + encoded.hex()

    def _encode_timeout(self, job_id: int, submission_id: int) -> str:
        """Calldata encoding for failTimedOutSubmission."""
        from eth_abi import encode
        from Crypto.Hash import keccak

        k = keccak.new(digest_bits=256)
        k.update(b"failTimedOutSubmission(uint256,uint256)")
        selector = k.hexdigest()[:8]

        encoded = encode(
            ["uint256", "uint256"],
            [job_id, submission_id],
        )
        return "0x" + selector + encoded.hex()

    def cache_step3_calldata(
        self, job_id: int, submission_id: int, calldata: str
    ) -> None:
        """Cache step 3 calldata from bundle/complete response.

        Call this after bundle_complete returns step 3 calldata.
        """
        self._step3_calldata_cache[(job_id, submission_id)] = calldata

    # ── Polling ───────────────────────────────────────────────────────

    def poll_until_evaluated(
        self,
        api_client,
        job_id: int,
        submission_id: int,
        timeout_minutes: int = 30,
        poll_interval_seconds: int = 30,
    ) -> dict:
        """Poll submission status until evaluated or timed out.

        Args:
            api_client: VerdiktaClient instance.
            job_id: Bounty ID.
            submission_id: Submission ID.
            timeout_minutes: Max wait time.
            poll_interval_seconds: Poll interval.

        Returns:
            Final submission status dict.
        """
        deadline = time.time() + (timeout_minutes * 60)
        terminal_statuses = {
            "EVALUATED_PASSED",
            "EVALUATED_FAILED",
            "WINNER",
            "ACCEPTED",
            "REJECTED",
        }

        while time.time() < deadline:
            subs = api_client.get_submissions(job_id)
            for s in subs:
                if s.get("submissionId") == submission_id:
                    status = s.get("status", "")
                    if status in terminal_statuses:
                        return s
                    print(f"  Status: {status} — waiting...")
                    break

            time.sleep(poll_interval_seconds)

        return {"status": "TIMEOUT", "error": f"Polling timed out after {timeout_minutes} min"}

    # ── Event Parsing ─────────────────────────────────────────────────

    @staticmethod
    def parse_submission_prepared(receipt: dict) -> Optional[dict]:
        """Parse SubmissionPrepared event from TX receipt.

        Args:
            receipt: Transaction receipt from eth_getTransactionReceipt.

        Returns:
            Parsed event with bountyId, submissionId, evalWallet, ethMaxBudget.
        """
        event_sig = "0xdf7bc54a"  # SubmissionPrepared event signature

        for log in receipt.get("logs", []):
            topics = log.get("topics", [])
            if not topics:
                continue

            # Handle both hex string and bytes
            topic0 = topics[0]
            topic0_hex = (
                topic0.hex() if isinstance(topic0, bytes) else topic0.replace("0x", "")
            )

            if topic0_hex.startswith(event_sig[:8]):
                # topics[1] = bountyId, topics[2] = submissionId
                raw_bid = topics[1]
                raw_sid = topics[2]

                bounty_id = int(
                    raw_bid if isinstance(raw_bid, str) else raw_bid.hex(), 16
                )
                submission_id = int(
                    raw_sid if isinstance(raw_sid, str) else raw_sid.hex(), 16
                )

                # Parse data field for evalWallet and ethMaxBudget
                data = log.get("data", "0x")
                if isinstance(data, bytes):
                    data = data.hex()
                data = data.replace("0x", "")

                # data[0:64] = evalWallet (padded address)
                # data[64:128] = offset to string (usually 0x60)
                # data[128:192] = ethMaxBudget (uint256 wei)
                eval_wallet = "0x" + data[24:64]  # Last 40 chars of first word
                eth_max_budget = int(data[128:192], 16) if len(data) >= 192 else 0

                return {
                    "bounty_id": bounty_id,
                    "submission_id": submission_id,
                    "eval_wallet": eval_wallet,
                    "eth_max_budget_wei": eth_max_budget,
                    "eth_max_budget_eth": float(Web3.from_wei(eth_max_budget, "ether")),
                }

        return None
