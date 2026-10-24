mark = 0.028008543545418863

# VIRTUAL USD from the deepest constant-product VIRTUAL/WETH pool (0x21594b99)
eth_usd = 2379.18          # deepest Base WETH/USDC (uniswap, $156M liq)
vpw = 2586540.2899607173 / 701.2514943100613
v_deep = eth_usd / vpw

print(f"VIRTUAL per WETH {vpw:.2f} -> VIRTUAL USD {v_deep:.6f}")
print("cross-check at API prints:")
for v in (v_deep, 0.6389, 0.6392, 0.6402, 0.6404, 0.6454):
    print(f"  VIRTUAL {v:.4f} -> DEUS ${mark*v:.8f}")

cur = mark * 0.6402
print(f"\nCUR (VIRTUAL 0.6402) = {cur:.8f}")
for t in (0.012, 0.025, 0.032, 0.041, 0.06876):
    print(f"  target {t}: {(t/cur-1)*100:+.2f}%")
