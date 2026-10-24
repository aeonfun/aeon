import json

p = "memory/topics/price-alert-state.json"
s = json.load(open(p))
tell = (
    " TELL 14 (NEW, 2026-10-24 06:12Z run): VERIFY RE-ACCUMULATION AGAINST THE POOL RESERVE MARK, NOT THE SIZE OF THE BUY PRINTS. "
    "The record 319,562 DEUS dump of 00:24:17Z was followed by 451,627 DEUS of buying routed through contract sink 0x939e398d -> LiFi diamond 0x1231deb6 -> back to the paying EOAs, "
    "and the deepest pool's own mark went 0.02769675 -> 0.02800854 VIRTUAL/DEUS (+1.13%), with net DEUS in the pool FALLING 105,836 below the pre-dump level. So the dump was fully reversed, not merely 'absorbed in the same block'. "
    "The lesson: same-block absorption and full reversal are different claims - only the NET reserve delta distinguishes them. "
    "ALSO: when a buy routes through an aggregator or relay CONTRACT, judge tell #6 by the WHOLE round trip. If the sink's total-in equals total-out AND the terminal EOA's balanceOf rises, it is a real buy. "
    "If the sink and the aggregator both end at 0.0000 and no EOA gained, it is a pass-through filling someone else's order. Here sink 451,627.3741 in == 451,627.3741 out, both sink and diamond at 0.0000, "
    "and 0x7f6aba75 rose 0 -> 335,249.4994 with balanceOf EXACTLY 0 at -24h/-48h/-7d (tell #8 satisfied) - unambiguously real new money, held. "
    "DIRECTIONAL READ FOR THE OPERATOR: this inverts the prior run's framing. Supply is leaving stakers and going into held hands, not onto the bid. The pool is TIGHTER than before the record unstake."
)
s["notes"] = s["notes"] + tell
json.dump(s, open(p, "w"), indent=2, ensure_ascii=False)
print("notes len", len(s["notes"]))
