#!/usr/bin/env bash
# Post-process Verdikta bounty requests queued by skills/verdikta-hunter (the
# sandbox blocks authed outbound calls, so the skill only writes request files).
# Reads .pending-verdikta/*.json and executes them against bounties.verdikta.org
# + Base L2. Runs only after a SUCCESSFUL skill run (workflow drops the queue on
# failure).
#
# Fund-safety envelope (enforced HERE, client-side — the API response is treated
# as untrusted):
#   - never signs a tx whose `to` != the pinned BountyEscrow contract, or whose
#     chainId != 8453 (Base)
#   - never signs a tx whose value exceeds VERDIKTA_MAX_SPEND_ETH (default 0.0005)
#   - at most ONE new submission per run; VERDIKTA_MAX_SUBMISSIONS_PER_DAY per
#     UTC day (default 5), tracked in memory/state/verdikta-hunter.json
#   - balance preflight (value + gas) before every tx; receipts checked for revert
set -euo pipefail

PENDING_DIR=".pending-verdikta"
STATE_FILE="memory/state/verdikta-hunter.json"

if [ ! -d "$PENDING_DIR" ] || [ -z "$(ls -A "$PENDING_DIR"/*.json 2>/dev/null)" ]; then
  echo "verdikta-postprocess: no pending requests"
  exit 0
fi

if [ -z "${VERDIKTA_API_KEY:-}" ]; then
  echo "verdikta-postprocess: VERDIKTA_API_KEY not set, skipping"
  exit 0
fi

export VERDIKTA_MAX_SPEND_ETH="${VERDIKTA_MAX_SPEND_ETH:-0.0005}"
export VERDIKTA_MAX_GAS_GWEI="${VERDIKTA_MAX_GAS_GWEI:-3}"
export VERDIKTA_RPC_URL="${VERDIKTA_RPC_URL:-https://mainnet.base.org}"
MAX_PER_DAY="${VERDIKTA_MAX_SUBMISSIONS_PER_DAY:-5}"
TODAY=$(date -u +%Y-%m-%d)

python3 -c "import eth_account, requests" 2>/dev/null || {
  echo "verdikta-postprocess: installing python deps (eth-account, requests)..."
  pip3 install --quiet eth-account requests || { echo "::warning::verdikta-postprocess: dep install failed"; exit 0; }
}

HELPER=$(mktemp /tmp/verdikta-exec-XXXXXX.py)
trap 'rm -f "$HELPER"' EXIT
cat > "$HELPER" <<'PYEOF'
"""Execute one queued Verdikta request (finalize or submit) with hard caps.
Usage: verdikta-exec.py <request.json>
Reads VERDIKTA_API_KEY, VERDIKTA_WALLET_KEY, VERDIKTA_MAX_SPEND_ETH,
VERDIKTA_MAX_GAS_GWEI, VERDIKTA_RPC_URL from env. Exits non-zero on failure;
exits 3 specifically when a safety cap refused a transaction."""
import json, os, sys, time, datetime
from decimal import Decimal
from pathlib import Path

import requests
from eth_account import Account

API = "https://bounties.verdikta.org/api"
ESCROW = "0x2Ae271f5E86bee449a36B943414b7C1a7b39772D"
CHAIN_ID = 8453
STATE_FILE = Path("memory/state/verdikta-hunter.json")
GAS_LIMITS = {"prepare": 1_000_000, "start": 4_000_000, "finalize": 300_000}

KEY = os.environ["VERDIKTA_API_KEY"]
RPC = os.environ["VERDIKTA_RPC_URL"]
CAP_WEI = int(Decimal(os.environ["VERDIKTA_MAX_SPEND_ETH"]) * 10**18)
MAX_GAS_WEI = int(Decimal(os.environ["VERDIKTA_MAX_GAS_GWEI"]) * 10**9)
HEADERS = {"X-Bot-API-Key": KEY}


class CapRefused(Exception):
    pass


