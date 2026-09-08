// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// FREEFORM hook scaffold. In freeform mode the deploy-uni-hook skill rewrites the
// AEON:BODY region with callbacks generated from the user's prompt.
//
// Every hook inherits AeonFee: a MANDATORY 10 bps protocol fee taken in afterSwap
// and routed to the aeon recipient. `afterSwap` lives in AeonFee and is NOT virtual,
// so a freeform body can never implement, lower, or skip it. Post-swap logic goes in
// `_afterSwapExtra`, which runs AFTER the protocol fee is taken.
//
// Rules the generator MUST keep:
//   - Contract name stays `Hook`, it stays `is AeonFee`, and the constructor stays
//     `constructor(IPoolManager _pm) AeonFee(_pm)` (the deploy script imports `Hook`
//     by name; AeonFee sets `poolManager` + `onlyPoolManager`).
//   - Do NOT implement `afterSwap`, `poolManager`, `onlyPoolManager`, or
//     `NotPoolManager` - they come from AeonFee. For post-swap logic, override
//     `_afterSwapExtra` (return 0 unless the hook takes an ADDITIONAL delta of its own,
//     in which case it must `poolManager.take` that amount itself).
//   - Every OTHER callback uses the EXACT IHooks signature, carries `onlyPoolManager`,
//     and returns the right selector (e.g. `IHooks.beforeSwap.selector`).
//   - Flags are AUTO-DERIVED from which callbacks exist (see hook-deploy.sh). Because
//     AeonFee always takes a return-delta fee, EVERY hook's flags carry AFTER_SWAP +
//     AFTER_SWAP_RETURNS_DELTA - so an aeon hook is never Labs auto-routable (allowlist).
//   - A dynamic-fee hook sets HOOK_POOL_FEE=dynamic in hook.env and returns
//     `fee | LPFeeLibrary.OVERRIDE_FEE_FLAG` from beforeSwap.
//   - Games must succeed with empty hookData; do not revert a vanilla exact-in; do not
//     key state off sender (sender is the router, not the trader).
//   - Extra fee take (in `_afterSwapExtra`): magnitude of unspecified (exact-in AND
//     exact-out). Widen to int256 before abs. take() to an immutable recipient, never
//     address(this), no withdraw.
//   - Gates: no exact-match on moving state, no raw amountSpecified cap, no
//     balanceOf(poolManager). Helpers must match execution-time state.
//
// All commonly-needed imports/usings are here so generated bodies compile as-is.

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {PoolId, PoolIdLibrary} from "@uniswap/v4-core/src/types/PoolId.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";
import {LPFeeLibrary} from "@uniswap/v4-core/src/libraries/LPFeeLibrary.sol";
import {StateLibrary} from "@uniswap/v4-core/src/libraries/StateLibrary.sol";
import {TickMath} from "@uniswap/v4-core/src/libraries/TickMath.sol";

import {AeonFee} from "./AeonFee.sol";

contract Hook is AeonFee {
    using PoolIdLibrary for PoolKey;
    using StateLibrary for IPoolManager;
    using BalanceDeltaLibrary for BalanceDelta;
    using CurrencyLibrary for Currency;

    constructor(IPoolManager _pm) AeonFee(_pm) {}

    // --- AEON:BODY START (freeform: replace with callbacks from the prompt) ---
    // Default scaffold = a no-op post-fee counter in `_afterSwapExtra`, so the file
    // compiles and is a working example. The mandatory 10 bps AeonFee is taken by the
    // base afterSwap before this runs. Auto-derived flags for this default: AFTER_SWAP
    // + AFTER_SWAP_RETURNS_DELTA (0x44), from AeonFee.
    mapping(PoolId => uint256) public swapCount;

    event SwapCounted(PoolId indexed id, uint256 count);

    function _afterSwapExtra(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata,
        BalanceDelta,
        bytes calldata
    ) internal override returns (int128) {
        PoolId id = key.toId();
        swapCount[id] += 1;
        emit SwapCounted(id, swapCount[id]);
        return int128(0);
    }
    // --- AEON:BODY END ---
}
