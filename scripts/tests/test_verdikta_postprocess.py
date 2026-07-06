#!/usr/bin/env python3
"""Unit tests for the fund-safety envelope in scripts/postprocess-verdikta.sh.

Run: python3 scripts/tests/test_verdikta_postprocess.py

The embedded Python helper is extracted from the shell script and exercised
against a scripted fake bounty API + fake Base RPC. `eth_account` and
`requests` are stubbed (stdlib-only — CI installs neither), signing returns
inspectable fake bytes, and nothing touches the network. These tests pin the
guarantees the skill's review hinged on:

  - transactions are refused unless `to` == the pinned BountyEscrow contract
    and chainId == 8453, and value <= VERDIKTA_MAX_SPEND_ETH
  - the start value must equal the API's parsed.ethMaxBudget
  - a cap refusal after the prepare tx leaves a PREPARED_INCOMPLETE state
    entry so the next run cannot double-submit
  - dry-run hits only /submit/dry-run: no RPC calls, no signing, no state
  - the happy path calls bundle -> complete -> confirm in order, broadcasts
    exactly two txs, and records state + daily spend count
"""
import json
import os
import re
import sys
import tempfile
import types
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SCRIPT = ROOT / "scripts" / "postprocess-verdikta.sh"

ESCROW = "0x2Ae271f5E86bee449a36B943414b7C1a7b39772D"
PREPAY_OK = 240_000_000_000_000    # 0.00024 ETH — realistic worst-case prepay
PREPAY_OVER = 600_000_000_000_000  # 0.0006 ETH — over the 0.0005 default cap


# ── stub third-party deps before the helper loads ─────────────────────
def _no_net(*a, **k):
    raise AssertionError("network reached without a stub")


fake_requests = types.ModuleType("requests")
fake_requests.request = _no_net
fake_requests.post = _no_net
sys.modules["requests"] = fake_requests


class _FakeSigned:
    def __init__(self, payload):
        self.raw_transaction = b"\x02" + payload


class _FakeAccount:
    address = "0x00000000000000000000000000000000DeaDBeef"
    key = b"\x01" * 32

    @staticmethod
    def sign_transaction(tx, key):
        # encode the tx dict so tests can decode exactly what was signed
        return _FakeSigned(json.dumps({k: str(v) for k, v in tx.items()}).encode())

    @staticmethod
    def from_key(_):
        return _FakeAccount()


fake_eth = types.ModuleType("eth_account")
fake_eth.Account = _FakeAccount
sys.modules["eth_account"] = fake_eth

os.environ.update({
    "VERDIKTA_API_KEY": "test-key-not-real",
    "VERDIKTA_RPC_URL": "http://fake-rpc.invalid",
    "VERDIKTA_MAX_SPEND_ETH": "0.0005",
    "VERDIKTA_MAX_GAS_GWEI": "3",
})

_match = re.search(r"<<'PYEOF'\n(.*?)\nPYEOF", SCRIPT.read_text(), re.S)
helper = types.ModuleType("vk_helper")
exec(compile(_match.group(1), str(SCRIPT) + " <embedded helper>", "exec"), helper.__dict__)


class FakeBackend:
    """Scripted bounty API + Base JSON-RPC."""

    def __init__(self, prepay=PREPAY_OK, escrow=ESCROW, chain_id=8453, start_value=None):
        self.prepay, self.escrow, self.chain_id = prepay, escrow, chain_id
        self.start_value = prepay if start_value is None else start_value
        self.api_calls, self.rpc_calls, self.sent_raw = [], [], []

    def api(self, method, path, **kw):
        self.api_calls.append(path)
        self.api_kwargs = kw
        if path.endswith("/submit/dry-run"):
            return {"success": True, "valid": True, "errors": []}
        if path.endswith("/submit/bundle"):
            return {"hunterCid": "QmTest", "transactions": [
                {"to": self.escrow, "data": "0xab", "value": "0",
                 "chainId": self.chain_id, "gasLimit": 1000000}]}
        if path.endswith("/submit/bundle/complete"):
            return {"parsed": {"submissionId": 7, "evalWallet": "0x" + "11" * 20,
                               "ethMaxBudget": str(self.prepay)},
                    "transactions": [
                        {"to": self.escrow, "data": "0xcd", "value": str(self.start_value),
                         "chainId": self.chain_id, "gasLimit": 4000000}]}
        if path.endswith("/submissions/confirm"):
            return {"success": True}
        if path.endswith("/finalize"):
            return {"transaction": {"to": self.escrow, "data": "0xef", "value": "0",
                                    "chainId": self.chain_id, "gasLimit": 300000}}
        raise AssertionError(f"unexpected API call {method} {path}")

    def rpc(self, method, params):
        self.rpc_calls.append(method)
        return {
            "eth_gasPrice": hex(10_000_000),
            "eth_getBalance": hex(5_000_000_000_000_000),
            "eth_getTransactionCount": hex(len(self.sent_raw)),
            "eth_getTransactionReceipt": {"status": "0x1"},
        }.get(method) or self._send(params)

    def _send(self, params):
        self.sent_raw.append(params[0])
        return "0x" + f"{len(self.sent_raw):064x}"

    def signed_tx(self, i):
        """Decode what sign_transaction actually received for broadcast i."""
        return json.loads(bytes.fromhex(self.sent_raw[i][2:])[1:].decode())