def api(method, path, **kw):
    r = requests.request(method, f"{API}{path}", headers=HEADERS, timeout=90, **kw)
    if not r.ok:
        raise RuntimeError(f"{method} {path} -> HTTP {r.status_code}: {r.text[:300]}")
    return r.json()


def rpc(method, params):
    r = requests.post(RPC, json={"jsonrpc": "2.0", "method": method, "params": params, "id": 1}, timeout=30)
    data = r.json()
    if "error" in data:
        raise RuntimeError(f"RPC {method}: {data['error']}")
    return data["result"]


def guard_tx(tx, kind):
    """Refuse anything outside the safety envelope. tx is API-returned (untrusted)."""
    if str(tx.get("to", "")).lower() != ESCROW.lower():
        raise CapRefused(f"{kind}: tx.to {tx.get('to')} != pinned escrow {ESCROW}")
    if int(tx.get("chainId", CHAIN_ID)) != CHAIN_ID:
        raise CapRefused(f"{kind}: chainId {tx.get('chainId')} != {CHAIN_ID}")
    value = int(tx.get("value") or 0)
    if value > CAP_WEI:
        raise CapRefused(
            f"{kind}: tx value {value} wei ({value/1e18:.6f} ETH) exceeds "
            f"VERDIKTA_MAX_SPEND_ETH cap {CAP_WEI} wei ({CAP_WEI/1e18:.6f} ETH)")
    return value


def sign_and_send(acct, tx, kind):
    value = guard_tx(tx, kind)
    gas_price = min(int(rpc("eth_gasPrice", []), 16) * 2, MAX_GAS_WEI)
    gas_limit = int(tx.get("gasLimit") or GAS_LIMITS[kind])
    balance = int(rpc("eth_getBalance", [acct.address, "latest"]), 16)
    needed = value + gas_limit * gas_price
    if balance < needed:
        raise RuntimeError(
            f"{kind}: insufficient balance — have {balance/1e18:.6f} ETH, "
            f"need {needed/1e18:.6f} ETH (value + gas)")
    nonce = int(rpc("eth_getTransactionCount", [acct.address, "pending"]), 16)
    signed = Account.sign_transaction({
        "to": tx["to"], "value": value, "data": tx["data"], "chainId": CHAIN_ID,
        "nonce": nonce, "gas": gas_limit, "maxFeePerGas": gas_price,
        "maxPriorityFeePerGas": min(gas_price, 10**8), "type": 2,
    }, acct.key)
    raw = getattr(signed, "raw_transaction", None) or signed.rawTransaction
    tx_hash = rpc("eth_sendRawTransaction", ["0x" + raw.hex().removeprefix("0x")])
    print(f"  {kind} tx sent: {tx_hash}")
    deadline = time.time() + 180
    while time.time() < deadline:
        receipt = rpc("eth_getTransactionReceipt", [tx_hash])
        if receipt:
            if receipt.get("status") != "0x1":
                raise RuntimeError(f"{kind} tx {tx_hash} REVERTED")
            return tx_hash
        time.sleep(3)
    raise RuntimeError(f"{kind} tx {tx_hash} not confirmed within 180s")


def load_state():
    if STATE_FILE.exists():
        return json.loads(STATE_FILE.read_text())
    return {"submissions": {}, "daily": {}}


def save_state(state):
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    tmp = STATE_FILE.with_suffix(".tmp")
    tmp.write_text(json.dumps(state, indent=2) + "\n")
    tmp.replace(STATE_FILE)


def log_line(msg):
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    path = Path(f"memory/logs/{today}.md")
    path.parent.mkdir(parents=True, exist_ok=True)
    header = "### verdikta-hunter (postprocess)"
    text = path.read_text() if path.exists() else ""
    if header not in text:
        text += f"\n{header}\n"
    text += f"- {msg}\n"
    path.write_text(text)


