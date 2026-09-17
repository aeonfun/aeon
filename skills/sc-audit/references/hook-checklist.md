# Uniswap v4 hook audit checklist (11 classes)

Applies to ANY Uniswap v4 hook - any repo, any deployed address, any file. A contract is a v4 hook if it implements at least one `IHooks` callback (`before/after` Initialize/Swap/AddLiquidity/RemoveLiquidity/Donate) or inherits a hook base (`BaseHook`, `SafeCallback`, `IHooks`, a custom fee base). This is target-agnostic: it is NOT specific to any operator's fleet.

Derived from the real v4 hook exploits (Cork ~$12M, Bunni ~$8.4M) and public audits (OpenZeppelin, Trail of Bits, Cyfrin, Certora, Spearbit, Sherlock, Cantina). Ordered by where money has actually gone. Walk every class per hook; a "no" or "unsure" is a candidate that goes through S6 triage and S6.5 fuzz like any other finding.

Severity tags: [C] critical, [H] high, [M] medium, [L] low.

## Recon (do first)
- List every callback the hook implements and the permission flags encoded in its address (low 14 bits, mask `0x3FFF`) or declared in `getHookPermissions()`.
- Which callbacks are meant to be called only by `PoolManager` vs by users/keepers.
- Map external calls made inside each callback (tokens, vaults, oracles, other hooks).
- Does one hook instance serve ONE pool or MANY (shared state is a recurring root cause).
- Custom accounting: does it return deltas (`BeforeSwapDelta`, `BalanceDelta`), mint ERC-6909, or run a custom curve.

## Class 1 - Access control (Cork $12M - check first)
- [C] Every PoolManager-only callback has `require(msg.sender == address(poolManager))` (or inherits `SafeCallback`/`BaseHook` `onlyPoolManager`).
- [C] The guard names the RIGHT caller (Paladin shipped `onlyBunniHub` where the caller was `BunniHook`; wrong modifier is as bad as none).
- [C] `beforeInitialize` cannot be called directly to overwrite pool state / LP-token mappings (Composable demo orphaned victim LP tokens).
- [H] Keeper/rebalance/distribute functions (`executeOrder`, `rebalance`, `poke`, reward distribution) are permissioned or safe to call permissionlessly (`BaseDynamicFee.poke()` was open).
- [M] Rules enforced in a hook cannot be bypassed by calling the un-permissioned `PoolManager` op directly.

## Class 2 - hookData / PoolKey / input validation (Cork + Doppler)
- [C] `hookData` is validated before use (Cork decoded attacker `hookData` into a `CorkCall` with zero validation).
- [C] Hook bound to expected pool(s) by `PoolId` allowlist, OR validates the full `PoolKey` (both currencies, fee, tickSpacing, hooks) at init (anyone can create a pool pointing at your hook; Doppler/Airlock drained via attacker `PoolKey`).
- [H] No cross-market token reuse: one market's derived token cannot be supplied as another market's base (Cork reused a DS token as RA).
- [M] Funds tracked per `PoolId` (nested mappings) so a malicious pool sharing the hook cannot overwrite another pool's accumulators.

## Class 3 - Flash-accounting / deltas (settle / sync / take / clear)
- [C] All currency deltas net to zero by end of `unlock`; every debit `settle()`d, every credit `take()`n (unsettled delta reverts `CurrencyNotSettled`).
- [C] No double-settle on chains where native has an ERC-20 form (CELO, zkSync ETH): forbid consecutive `sync()` without an intervening `settle()`.
- [C] Custom-curve math cannot produce zero-input-nonzero-output or net-positive round-trips (TOB-BUNNI free swaps).
- [H] `BeforeSwapDelta` / `BalanceDelta` sign and ordering correct (upper 128 bits = specified/amount0, lower = unspecified/amount1; wrong sign reverses payment direction; order must follow `params.zeroForOne`).
- [H] ERC-6909 claim tokens segregated per purpose; no recursive claim-on-behalf (Paladin/Bunni: `settle` -> `transferFrom` -> `notifyTransfer` credited PoolManager, attacker claimed its rewards).
- [M] Dust residual balances `clear()`ed; leftover dust blocks settlement (DoS).
- [M] `sync()` never called before `unlock()`.

## Class 4 - Rounding / precision (Bunni $8.4M)
- [C] Every `mulDiv` / share<->asset conversion rounds in the PROTOCOL's favor (Bunni's `withdraw()` floor-rounded the wrong way; ~44 tiny withdrawals shrank active balance ~85%).
- [C] Repeated small ops (withdraw, rebalance) cannot compound a rounding error to drain.
- [H] First-depositor / share inflation guarded (min liquidity seeded/locked, or high-precision shares; a 1-wei deposit + direct transfer cannot inflate the rate).
- [M] Fees cannot exceed 100%; before-swap delta cannot exceed the specified amount on exact-input.

## Class 5 - Reentrancy (Bunni)
- [C] Reentrancy guards are PER-POOL, not a single global transient slot a malicious hook can flip (Bunni `unlockForRebalance()` reset the global `nonReentrant`).
- [C] Canonical-hook enforcement: token/pool deploy paths `require(hook == expectedHookAddress)`.
- [H] Checks-effects-interactions: state written AFTER external calls uses `+=`, not overwrite (`=`) of a cached snapshot.
- [H] Native-ETH transfers and untrusted token callbacks (ERC-777, fee-on-transfer, ERC-4626 vaults) cannot reenter before state settles.

