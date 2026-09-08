// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// TEMPLATE: hook-fee skim (Tier 2, return-delta).
// Flags required in the address: AFTER_SWAP + AFTER_SWAP_RETURNS_DELTA (0x44) - the
// same bits AeonFee already needs, so the skim adds no new flags.
// Takes FEE_BPS of the swap's unspecified currency (magnitude: exact-in AND exact-out)
// and routes it to an immutable recipient, ON TOP of the mandatory 10 bps AeonFee that
// the base afterSwap takes first. The hook never holds funds.
// Labs routing: allowlist required (afterSwapReturnsDelta). Cannot auto-route.
//
// WARNING: a return-delta hook moves the token ledger. A wrong delta or a failed
// take() reverts every swap and bricks the pool. Always simulate before deploy.

import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

import {AeonFee} from "./AeonFee.sol";

contract HookFeeHook is AeonFee {
    using BalanceDeltaLibrary for BalanceDelta;

    address public immutable feeRecipient;

    // hook fee in basis points of the unspecified amount (100 = 1.00%). This is the
    // hook's OWN skim, taken on top of the mandatory 10 bps AeonFee (AEON_FEE_BPS).
    uint256 public constant FEE_BPS = 100;

    event HookFeeTaken(Currency indexed currency, uint256 amount, address indexed recipient);

    constructor(IPoolManager _pm) AeonFee(_pm) {
        feeRecipient = msg.sender;
    }

    // Extra skim, taken AFTER the base AeonFee. Returns the additional delta it takes,
    // which the base afterSwap folds into the total return delta.
    function _afterSwapExtra(
        address,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata
    ) internal override returns (int128) {
        // --- AEON:LOGIC START ---
        // Unspecified currency: output on exact-in, input on exact-out. Charge both.
        (Currency feeCurrency, int128 unspecifiedAmount) = ((params.amountSpecified < 0) == params.zeroForOne)
            ? (key.currency1, delta.amount1())
            : (key.currency0, delta.amount0());

        // Widen before negating: -type(int128).min overflows int128 checked arithmetic.
        int256 wideAmount = int256(unspecifiedAmount);
        uint256 magnitude = uint256(wideAmount < 0 ? -wideAmount : wideAmount);
        if (magnitude == 0) return int128(0);

        uint256 feeAmount = (magnitude * FEE_BPS) / 10_000;
        if (feeAmount == 0) return int128(0);
        require(feeAmount <= uint256(uint128(type(int128).max)), "fee overflow");

        poolManager.take(feeCurrency, feeRecipient, feeAmount);
        emit HookFeeTaken(feeCurrency, feeAmount, feeRecipient);
        return int128(uint128(feeAmount));
        // --- AEON:LOGIC END ---
    }
}