def do_finalize(req, acct):
    job_id, sub_id = req["jobId"], req["submissionId"]
    print(f"verdikta-postprocess: finalize #{job_id}/{sub_id}")
    resp = api("POST", f"/jobs/{job_id}/submissions/{sub_id}/finalize", json={"hunter": acct.address})
    tx_hash = sign_and_send(acct, resp["transaction"], "finalize")
    state = load_state()
    entry = state["submissions"].setdefault(f"{job_id}:{sub_id}", {"jobId": job_id, "submissionId": sub_id})
    entry.update({"finalizeTx": tx_hash, "status": "FINALIZED"})
    save_state(state)
    log_line(f"Finalized #{job_id}/{sub_id}: {tx_hash}")


def do_submit(req, acct, pending_dir):
    job_id = req["jobId"]
    files_dir = pending_dir / "files" / str(job_id)
    file_list = [(name, (files_dir / name).read_text()) for name in req["files"]]

    if req.get("dryRun"):
        print(f"verdikta-postprocess: DRY-RUN validate #{job_id}")
        multipart = [("files", (n, c, "text/markdown")) for n, c in file_list]
        # valid-format placeholder keeps the hunter check meaningful on keyless dry-runs
        hunter = acct.address if acct else "0x0000000000000000000000000000000000000001"
        resp = api("POST", f"/jobs/{job_id}/submit/dry-run", files=multipart, data={"hunter": hunter})
        print(f"  dry-run result: {json.dumps(resp)[:500]}")
        verdict = "VALID" if resp.get("valid") else "INVALID"
        issues = "; ".join(e.get("code", "?") for e in resp.get("errors") or [])
        log_line(f"Dry-run #{job_id}: {verdict}{' (' + issues + ')' if issues else ''} — no transactions sent")
        return

    print(f"verdikta-postprocess: submit #{job_id} as {acct.address}")
    multipart = [("files", (n, c, "text/markdown")) for n, c in file_list]
    data = {
        "hunterAddress": acct.address,
        "addendum": req.get("addendum", ""),
        "alpha": str(req.get("alpha", 200)),
        "maxOracleFee": str(req.get("maxOracleFee", "0.00002")),
        "estimatedBaseCost": str(req.get("estimatedBaseCost", "0.00001")),
        "maxFeeBasedScaling": str(req.get("maxFeeBasedScaling", 3)),
    }
    bundle = api("POST", f"/jobs/{job_id}/submit/bundle", files=multipart, data=data)
    hunter_cid = bundle["hunterCid"]
    prepare_tx = bundle["transactions"][0]

    step1_hash = sign_and_send(acct, prepare_tx, "prepare")

    # From here the submission exists on-chain — record it even if a later stage
    # fails, so the next run sees it and never double-submits to this bounty.
    state = load_state()
    state["submissions"][f"{job_id}:?"] = {
        "jobId": job_id, "submissionId": None, "prepareTx": step1_hash,
        "startTx": None, "status": "PREPARED_INCOMPLETE",
        "submittedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "finalizeTx": None,
    }
    save_state(state)

    complete = api("POST", f"/jobs/{job_id}/submit/bundle/complete", json={"txHash": step1_hash})
    parsed = complete["parsed"]
    sub_id = parsed["submissionId"]
    eth_max_budget = int(parsed["ethMaxBudget"])
    start_tx = complete["transactions"][0]
    if int(start_tx.get("value") or 0) != eth_max_budget:
        raise CapRefused(f"start: tx value {start_tx.get('value')} != parsed.ethMaxBudget {eth_max_budget}")
    guard_tx(start_tx, "start")  # cap-check BEFORE confirm so a refusal spends nothing more

    api("POST", f"/jobs/{job_id}/submissions/confirm", json={
        "submissionId": sub_id, "hunter": acct.address,
        "hunterCid": hunter_cid, "evalWallet": parsed["evalWallet"],
    })

    step2_hash = sign_and_send(acct, start_tx, "start")

    state = load_state()
    state["submissions"].pop(f"{job_id}:?", None)  # replace the provisional entry
    today = datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%d")
    state["submissions"][f"{job_id}:{sub_id}"] = {
        "jobId": job_id, "submissionId": sub_id,
        "prepareTx": step1_hash, "startTx": step2_hash,
        "ethMaxBudgetWei": str(eth_max_budget),
        "submittedAt": datetime.datetime.now(datetime.timezone.utc).isoformat(),
        "status": "PENDING_EVALUATION", "finalizeTx": None,
    }
    state["daily"][today] = state["daily"].get(today, 0) + 1
    save_state(state)
    log_line(f"Submitted #{job_id}/{sub_id}: prepare {step1_hash}, start {step2_hash} "
             f"(prepay {eth_max_budget/1e18:.6f} ETH, refundable at finalize)")


