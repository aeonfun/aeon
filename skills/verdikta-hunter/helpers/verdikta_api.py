"""Verdikta API client for bounty discovery, filtering, and submission flow.

Wraps the bounties.verdikta.org REST API with proper auth, error handling,
and structured responses. Designed to complement the SKILL.md workflow.

Usage:
    from helpers.verdikta_api import VerdiktaClient

    client = VerdiktaClient(api_key="your-key")
    bounties = client.list_open_bounties()
    filtered = client.filter_bounties(bounties, min_threshold=75, min_deadline_hours=48)
"""

import os
import json
import time
from datetime import datetime, timezone
from typing import Optional

import requests

BASE_URL = "https://bounties.verdikta.org/api"


class VerdiktaClient:
    """API client for Verdikta bounty platform."""

    def __init__(self, api_key: Optional[str] = None, base_url: str = BASE_URL):
        self.api_key = api_key or os.environ.get("VERDIKTA_API_KEY", "")
        self.base_url = base_url.rstrip("/")
        self.session = requests.Session()
        if self.api_key:
            self.session.headers["X-Bot-API-Key"] = self.api_key

    def _get(self, path: str, params: Optional[dict] = None) -> dict:
        """GET request with error handling."""
        url = f"{self.base_url}{path}"
        resp = self.session.get(url, params=params, timeout=30)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("success", True):
            raise VerdiktaAPIError(data.get("error", "Unknown error"), data)
        return data

    def _post(self, path: str, json_data: Optional[dict] = None) -> dict:
        """POST request with error handling."""
        url = f"{self.base_url}{path}"
        resp = self.session.post(url, json=json_data, timeout=60)
        resp.raise_for_status()
        data = resp.json()
        if not data.get("success", True):
            raise VerdiktaAPIError(data.get("error", "Unknown error"), data)
        return data

    # ── Bounty Discovery ──────────────────────────────────────────────

    def list_bounties(self, status: str = "OPEN", limit: int = 100) -> list[dict]:
        """List bounties filtered by status.

        Args:
            status: OPEN, CLOSED, EVALUATING, etc.
            limit: Max bounties to return (default 100).

        Returns:
            List of bounty dicts with embedded submissions.
        """
        data = self._get("/jobs", {"status": status, "limit": limit})
        return data.get("jobs", [])

    def list_open_bounties(self, limit: int = 100) -> list[dict]:
        """Shortcut for OPEN bounties."""
        return self.list_bounties(status="OPEN", limit=limit)

    def get_bounty(self, job_id: int) -> dict:
        """Get full bounty details including submissions.

        Args:
            job_id: The bounty ID.

        Returns:
            Bounty dict with submissions[], rubricContent, etc.
        """
        data = self._get(f"/jobs/{job_id}")
        return data.get("job", {})

    def get_rubric(self, job_id: int) -> dict:
        """Fetch the evaluation rubric for a bounty.

        Args:
            job_id: The bounty ID.

        Returns:
            Rubric dict with criteria[], weights, and must-pass flags.
        """
        data = self._get(f"/jobs/{job_id}/rubric")
        return data.get("rubric", {})

    def get_submissions(self, job_id: int) -> list[dict]:
        """Get all submissions for a bounty.

        Args:
            job_id: The bounty ID.

        Returns:
            List of submission dicts with status, score, etc.
        """
        data = self._get(f"/jobs/{job_id}/submissions")
        return data.get("submissions", [])

    def get_evaluation(self, job_id: int, submission_id: int) -> dict:
        """Fetch the evaluation report for a specific submission.

        Args:
            job_id: The bounty ID.
            submission_id: The submission ID.

        Returns:
            Evaluation dict with scores, justifications per model.
        """
        return self._get(f"/jobs/{job_id}/submissions/{submission_id}/evaluation")

    def get_onchain_status(self, job_id: int) -> dict:
        """Get on-chain status (ground truth when API lags).

        Args:
            job_id: The bounty ID.

        Returns:
            On-chain status dict with payoutWei, finalized, etc.
        """
        return self._get(f"/jobs/{job_id}/onchain-status")

    # ── Filtering ─────────────────────────────────────────────────────

    def filter_bounties(
        self,
        bounties: list[dict],
        hunter_address: Optional[str] = None,
        min_bounty_eth: float = 0,
        max_threshold: int = 100,
        min_threshold: int = 0,
        min_deadline_hours: float = 24,
        keywords: Optional[list[str]] = None,
        exclude_submitted: bool = True,
        exclude_windowed: bool = True,
    ) -> list[dict]:
        """Filter bounties by multiple criteria.

        Args:
            bounties: List of bounty dicts from list_bounties().
            hunter_address: Our wallet address (to exclude already-submitted).
            min_bounty_eth: Minimum bounty amount in ETH.
            max_threshold: Maximum evaluation threshold (lower = easier).
            min_threshold: Minimum evaluation threshold.
            min_deadline_hours: Minimum hours until deadline (filters closing-soon).
            keywords: Keywords that must appear in title or description.
            exclude_submitted: Skip bounties we already submitted to.
            exclude_windowed: Skip creator-approval (windowed) bounties.

        Returns:
            Filtered list with _hours_until_deadline added to each bounty.
        """
        now = time.time()
        results = []

        for b in bounties:
            # Skip targeted bounties not for us
            target = b.get("targetHunter")
            if target and hunter_address and target.lower() != hunter_address.lower():
                continue

            # Skip already submitted
            if exclude_submitted and hunter_address:
                subs = b.get("submissions", [])
                if any(s.get("hunter", "").lower() == hunter_address.lower() for s in subs):
                    continue

            # Skip windowed (creator-approval) bounties
            if exclude_windowed and self._is_windowed_bounty(b):
                continue

            # Bounty amount filter
            bounty_eth = float(b.get("bountyAmount", 0) or 0)
            if bounty_eth < min_bounty_eth:
                continue

            # Threshold filter
            threshold = b.get("threshold", 100) or 100
            if threshold < min_threshold or threshold > max_threshold:
                continue

            # Deadline filter
            close_time = b.get("submissionCloseTime", 0) or 0
            if close_time:
                hours_left = (close_time - now) / 3600
                b["_hours_until_deadline"] = round(hours_left, 1)
                if hours_left < min_deadline_hours:
                    continue
            else:
                b["_hours_until_deadline"] = None

            # Keyword filter
            if keywords:
                text = f"{b.get('title', '')} {b.get('description', '')}".lower()
                if not any(kw.lower() in text for kw in keywords):
                    continue

            results.append(b)

        # Sort by reward descending
        results.sort(key=lambda x: float(x.get("bountyAmount", 0) or 0), reverse=True)
        return results

    @staticmethod
    def _is_windowed_bounty(bounty: dict) -> bool:
        """Check if a bounty uses creator-approval (windowed) flow.

        Windowed bounties have creatorAssessmentWindowSize > 0,
        meaning the creator reviews submissions directly instead of
        the oracle evaluating them.
        """
        window = bounty.get("creatorAssessmentWindowSize", 0) or 0
        return window > 0

    # ── Submission Flow ───────────────────────────────────────────────

    def bundle_upload(
        self,
        job_id: int,
        files: list[str],
        hunter_address: str,
        addendum: str = "",
        alpha: int = 200,
        max_oracle_fee: str = "0.0003",
        estimated_base_cost: str = "0.0001",
        max_fee_scaling: int = 5,
    ) -> dict:
        """Upload files and prepare submission in one call (bundle method).

        Args:
            job_id: Target bounty ID.
            files: List of file paths to upload.
            hunter_address: Hunter's Base wallet address.
            addendum: Optional addendum text.
            alpha: Quality vs timeliness weight (0-1000, lower=quality).
            max_oracle_fee: Max oracle fee in ETH.
            estimated_base_cost: Estimated base cost in ETH.
            max_fee_scaling: Max fee-based scaling factor.

        Returns:
            Bundle response with transactions[0].data (step 1 calldata).
        """
        import multipart

        # Build multipart form
        with open(files[0], "rb") as f:
            file_data = f.read()

        form_data = {
            "hunterAddress": hunter_address,
            "addendum": addendum,
            "alpha": str(alpha),
            "maxOracleFee": max_oracle_fee,
            "estimatedBaseCost": estimated_base_cost,
            "maxFeeBasedScaling": str(max_fee_scaling),
        }

        m = multipart.MultipartEncoder(
            fields={
                **form_data,
                "files": (os.path.basename(files[0]), file_data, "text/markdown"),
            }
        )

        resp = self.session.post(
            f"{self.base_url}/jobs/{job_id}/submit/bundle",
            data=m.to_string(),
            headers={"Content-Type": m.content_type},
            timeout=60,
        )
        resp.raise_for_status()
        return resp.json()

    def bundle_complete(self, job_id: int, step1_tx_hash: str) -> dict:
        """Complete bundle submission with step 1 TX hash.

        Returns step 2 calldata + ethMaxBudget + step 3 calldata.
        """
        return self._post(
            f"/jobs/{job_id}/submit/bundle/complete",
            {"step1TxHash": step1_tx_hash},
        )

    def confirm_submission(
        self,
        job_id: int,
        submission_id: int,
        hunter_address: str,
        hunter_cid: str,
        eval_wallet: str,
    ) -> dict:
        """Confirm submission between prepare and start steps.

        This is REQUIRED — without it, the oracle won't pick up the submission.
        """
        return self._post(
            f"/jobs/{job_id}/submissions/confirm",
            {
                "submissionId": submission_id,
                "hunter": hunter_address,
                "hunterCid": hunter_cid,
                "evalWallet": eval_wallet,
            },
        )

    # ── Utilities ─────────────────────────────────────────────────────

    def rank_bounties(self, bounties: list[dict]) -> list[dict]:
        """Rank bounties by reward-to-difficulty ratio.

        Considers: bounty amount, threshold, competition (submission count),
        and time remaining.
        """
        scored = []
        for b in bounties:
            reward = float(b.get("bountyAmount", 0) or 0)
            threshold = b.get("threshold", 100) or 100
            subs = b.get("submissionCount", 0) or 0
            hours = b.get("_hours_until_deadline", 48) or 48

            # Score: higher = better opportunity
            reward_score = reward * 1000  # Normalize to ~1-10 range
            difficulty_penalty = (100 - threshold) / 100  # Lower threshold = easier
            competition_penalty = max(0, 1 - subs / 5)  # Fewer subs = less competition
            time_bonus = min(1, hours / 72)  # More time = better

            score = reward_score * difficulty_penalty * competition_penalty * time_bonus
            b["_opportunity_score"] = round(score, 3)
            scored.append(b)

        scored.sort(key=lambda x: x["_opportunity_score"], reverse=True)
        return scored


class VerdiktaAPIError(Exception):
    """API error with structured response."""

    def __init__(self, message: str, response: dict = None):
        super().__init__(message)
        self.response = response or {}
