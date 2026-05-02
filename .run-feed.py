import subprocess
r = subprocess.run(['bash', '/home/runner/work/aeon/aeon/scripts/generate-feed.sh'], capture_output=True, text=True, cwd='/home/runner/work/aeon/aeon')
print('STDOUT:', r.stdout)
print('STDERR:', r.stderr)
print('EXIT:', r.returncode)