def make_request(dry_run=False):
    files_dir = Path(".pending-verdikta/files/97")
    files_dir.mkdir(parents=True, exist_ok=True)
    (files_dir / "report.md").write_text("# test\n")
    return {"action": "submit", "jobId": 97, "files": ["report.md"], "dryRun": dry_run}


class VerdiktaGuardTests(unittest.TestCase):

    # ── balance & gas cap tests ────────────────────────────────────────

    def test_insufficient_balance_refused(self):
        """sign_and_send must refuse when balance < value + gas."""
        be = self._install(FakeBackend())
        _orig_rpc = be.rpc
        def _low_balance_rpc(method, params):
            if method == "eth_getBalance":
                return hex(10_000_000_000_000)  # 0.00001 ETH
            return _orig_rpc(method, params)
        helper.api, helper.rpc = be.api, _low_balance_rpc
        with self.assertRaises(RuntimeError) as cm:
            helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertIn("insufficient balance", str(cm.exception))
        self.assertEqual(len(be.sent_raw), 0)

    def test_gas_price_capped_at_max_gas_gwei(self):
        """Gas price must not exceed VERDIKTA_MAX_GAS_GWEI even when chain is higher."""
        be = self._install(FakeBackend())
        _orig_rpc = be.rpc
        def _high_gas_rpc(method, params):
            if method == "eth_gasPrice":
                return hex(50_000_000_000)
            if method == "eth_getBalance":
                return hex(50_000_000_000_000_000)  # 0.05 ETH
            return _orig_rpc(method, params)
        helper.api, helper.rpc = be.api, _high_gas_rpc
        helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        start = be.signed_tx(1)
        gas_price = int(start["maxFeePerGas"])
        self.assertLessEqual(gas_price, 3_000_000_000)

    def test_tx_revert_detected(self):
        """A reverted TX must raise RuntimeError, not silently succeed."""
        be = self._install(FakeBackend())
        _orig_rpc = be.rpc
        def _revert_rpc(method, params):
            if method == "eth_getTransactionReceipt":
                return {"status": "0x0"}
            return _orig_rpc(method, params)
        helper.api, helper.rpc = be.api, _revert_rpc
        with self.assertRaises(RuntimeError) as cm:
            helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertIn("REVERTED", str(cm.exception))

    def test_api_error_response_raises(self):
        """Non-200 API responses must raise RuntimeError."""
        be = self._install(FakeBackend())
        _orig_api = be.api
        def _bad_api(method, path, **kw):
            if path.endswith("/submit/bundle"):
                raise RuntimeError(f"POST {path} -> HTTP 500: Internal Server Error")
            return _orig_api(method, path, **kw)
        helper.api, helper.rpc = _bad_api, be.rpc
        with self.assertRaises(RuntimeError) as cm:
            helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertIn("HTTP 500", str(cm.exception))

    def test_daily_cap_enforced_by_shell(self):
        """do_submit increments daily count for shell cap enforcement."""
        be = self._install(FakeBackend())
        helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        state = self._state()
        today = __import__("datetime").datetime.now(
            __import__("datetime").timezone.utc
        ).strftime("%Y-%m-%d")
        self.assertEqual(state["daily"].get(today, 0), 1)

    def test_missing_state_file_handled(self):
        """load_state must bootstrap cleanly when no state file exists."""
        state = helper.load_state()
        self.assertEqual(state, {"submissions": {}, "daily": {}})

    def test_corrupt_state_file_raises(self):
        """Corrupt JSON in state file must raise, not silently overwrite."""
        Path("memory/state").mkdir(parents=True, exist_ok=True)
        Path("memory/state/verdikta-hunter.json").write_text("{invalid json")
        with self.assertRaises(json.JSONDecodeError):
            helper.load_state()

    def test_missing_file_raises(self):
        """do_submit must raise when listed file doesn't exist."""
        be = self._install(FakeBackend())
        req = make_request()
        req["files"] = ["nonexistent.md"]
        with self.assertRaises(FileNotFoundError):
            helper.do_submit(req, self.acct, Path(".pending-verdikta"))

    def test_finalize_updates_state_to_finalized(self):
        """Finalize must update state entry to FINALIZED with tx hash."""
        be = self._install(FakeBackend())
        helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        state = self._state()
        sub_key = [k for k in state["submissions"] if k.startswith("97:")][0]
        sub_id = int(sub_key.split(":")[1])
        helper.do_finalize(
            {"action": "finalize", "jobId": 97, "submissionId": sub_id},
            self.acct,
        )
        state = self._state()
        self.assertEqual(state["submissions"][f"97:{sub_id}"]["status"], "FINALIZED")
        self.assertIsNotNone(state["submissions"][f"97:{sub_id}"]["finalizeTx"])
    def setUp(self):
        self._old_cwd = os.getcwd()
        self._tmp = tempfile.TemporaryDirectory()
        os.chdir(self._tmp.name)
        self.acct = _FakeAccount()

    def tearDown(self):
        os.chdir(self._old_cwd)
        self._tmp.cleanup()

    def _install(self, backend):
        helper.api, helper.rpc = backend.api, backend.rpc
        return backend

    def _state(self):
        return json.loads(Path("memory/state/verdikta-hunter.json").read_text())

    def test_happy_path(self):
        be = self._install(FakeBackend())
        helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertEqual(be.api_calls, ["/jobs/97/submit/bundle",
                                        "/jobs/97/submit/bundle/complete",
                                        "/jobs/97/submissions/confirm"])
        self.assertEqual(len(be.sent_raw), 2)
        start = be.signed_tx(1)
        self.assertEqual(start["to"].lower(), ESCROW.lower())
        self.assertEqual(int(start["value"]), PREPAY_OK)
        self.assertEqual(int(start["chainId"]), 8453)
        state = self._state()
        self.assertEqual(state["submissions"]["97:7"]["status"], "PENDING_EVALUATION")
        self.assertNotIn("97:?", state["submissions"])
        self.assertEqual(sum(state["daily"].values()), 1)

    def test_overcap_prepay_refused_after_prepare(self):
        be = self._install(FakeBackend(prepay=PREPAY_OVER))
        with self.assertRaises(helper.CapRefused):
            helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertEqual(len(be.sent_raw), 1)  # prepare only — start never signed
        self.assertNotIn("/jobs/97/submissions/confirm", be.api_calls)
        # provisional entry must survive so the next run can't double-submit
        self.assertEqual(self._state()["submissions"]["97:?"]["status"],
                         "PREPARED_INCOMPLETE")

    def test_wrong_destination_refused_before_any_tx(self):
        be = self._install(FakeBackend(escrow="0x" + "99" * 20))
        with self.assertRaises(helper.CapRefused):
            helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertEqual(be.sent_raw, [])

    def test_wrong_chain_refused_before_any_tx(self):
        be = self._install(FakeBackend(chain_id=1))
        with self.assertRaises(helper.CapRefused):
            helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertEqual(be.sent_raw, [])

    def test_start_value_must_match_parsed_budget(self):
        be = self._install(FakeBackend(start_value=PREPAY_OK + 1))
        with self.assertRaises(helper.CapRefused):
            helper.do_submit(make_request(), self.acct, Path(".pending-verdikta"))
        self.assertEqual(len(be.sent_raw), 1)  # prepare only

    def test_dry_run_touches_nothing(self):
        be = self._install(FakeBackend())
        helper.do_submit(make_request(dry_run=True), None, Path(".pending-verdikta"))
        self.assertEqual(be.api_calls, ["/jobs/97/submit/dry-run"])
        self.assertEqual(be.rpc_calls, [])
        self.assertFalse(Path("memory/state/verdikta-hunter.json").exists())
        # keyless dry-run still sends a valid-format hunter so the API's
        # address check yields signal instead of a guaranteed error
        hunter = be.api_kwargs.get("data", {}).get("hunter", "")
        self.assertRegex(hunter, r"^0x[a-fA-F0-9]{40}$")

    def test_dry_run_uses_wallet_address_when_available(self):
        be = self._install(FakeBackend())
        helper.do_submit(make_request(dry_run=True), self.acct, Path(".pending-verdikta"))
        self.assertEqual(be.api_kwargs.get("data", {}).get("hunter"), self.acct.address)

    def test_finalize(self):
        be = self._install(FakeBackend())
        helper.do_finalize({"action": "finalize", "jobId": 97, "submissionId": 7},
                           self.acct)
        self.assertEqual(be.api_calls, ["/jobs/97/submissions/7/finalize"])
        self.assertEqual(len(be.sent_raw), 1)
        self.assertEqual(int(be.signed_tx(0)["value"]), 0)
        self.assertEqual(self._state()["submissions"]["97:7"]["status"], "FINALIZED")


if __name__ == "__main__":
    unittest.main(verbosity=2)