## Class 6 - Permission-bit / return-data encoding
- [C] Address flag bits exactly match `getHookPermissions()` / implemented functions. Flag set but function unimplemented reverts; implemented but flag unset is silently skipped (Angstrom omitted `AFTER_SWAP_RETURNS_DELTA` -> every swap reverts `CurrencyNotSettled`).
- [H] Return data is exactly 32 bytes (selector), 64 (delta callbacks), or 96 (`beforeSwap`: bytes4 + int256 `BeforeSwapDelta` + uint24 fee).
- [H] Returns-delta flag set whenever a callback returns a non-zero delta.
- [M] `validateHookPermissions()` runs in the constructor; the CREATE2 salt is mined so the address carries exactly the intended flags. A hook that `take()`s + returns a delta but lacks the returns-delta flag bricks every swap.
- [M] Not upgradeable in a way that adds a callback the fixed CREATE2 address can never route.

## Class 7 - Dynamic fees
- [H] Fee bounded and rate-limited; a fee manager cannot set an extreme fee in `beforeSwap` to move price/TWAP without arb risk (TOB-BUNNI-11 fed a lending oracle).
- [M] Pool created with `DYNAMIC_FEE_FLAG` (0x800000); otherwise the hook's fee is ignored and the default (0%) used.
- [M] Returned fee OR'd with `OVERRIDE_FEE_FLAG` (0x400000); otherwise the override is silently dropped.
- [L] `updateDynamicLPFee()` called in `afterInitialize` so the pool does not run at 0% forever (Angstrom).

## Class 8 - JIT liquidity
- [C] Penalty/reward logic cannot be zeroed by a tiny `increaseLiquidity` before removal (OZ LiquidityPenalty: increase auto-collects fees, sets `feeDelta = 0`, penalty skipped).
- [H] Fee/penalty distribution cannot be captured by a same-block JIT position injected at the destination tick (OZ AntiSandwich grabbed ~99%).
- [H] Rebalance/order math does not read current (JIT-inflated) liquidity; use pre-swap or time-averaged values (TOB-BUNNI-9).
- [M] Consider withdrawal queues / time-locks / JIT penalties for reward-bearing positions.

## Class 9 - Price manipulation / tick math
- [C] Tick-crossing accounting handles the boundary where `currentTick` == an exact tickSpacing multiple at a range's upper end; do not skip that tick's `liquidityNet` (Angstrom underflow DoS / reward theft; KyberSwap $56M precedent).
- [H] Prices read from external state use TWAP, not spot `getSlot0().sqrtPriceX96` (Flayer H-17 drained via manipulable spot).
- [H] Swaps against zero/uninitialized active liquidity cannot shove price to extreme ticks.
- [M] Ticks validated against `tickSpacing` alignment and min/max usable tick.

## Class 10 - Gate unit-confusion (subtle, source-reasoning)
- [H] A `beforeSwap`/`afterSwap` gate comparing raw `amountSpecified` to a token-denominated constant is unit-confused: the caller picks the specified currency via exact-in vs exact-out AND direction, so one constant silently governs BOTH tokens, and on a sub-18-decimal specified token the cap fails OPEN.
- [H] A `balance` / `skew` / `heavier-side` gate on the two virtual reserves is a raw-price-vs-`1.0` gate in disguise: `StateLibrary` gives `amount0 = L*2^96/sqrtP` and `amount1 = L*sqrtP/2^96`, so `amount0/amount1 = 1/price` and `L` cancels, leaving the pool's raw price (`token1/token0` in smallest units) vs an implicit `1.0`. Such a gate is permanently one-directional on any pair not a same-decimals pool near parity (one whole leg reverts forever) unless it anchors to the pool's OWN reference (`sqrtPriceX96` at `afterInitialize`, flag bit `0x1000`) or an explicit target ratio. Confirm at a price away from 1:1, BOTH legs; a gate that only looks correct at parity is a false pass.

## Class 11 - DoS / economic / tokens
- [C] Liquidity-modification hooks (`before/afterRemoveLiquidity`) cannot revert unconditionally; a revert permanently locks LP principal + fees (unlike v3, fee deltas must settle on every modify).
- [C] Withdraw/exit path exists and works; an `_unlockCallback` that only adds liquidity strands funds forever (Flayer H-8).
- [H] No unbounded loops / arrays in callbacks; no downcast overflow in reward accumulators (Paladin).
- [H] External-dependency (oracle, vault, cross-chain) failures wrapped in try/catch on non-critical paths so a revert cannot brick swaps.
- [H] Hook self-triggered swaps cannot be looped to keep multiple fee legs (Licredity `_afterSwap` back-run); accrued-fee accounting decremented on withdraw so stale `tokensOwed` cannot siphon co-holders (Vii).
- [M] `receive()` present for native pairs; `msg.value` validated exactly (missing `receive()` = native settlement DoS, Doppler H-04).
- [M] Non-standard tokens handled or rejected (fee-on-transfer, rebasing, ERC-777, pausable, odd decimals); `salt` unique per user where positions are salted.
- [L] `block.number` on L2s (Arbitrum returns L1 number) does not break same-block windows; prefer `block.timestamp`.

## Invariants worth asserting (feed the S6.5 fuzz arm)
- Sum of all currency deltas == 0 at end of every `unlock`.
- No swap path yields output with zero input, or a net-positive round-trip.
- Repeated small withdrawals/rebalances never increase attacker net value.
- A pool created by a non-owner with arbitrary `PoolKey` cannot touch another pool's funds or state.
- Every PoolManager-only callback reverts when `msg.sender != poolManager`.
