import yaml, sys
ok = True
for path in [
    ".github/workflows/messages.yml",
    ".github/workflows/aeon.yml",
    ".github/workflows/chain-runner.yml",
]:
    try:
        with open(path) as f:
            yaml.safe_load(f)
        print(f"OK {path}")
    except Exception as e:
        print(f"FAIL {path}: {e}")
        ok = False
sys.exit(0 if ok else 1)
