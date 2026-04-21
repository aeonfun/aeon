"""
CrewAI ↔ Aeon A2A example.

Wraps `aeon-pr-review` as a CrewAI BaseTool so a Crew agent can review
pull requests on any GitHub repo as part of a larger workflow.

Setup:
    export A2A_GATEWAY_URL=http://localhost:41241
    export OPENAI_API_KEY=sk-...               # CrewAI default LLM
    pip install crewai crewai-tools requests
    python examples/a2a/crewai_task.py owner/repo
"""
from __future__ import annotations

import os
import sys
import time
import uuid

import requests
from crewai import Agent, Crew, Task
from crewai.tools import BaseTool
from pydantic import Field

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
        status = requests.post(
            GATEWAY,
            json={"jsonrpc": "2.0", "id": 2, "method": "tasks/get",
                  "params": {"id": task_id}},
            timeout=30,
        ).json()["result"]
        if status["status"]["state"] == "completed":
            return status["artifacts"][0]["parts"][0]["text"]
        if status["status"]["state"] in ("failed", "canceled"):
            raise RuntimeError(f"Aeon {skill_id} failed: {status['status']}")
    raise TimeoutError(f"Aeon {skill_id} timed out")


class AeonPRReviewTool(BaseTool):
    name: str = "aeon_pr_review"
    description: str = (
        "Review all open pull requests on a GitHub repo via Aeon. "
        "Input: a repo in owner/repo format. Returns: a markdown summary "
        "with risk flags, suggested merges, and blocking issues."
    )
    gateway_url: str = Field(default=GATEWAY)

    def _run(self, repo: str) -> str:
        return _call_aeon("aeon-pr-review", repo)


reviewer = Agent(
    role="Senior PR reviewer",
    goal="Triage open PRs on the target repo and recommend which to merge first.",
    backstory="A senior engineer who delegates the heavy reading to Aeon, then "
              "writes the prioritised summary for the team standup.",
    tools=[AeonPRReviewTool()],
    verbose=True,
    allow_delegation=False,
)

if __name__ == "__main__":
    repo = sys.argv[1] if len(sys.argv) > 1 else "aaronjmars/aeon"
    review_task = Task(
        description=f"Use the aeon_pr_review tool on {repo}, then write a 5-bullet "
                    f"prioritised standup summary.",
        expected_output="Markdown bullet list, ranked by merge priority.",
        agent=reviewer,
    )
    print(Crew(agents=[reviewer], tasks=[review_task], verbose=True).kickoff())
