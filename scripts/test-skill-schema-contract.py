#!/usr/bin/env python3
"""Contract test: the JSON example in skills/perps-brief/SKILL.md must
validate against scripts/render-perps-brief.py's validate_schema().

Class of bug being prevented: PR #36 and PR #37 both shipped because
SKILL.md documented one schema and the render validator enforced a
stricter version. Claude composed a valid-per-docs brief, the validator
rejected it, no Discord delivery happened. We dispatched the chain three
times to find each instance.

This test extracts the first JSON code block under the "JSON schema"
section of SKILL.md, runs it through the validator, and fails if the
documented example doesn't pass. If SKILL.md says "thesis is an array"
but the validator wants a string, this catches it before the next
chain run.

Run as part of the smoke test, or standalone:

    python3 scripts/test-skill-schema-contract.py

Exits 0 on pass, 1 on schema-extraction failure, 2 on validation failure.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

# Import the validator from the render script
sys.path.insert(0, str(Path(__file__).resolve().parent))
import importlib.util

_render_path = Path(__file__).resolve().parent / "render-perps-brief.py"
spec = importlib.util.spec_from_file_location("render_perps_brief", _render_path)
render_module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(render_module)
validate_schema = render_module.validate_schema


SKILL_MD = Path("skills/perps-brief/SKILL.md")


def extract_first_json_under_heading(text: str, heading_regex: str) -> str | None:
    """Find the first ```json ... ``` block that appears AFTER `heading_regex`
    in `text`. Returns the JSON string or None if not found."""
    heading_match = re.search(heading_regex, text)
    if not heading_match:
        return None
    after = text[heading_match.end():]
    block_match = re.search(r"```json\s*\n(.*?)\n```", after, re.DOTALL)
    if not block_match:
        return None
    return block_match.group(1)


def main() -> int:
    if not SKILL_MD.exists():
        sys.stderr.write(f"contract-test: {SKILL_MD} missing\n")
        return 1

    skill_text = SKILL_MD.read_text()
    json_str = extract_first_json_under_heading(skill_text, r"#+\s*JSON schema")
    if not json_str:
        sys.stderr.write(
            "contract-test: could not find ```json block under 'JSON schema' "
            f"heading in {SKILL_MD}\n"
        )
        return 1

    # SKILL.md uses ${today} as a placeholder. Substitute a valid date so the
    # example parses + validates as if Claude had filled it in.
    json_str = json_str.replace('"${today}"', '"2026-05-25"')

    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e:
        sys.stderr.write(
            f"contract-test: SKILL.md JSON example does not parse: {e}\n"
            "First 200 chars:\n"
        )
        sys.stderr.write(json_str[:200] + "\n")
        return 2

    err = validate_schema(data)
    if err:
        sys.stderr.write(
            "contract-test: SKILL.md JSON example FAILS render-perps-brief "
            f"validator:\n  {err}\n\n"
            "SKILL.md documents the example as valid; the validator rejects it. "
            "One of them needs to change. Either:\n"
            "  - Update SKILL.md's example so the validator accepts it\n"
            "  - Loosen the validator to accept the documented shape\n"
        )
        return 2

    print(f"contract-test: SKILL.md JSON example validates clean against render-perps-brief")
    return 0


if __name__ == "__main__":
    sys.exit(main())
