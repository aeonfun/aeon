#!/usr/bin/env python3
"""Read stdin, extract and print the first balanced JSON object found.

Used by the skill quality-scoring step in .github/workflows/aeon.yml to pull
a JSON object out of free-text LLM responses (which may include markdown,
preamble, or trailing commentary). Lives in a standalone file because the
YAML literal block scalar in the workflow cannot host an unindented Python
heredoc.

Exit codes:
  0  printed a valid JSON object
  1  no balanced + valid JSON object found

Behaviour:
  - Scans the input character-by-character tracking brace depth
  - At each closing brace that returns depth to 0, attempts json.loads()
  - First successful parse is written to stdout; remaining input is ignored
  - Suppresses all error output (the workflow handles the empty-result case)
"""
import sys
import json


def main() -> int:
    text = sys.stdin.read()
    depth = 0
    start = None
    for i, c in enumerate(text):
        if c == "{":
            if depth == 0:
                start = i
            depth += 1
        elif c == "}" and depth > 0:
            depth -= 1
            if depth == 0 and start is not None:
                candidate = text[start:i + 1]
                try:
                    json.loads(candidate)
                    sys.stdout.write(candidate)
                    return 0
                except json.JSONDecodeError:
                    start = None
    return 1


if __name__ == "__main__":
    sys.exit(main())