def main():
    req_path = Path(sys.argv[1])
    req = json.loads(req_path.read_text())
    action = req.get("action")
    needs_key = not (action == "submit" and req.get("dryRun"))
    if needs_key and not os.environ.get("VERDIKTA_WALLET_KEY"):
        print(f"::warning::verdikta-postprocess: VERDIKTA_WALLET_KEY not set — cannot execute {req_path.name}")
        sys.exit(1)
    acct = Account.from_key(os.environ["VERDIKTA_WALLET_KEY"]) if os.environ.get("VERDIKTA_WALLET_KEY") else None
    try:
        if action == "finalize":
            do_finalize(req, acct)
        elif action == "submit":
            do_submit(req, acct, req_path.parent)
        else:
            print(f"::warning::verdikta-postprocess: unknown action '{action}' in {req_path.name}")
            sys.exit(1)
    except CapRefused as e:
        print(f"::warning::verdikta-postprocess: SAFETY CAP REFUSED — {e}")
        log_line(f"REFUSED by safety cap: {e}")
        sys.exit(3)


if __name__ == "__main__":
    main()
PYEOF

# Daily submission cap (state is authoritative; refused/failed runs don't count)
SENT_TODAY=0
[ -f "$STATE_FILE" ] && SENT_TODAY=$(jq -r --arg d "$TODAY" '.daily[$d] // 0' "$STATE_FILE" 2>/dev/null || echo 0)

# Finalize requests first (they only reclaim/settle — no new spend)
for req_file in "$PENDING_DIR"/finalize-*.json; do
  [ -f "$req_file" ] || continue
  echo "verdikta-postprocess: processing $(basename "$req_file")..."
  python3 "$HELPER" "$req_file" || echo "::warning::verdikta-postprocess: $(basename "$req_file") failed (non-fatal)"
  rm -f "$req_file"
done

# Then at most ONE submit per run, subject to the daily cap
SUBMITTED_THIS_RUN=0
for req_file in "$PENDING_DIR"/submit-*.json; do
  [ -f "$req_file" ] || continue
  IS_DRY=$(jq -r '.dryRun // false' "$req_file" 2>/dev/null || echo false)
  if [ "$IS_DRY" != "true" ]; then
    if [ "$SUBMITTED_THIS_RUN" -ge 1 ]; then
      echo "::warning::verdikta-postprocess: per-run cap (1 submission) — dropping $(basename "$req_file")"
      rm -f "$req_file"; continue
    fi
    if [ "$SENT_TODAY" -ge "$MAX_PER_DAY" ]; then
      echo "::warning::verdikta-postprocess: daily cap ($MAX_PER_DAY) reached — dropping $(basename "$req_file")"
      rm -f "$req_file"; continue
    fi
  fi
  echo "verdikta-postprocess: processing $(basename "$req_file")..."
  if python3 "$HELPER" "$req_file"; then
    [ "$IS_DRY" != "true" ] && { SUBMITTED_THIS_RUN=$((SUBMITTED_THIS_RUN + 1)); SENT_TODAY=$((SENT_TODAY + 1)); }
  else
    echo "::warning::verdikta-postprocess: $(basename "$req_file") failed (non-fatal)"
  fi
  rm -f "$req_file"
done

rm -rf "$PENDING_DIR"
echo "verdikta-postprocess: done"
