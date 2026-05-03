#!/usr/bin/env python3
"""Heartbeat skill: analyze memory/cron-state.json for P0 conditions and emit a report.
Reads the state file and prints failed/stuck/degraded/chronic categories used by the
heartbeat skill. Read-only; safe to run anywhere with the repo present.
"""
import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
STATE = ROOT / 'memory' / 'cron-state.json'

with STATE.open() as f:
    state = json.load(f)

now = datetime.now(timezone.utc)
print(f'Total skills tracked: {len(state)}')
print(f'Now: {now.isoformat()}')
print()

failed = []
stuck = []
api_deg = []
chronic = []
heartbeat_self = state.get('heartbeat')

for name, s in state.items():
    if s.get('last_status') == 'failed':
        failed.append((name, s.get('last_failed'), (s.get('last_error') or '')[:120]))
    if s.get('last_status') == 'dispatched':
        ld = s.get('last_dispatch')
        if ld:
            try:
                ldt = datetime.fromisoformat(ld.replace('Z', '+00:00'))
                age_min = (now - ldt).total_seconds() / 60
                if age_min > 45:
                    stuck.append((name, ld, age_min))
            except Exception:
                pass
    if s.get('consecutive_failures', 0) >= 3:
        api_deg.append((name, s.get('consecutive_failures'), (s.get('last_error') or '')[:160]))
    runs = s.get('total_runs', 0)
    sr = s.get('success_rate', 1.0)
    if runs >= 5 and sr < 0.5:
        chronic.append((name, runs, sr, s.get('last_status'), s.get('last_success')))

print('=== FAILED SKILLS (last_status==failed) ===')
for f in failed:
    print(f'  {f[0]} | last_failed={f[1]} | err={f[2]}')
print(f'  count={len(failed)}')
print()
print('=== STUCK SKILLS (dispatched > 45min) ===')
for s in stuck:
    print(f'  {s[0]} | last_dispatch={s[1]} | {s[2]:.0f}min ago')
print(f'  count={len(stuck)}')
print()
print('=== API DEGRADATION (consecutive_failures >= 3) ===')
for a in api_deg:
    print(f'  {a[0]} | consec={a[1]} | err={a[2]}')
print(f'  count={len(api_deg)}')
print()
print('=== CHRONIC FAILURES (success_rate < 0.5, runs >= 5) ===')
for c in chronic:
    print(f'  {c[0]} | runs={c[1]} | sr={c[2]:.2%} | last_status={c[3]} | last_success={c[4]}')
print(f'  count={len(chronic)}')
print()
print('=== HEARTBEAT SELF ===')
if heartbeat_self:
    ls = heartbeat_self.get('last_success')
    print(f'  last_status={heartbeat_self.get("last_status")}')
    print(f'  last_success={ls}')
    if ls:
        try:
            lst = datetime.fromisoformat(ls.replace('Z', '+00:00'))
            age_h = (now - lst).total_seconds() / 3600
            print(f'  age_hours={age_h:.2f}')
        except Exception:
            pass
