// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// TEMPLATE: minimal base hook.
// Flags required in the address: BEFORE_SWAP + AFTER_SWAP + AFTER_SWAP_RETURNS_DELTA
// (0x80 | 0x40 | 0x04 = 0xC4). The afterSwap + return-delta bits come from AeonFee:
// even the "no-op" hook takes the mandatory 10 bps protocol fee.
// Labs routing: allowlist required (afterSwapReturnsDelta, from AeonFee). Cannot auto-route.
// Its own logic does nothing but emit an event so you can prove the hook fired. Use this
// as a clean starting point: add callbacks + flags, then fill the AEON:LOGIC region.

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {BeforeSwapDelta, BeforeSwapDeltaLibrary} from "@uniswap/v4-core/src/types/BeforeSwapDelta.sol";

import {AeonFee} from "./AeonFee.sol";

contract NoOpHook is AeonFee {
    event BeforeSwapFired(address indexed sender, bool zeroForOne, int256 amountSpecified);

    constructor(IPoolManager _pm) AeonFee(_pm) {}

    function beforeSwap(address sender, PoolKey calldata, IPoolManager.SwapParams calldata params, bytes calldata)
        external
        onlyPoolManager
        returns (bytes4, BeforeSwapDelta, uint24)
    {
        // --- AEON:LOGIC START ---
        emit BeforeSwapFired(sender, params.zeroForOne, params.amountSpecified);
        // --- AEON:LOGIC END ---
        return (IHooks.beforeSwap.selector, BeforeSwapDeltaLibrary.ZERO_DELTA, 0);
    }
}
