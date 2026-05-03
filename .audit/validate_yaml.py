import sys
import yaml

files = [
    ".github/workflows/messages.yml",
    ".github/workflows/chain-runner.yml",
    ".github/workflows/aeon.yml",
]

ok = True
for f in files:
    try:
        with open(f) as fh:
            yaml.safe_load(fh)
        print(f"OK: {f}")
    except yaml.YAMLError as e:
        ok = False
        print(f"FAIL: {f}: {e}")

sys.exit(0 if ok else 1)
