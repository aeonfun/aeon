"""
OpenAI Agents SDK ↔ Aeon A2A example.

Registers `aeon-token-report` as a function tool the Agent can call when
the user asks about a crypto token. The Agent decides when to call it,
extracts the symbol/address from the prompt, and returns the report.

Setup:
    export A2A_GATEWAY_URL=http://localhost:41241
    export OPENAI_API_KEY=sk-...
    pip install openai-agents requests
    python examples/a2a/openai_agents_client.py "what's the price of $AEON?"
"""
from __future__ import annotations

import os
import sys
import time
import uuid

import requests
from agents import Agent, Runner, function_tool

GATEWAY = os.environ.get("A2A_GATEWAY_URL", "http://localhost:41241")


def _call_aeon(skill_id: str, var: str) -> str:
    task_id = str(uuid.uuid4())
    requests.post(
        GATEWAY,
        json={
            "jsonrpc": "2.0", "id": 1, "method": "tasks/send",
            "params": {
                "id": task_id, "skillId": skill_id, "var": var,
                "message": {"role": "user", "parts": [{"type": "text",
                            "text": f"Run {skill_id} var={var}"}]},
            },
        },
        timeout=30,
    ).raise_for_status()
    for _ in range(120):
        time.sleep(5)
        result = requests.post(
            GATEWAY,
            json={"jsonrpc": "2.0", "id": 2, "method": "tasks/get",
                  "params": {"id": task_id}},
            timeout=30,
        ).json()["result"]
        state = result["status"]["state"]
        if state == "completed":
            return result["artifacts"][0]["parts"][0]["text"]
        if state in ("failed", "canceled"):
            raise RuntimeError(f"Aeon {skill_id} {state}: {result['status']}")
    raise TimeoutError(f"Aeon {skill_id} timed out")


@function_tool
def aeon_token_report(token: str) -> str:
    """Get a full Aeon token report for a crypto token.

    Args:
        token: A token symbol (e.g. 'AEON', 'BTC') or a contract address.
               Pass the bare symbol without the leading '$'.

    Returns:
        Markdown report with price, 24h change, liquidity, volume, FDV,
        and recent buy/sell stats.
    """
    return _call_aeon("aeon-token-report", token)


crypto_analyst = Agent(
    name="crypto-analyst",
    instructions=(
        "You are a crypto analyst. When the user asks about a token's price, "
        "stats, or fundamentals, call `aeon_token_report` with the token "
        "symbol or address, then summarise the key numbers in two sentences "
        "and append the full report below."
    ),
    tools=[aeon_token_report],
)


if __name__ == "__main__":
    prompt = " ".join(sys.argv[1:]) or "what's the price of $AEON?"
    result = Runner.run_sync(crypto_analyst, prompt)
    print(result.final_output)
