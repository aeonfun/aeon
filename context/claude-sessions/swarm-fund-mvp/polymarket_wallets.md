---
name: Polymarket wallets and deposit flow
description: PM proxy (Polygon) deposit address + cross-chain deposit widget behavior
type: project
originSessionId: 07e0fd63-5c10-47dd-9875-df2c9f852fef
---
**Two distinct PM addresses — do not confuse:**

1. **PM order-signing identity (`POLY_FUNDER` in .env) — `0x52EB75Ec04bA5C9AfF93BA65ef2078Eee6D8f0bD`**
   Used as the `maker` field on every order the CLOB client signs. Found at polymarket.com/settings → "Address". The UI labels it "API use only — do not send funds here" which is misleading; it IS the identity PM uses to attribute orders and manage balances internally. Confirmed empirically 2026-04-21: first Revenant attributed order (orderID 0x0a5d1e53…) filled with `sig_type=1` + this funder.

2. **PM deposit landing address (shared aggregator) — `0x0a10e315183EcbecD2E5CF08DAD6E9d0535752B1`**
   The same address PM's "Transfer Crypto" widget shows across every supported source chain (Arbitrum / Base / Optimism / Polygon / Ethereum). A bridge aggregator — NOT a user-specific proxy. Never use as `funder`. Use only for deposits.

**How to apply:**
- Never ask Thomas to rediscover this address — use it for balance checks, reconciliation, or when wiring `py-clob-client` / `py-builder-signing-sdk` (ADR-049 follow-up).
- PM's "Transfer Crypto" deposit widget shows the SAME address across all supported source chains (Arbitrum, Base, Optimism, Polygon, Ethereum). The chain dropdown tells their aggregator which origin to watch — not which address to send to. Safe to pick Arbitrum for cheapest fees.
- This address is distinct from the HL wallet (`0x83F4c49cF459cAbEDE08228FC471Ab89D0B189e3`). PM ≠ HL. Different rails, different purposes: PM = signal + CLOB trading, HL = perp execution.
- When M10 Builders Program goes live, volume attributed to this wallet's orders → rev-share back to Thomas.
