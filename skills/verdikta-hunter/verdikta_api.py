"""
Verdikta API helper — query bounties, rubrics, and submission status.

Usage:
    from verdikta_api import VerdiktaClient
    client = VerdiktaClient(api_key="bot-xxxx")
    bounties = client.list_open_bounties()
"""

import requests
from datetime import datetime, timezone
from typing import Optional

BASE_URL = "https://bounties.verdikta.org/api"


class VerdiktaClient:
    """Client for the Verdikta Bounty API."""

    def __init__(self, api_key: str):
        self.api_key = api_key
        self.headers = {"X-Bot-API-Key": api_key}

    def _get(self, path: str, params: dict = None) -> dict:
        """Make authenticated GET request."""
        resp = requests.get(
            f"{BASE_URL}{path}",
            headers=self.headers,
            params=params,
            timeout=30,
        )
        resp.raise_for_status()
        return resp.json()

    def _post(self, path: str, data: dict = None, files: dict = None) -> dict:
        """Make authenticated POST request."""
        resp = requests.post(
            f"{BASE_URL}{path}",
            headers=self.headers,
            json=data,
            files=files,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    # ── Bounty Discovery ──────────────────────────────────────────────

    def list_open_bounties(self, limit: int = 30) -> list[dict]:
        """List all open bounties available for submission."""
        data = self._get("/jobs", {"status": "OPEN", "limit": limit})
        return data.get("jobs", [])

    def get_bounty(self, bounty_id: int) -> dict:
        """Get full bounty detail including submissions and metadata."""
        data = self._get(f"/jobs/{bounty_id}")
        return data.get("job", data)

    def get_rubric(self, bounty_id: int) -> dict:
        """Get evaluation rubric for a bounty."""
        data = self._get(f"/jobs/{bounty_id}/rubric")
        return data.get("rubric", data)

    def filter_bounties(
        self,
        min_bounty_eth: float = 0,
        max_threshold: int = 100,
        max_submissions: int = 999,
        keywords: list[str] = None,
        min_deadline_hours: float = 0,
        bounty_type: str = None,
    ) -> list[dict]:
        """Filter open bounties by criteria.

        Args:
            min_bounty_eth: Minimum bounty amount in ETH
            max_threshold: Maximum score threshold (easier to pass)
            max_submissions: Maximum existing submissions (less competition)
            keywords: Keywords to match in title/description
            min_deadline_hours: Minimum hours until deadline (filters out
                bounties closing soon). 0 = no deadline filter.
            bounty_type: Filter by evaluation type:
                None = all types, "windowed" = creator-approval only,
                "oracle" = oracle-evaluated only

        Returns:
            Filtered list of bounties with rubric summary appended.
        """
        bounties = self.list_open_bounties()
        results = []
        now = datetime.now(timezone.utc)

        for b in bounties:
            bounty_eth = float(b.get("bountyAmount", 0))
            threshold = b.get("threshold", 100)
            sub_count = b.get("submissionCount", 0)

            if bounty_eth < min_bounty_eth:
                continue
            if threshold > max_threshold:
                continue
            if sub_count > max_submissions:
                continue

            # Deadline filtering
            if min_deadline_hours > 0:
                deadline_str = b.get("deadline") or b.get("expiresAt")
                if deadline_str:
                    try:
                        deadline = datetime.fromisoformat(deadline_str.replace("Z", "+00:00"))
                        hours_left = (deadline - now).total_seconds() / 3600
                        if hours_left < min_deadline_hours:
                            continue
                        b["_hours_until_deadline"] = round(hours_left, 1)
                    except (ValueError, TypeError):
                        pass  # Skip deadline filter if unparseable

            # Bounty type filtering (windowed vs oracle-evaluated)
            if bounty_type:
                is_windowed = b.get("creatorApproval", False)
                if bounty_type == "windowed" and not is_windowed:
                    continue
                if bounty_type == "oracle" and is_windowed:
                    continue

            # Keywords
            if keywords:
                text = (b.get("title", "") + " " + b.get("description", "")).lower()
                if not any(kw.lower() in text for kw in keywords):
                    continue

            # Fetch rubric summary
            try:
                rubric = self.get_rubric(b["jobId"])
                criteria = rubric.get("criteria", [])
                must_pass = [c for c in criteria if c.get("must")]
                weighted = [c for c in criteria if not c.get("must")]
                b["_rubric"] = {
                    "must_pass": len(must_pass),
                    "weighted": len(weighted),
                    "criteria": criteria,
                }
            except Exception:
                b["_rubric"] = {"must_pass": 0, "weighted": 0, "criteria": []}

            # Tag bounty type for downstream use
            b["_is_windowed"] = b.get("creatorApproval", False)

            results.append(b)

        # Sort by value (bounty / competition)
        results.sort(
            key=lambda x: float(x.get("bountyAmount", 0))
            / max(x.get("submissionCount", 1), 1),
            reverse=True,
        )
        return results

    # ── Submission Management ─────────────────────────────────────────

    def get_submissions(self, bounty_id: int) -> list[dict]:
        """Get all submissions for a bounty."""
        data = self._get(f"/jobs/{bounty_id}/submissions")
        return data.get("submissions", data) if isinstance(data, dict) else data

    def get_evaluation(self, bounty_id: int, submission_id: int) -> dict:
        """Get detailed evaluation report for a submission."""
        return self._get(f"/jobs/{bounty_id}/submissions/{submission_id}/evaluation")

    def get_my_submissions(self, bounty_id: int, hunter_address: str) -> list[dict]:
        """Get submissions for a specific hunter on a bounty."""
        subs = self.get_submissions(bounty_id)
        return [s for s in subs if s.get("hunter", "").lower() == hunter_address.lower()]

    # ── Bundle Submission Flow ────────────────────────────────────────

    def bundle_upload(
        self,
        bounty_id: int,
        files: list[tuple[str, str]],
        hunter_address: str,
        addendum: str = "",
        alpha: int = 200,
        max_oracle_fee: int = 300000000000000,
        estimated_base_cost: int = 100000000000000,
        max_fee_scaling: int = 5,
    ) -> dict:
        """Upload report and prepare submission (bundle method).

        Args:
            bounty_id: On-chain bounty ID
            files: List of (filename, content) tuples
            hunter_address: Hunter's Base wallet address
            addendum: Optional addendum text
            alpha: Quality vs timeliness (lower = quality focus)
            max_oracle_fee: Max oracle fee in wei
            estimated_base_cost: Estimated base cost in wei
            max_fee_scaling: Max fee scaling multiplier

        Returns:
            API response with step 1 calldata in transactions[0].data
        """
        multipart = []
        for fname, content in files:
            multipart.append(("files", (fname, content, "text/markdown")))

        data = {
            "hunterAddress": hunter_address,
            "addendum": addendum,
            "alpha": str(alpha),
            "maxOracleFee": str(max_oracle_fee),
            "estimatedBaseCost": str(estimated_base_cost),
            "maxFeeBasedScaling": str(max_fee_scaling),
        }

        resp = requests.post(
            f"{BASE_URL}/jobs/{bounty_id}/submit/bundle",
            headers=self.headers,
            files=multipart,
            data=data,
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def bundle_complete(self, bounty_id: int, step1_tx_hash: str) -> dict:
        """Complete bundle submission with step 1 TX hash.

        Returns step 2 calldata + ethMaxBudget + step 3 calldata.
        """
        return self._post(
            f"/jobs/{bounty_id}/submit/bundle/complete",
            {"step1TxHash": step1_tx_hash},
        )

    def confirm_submission(
        self,
        bounty_id: int,
        submission_id: int,
        hunter: str,
        hunter_cid: str,
        eval_wallet: str,
    ) -> dict:
        """Confirm submission (REQUIRED between prepare and start).

        This step is MANDATORY. Without it, the oracle never picks up
        the submission and it stays PENDING_EVALUATION forever.
        """
        return self._post(
            f"/jobs/{bounty_id}/submissions/confirm",
            {
                "submissionId": submission_id,
                "hunter": hunter,
                "hunterCid": hunter_cid,
                "evalWallet": eval_wallet,
            },
        )


# ── Convenience Functions ─────────────────────────────────────────────

def list_open_bounties(api_key: str) -> list[dict]:
    """Quick function to list open bounties."""
    return VerdiktaClient(api_key).list_open_bounties()


def get_rubric(api_key: str, bounty_id: int) -> dict:
    """Quick function to get a bounty's rubric."""
    return VerdiktaClient(api_key).get_rubric(bounty_id)
