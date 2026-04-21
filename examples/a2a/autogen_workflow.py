"""
AutoGen ↔ Aeon A2A example.

Registers `aeon-deep-research` as a function tool that an AutoGen
AssistantAgent can call inside a multi-agent conversation. The user agent
asks the assistant to research a topic; the assistant calls Aeon and
returns the report.

Setup:
    export A2A_GATEWAY_URL=http://localhost:41241
    export OPENAI_API_KEY=sk-...                # AutoGen needs an LLM
    pip install pyautogen requests
    python examples/a2a/autogen_workflow.py "self-hosted LLM gateways 2026"
"""
from __future__ import annotations

import os
import sys
import time
import uuid

import requests
from autogen import AssistantAgent, UserProxyAgent

GATEWAY = os.environ.get("A2A_GATEWAY_URL", "http://localhost:41241")


def call_aeon_skill(skill_id: str, var: str = "") -> str:
    """Submit an Aeon task and poll until done. Returns the artifact text."""
    task_id = str(uuid.uuid4())
    requests.post(
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
    ).raise_for_status()

    for _ in range(120):
        time.sleep(5)
        status = requests.post(
            GATEWAY,
            json={"jsonrpc": "2.0", "id": 2, "method": "tasks/get", "params": {"id": task_id}},
            timeout=30,
        ).json()["result"]
        if status["status"]["state"] == "completed":
            return status["artifacts"][0]["parts"][0]["text"]
        if status["status"]["state"] in ("failed", "canceled"):
            raise RuntimeError(f"Aeon skill {skill_id} failed: {status['status']}")
    raise TimeoutError(f"Aeon skill {skill_id} timed out")


def aeon_deep_research(topic: str) -> str:
    """Exhaustive multi-source research via Aeon (30–50 sources)."""
    return call_aeon_skill("aeon-deep-research", topic)


config_list = [{"model": "gpt-4o-mini", "api_key": os.environ["OPENAI_API_KEY"]}]

assistant = AssistantAgent(
    name="researcher",
    llm_config={"config_list": config_list, "temperature": 0},
    system_message=(
        "You are a research assistant. When asked to research a topic, call the "
        "`aeon_deep_research` tool with the topic and return the result verbatim. "
        "End your message with TERMINATE when done."
    ),
)
assistant.register_for_llm(name="aeon_deep_research", description="Deep multi-source research via Aeon")(
    aeon_deep_research
)

user = UserProxyAgent(
    name="user",
    human_input_mode="NEVER",
    max_consecutive_auto_reply=2,
    code_execution_config=False,
    is_termination_msg=lambda m: "TERMINATE" in (m.get("content") or ""),
)
user.register_for_execution(name="aeon_deep_research")(aeon_deep_research)


if __name__ == "__main__":
    topic = " ".join(sys.argv[1:]) or "self-hosted LLM gateways 2026"
    user.initiate_chat(assistant, message=f"Research this topic deeply: {topic}")
