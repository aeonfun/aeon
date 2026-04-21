"""
LangChain ↔ Aeon A2A example.

Wraps an Aeon skill as a LangChain Tool so any LangChain agent can call it.
This example calls `aeon-fetch-tweets` to grab the latest mentions of a topic.

Setup:
    export A2A_GATEWAY_URL=http://localhost:41241   # ./add-a2a in your aeon repo
    pip install langchain requests
    python examples/a2a/langchain_client.py "AI agents"
"""
from __future__ import annotations

import os
import sys
import time
import uuid

import requests
from langchain.tools import Tool

GATEWAY = os.environ.get("A2A_GATEWAY_URL", "http://localhost:41241")
POLL_SECONDS = 5
MAX_POLLS = 120  # 10 min — matches Aeon's GitHub Actions timeout


def call_aeon(skill_id: str, var: str = "") -> str:
    """Submit an Aeon skill task via JSON-RPC and poll until it completes."""
    task_id = str(uuid.uuid4())
    submit = requests.post(
        GATEWAY,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tasks/send",
            "params": {
                "id": task_id,
                "skillId": skill_id,
                "var": var,
                "message": {
                    "role": "user",
                    "parts": [{"type": "text", "text": f"Run {skill_id} var={var}"}],
                },
            },
        },
        timeout=30,
    ).json()
    if "error" in submit:
        raise RuntimeError(f"Aeon rejected task: {submit['error']}")

    for _ in range(MAX_POLLS):
        time.sleep(POLL_SECONDS)
        status = requests.post(
            GATEWAY,
            json={
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tasks/get",
                "params": {"id": task_id},
            },
            timeout=30,
        ).json()
        state = status["result"]["status"]["state"]
        if state == "completed":
            return status["result"]["artifacts"][0]["parts"][0]["text"]
        if state in ("failed", "canceled"):
            raise RuntimeError(f"Skill {skill_id} {state}: {status['result']['status']}")
    raise TimeoutError(f"Skill {skill_id} timed out after {POLL_SECONDS * MAX_POLLS}s")


aeon_fetch_tweets = Tool(
    name="aeon_fetch_tweets",
    func=lambda topic: call_aeon("aeon-fetch-tweets", topic),
    description=(
        "Fetch the latest tweets matching a topic, handle, or keyword via Aeon. "
        "Input: a search query (e.g. 'AI agents', '$AEON', '@aeonframework'). "
        "Returns: a markdown digest of recent tweets ranked by engagement."
    ),
)


if __name__ == "__main__":
    topic = " ".join(sys.argv[1:]) or "AI agents"
    print(f"[langchain_client] Calling aeon-fetch-tweets via {GATEWAY} for: {topic}")
    print(aeon_fetch_tweets.run(topic))
