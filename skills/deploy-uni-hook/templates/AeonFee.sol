// SPDX-License-Identifier: MIT
pragma solidity 0.8.26;

// MANDATORY PROTOCOL FEE - inherited by EVERY hook this skill deploys.
//
// Takes AEON_FEE_BPS (10 bps = 0.10%) of every swap's unspecified (output) currency
// and routes it straight to AEON_FEE_RECIPIENT via poolManager.take(). The recipient
// and the rate are compile-time constants; afterSwap is NOT virtual, so a derived hook
// cannot lower, skip, or redirect the fee. A hook adds its own post-swap logic through
// `_afterSwapExtra`, which runs AFTER the protocol fee is taken.
//
// This mirrors the Programmable model - effective = hook's own extra ON TOP of the
// mandatory 10 bps: the base fee is always taken first, then the hook keeps whatever
// additional delta it returns from `_afterSwapExtra`.
//
// Flags every inheriting hook's address MUST carry: AFTER_SWAP + AFTER_SWAP_RETURNS_DELTA
// (0x40 | 0x04). Because the fee is a return-delta take(), an aeon-deployed hook is
// NEVER Uniswap Labs auto-routable - it always needs the allowlist / a UniswapX filler.
//
// WARNING: a return-delta hook moves the token ledger. A wrong delta or a failed take()
// reverts every swap and bricks the pool. Always simulate before deploy.

import {IHooks} from "@uniswap/v4-core/src/interfaces/IHooks.sol";
import {IPoolManager} from "@uniswap/v4-core/src/interfaces/IPoolManager.sol";
import {PoolKey} from "@uniswap/v4-core/src/types/PoolKey.sol";
import {Currency, CurrencyLibrary} from "@uniswap/v4-core/src/types/Currency.sol";
import {BalanceDelta, BalanceDeltaLibrary} from "@uniswap/v4-core/src/types/BalanceDelta.sol";

abstract contract AeonFee {
    using CurrencyLibrary for Currency;
    using BalanceDeltaLibrary for BalanceDelta;

    /// @notice Immutable protocol-fee recipient. A compile-time constant - it cannot be
    /// changed after deploy, and afterSwap (below) is not virtual, so no hook can redirect it.
    address public constant AEON_FEE_RECIPIENT = 0xF1E958db7D1e4C074377946018Ad645db4FB158e;

    /// @notice Protocol fee in basis points of the swap's unspecified amount (10 = 0.10%).
    uint256 public constant AEON_FEE_BPS = 10;

    IPoolManager public immutable poolManager;

    event AeonFeeTaken(Currency indexed currency, uint256 amount, address indexed recipient);

    error NotPoolManager();

    constructor(IPoolManager _pm) {
        poolManager = _pm;
    }

    modifier onlyPoolManager() {
        if (msg.sender != address(poolManager)) revert NotPoolManager();
        _;
    }

    /// @dev Mandatory afterSwap. Takes the protocol fee on the unspecified (output)
    /// currency, then folds in any additional delta a derived hook returns from
    /// `_afterSwapExtra`. NOT virtual: the fee cannot be overridden away.
    function afterSwap(
        address sender,
        PoolKey calldata key,
        IPoolManager.SwapParams calldata params,
        BalanceDelta delta,
        bytes calldata hookData
    ) external onlyPoolManager returns (bytes4, int128) {
        // The fee is charged on the swap's UNSPECIFIED currency: the OUTPUT side on an
        // exact-input swap (positive delta), the INPUT side on an exact-output swap
        // (negative delta). The fee is owed on both, so take the magnitude before the
        // guard (upstream FeeTakingHook.sol:44). Without this, the old `unspecifiedAmount
        // > 0` guard silently skipped the mandatory fee on every exact-output swap.
        (Currency feeCurrency, int128 unspecifiedAmount) = ((params.amountSpecified < 0) == params.zeroForOne)
            ? (key.currency1, delta.amount1())
            : (key.currency0, delta.amount0());

        // Take the magnitude of the unspecified delta. Widen to int256 BEFORE negating:
        // negating an int128 of type(int128).min (-2^127) in place would overflow 0.8's
        // checked arithmetic and revert, bricking that single swap (DoS). int256 has the
        // headroom, and any int128 magnitude fits back into uint256 for the fee math.
        int256 wideAmount = int256(unspecifiedAmount);
        uint256 magnitude = uint256(wideAmount < 0 ? -wideAmount : wideAmount);

        int128 feeDelta = 0;
        if (magnitude > 0) {
            uint256 feeAmount = (magnitude * AEON_FEE_BPS) / 10_000;
            if (feeAmount > 0) {
                require(feeAmount <= uint256(uint128(type(int128).max)), "aeon fee overflow");
                poolManager.take(feeCurrency, AEON_FEE_RECIPIENT, feeAmount);
                emit AeonFeeTaken(feeCurrency, feeAmount, AEON_FEE_RECIPIENT);
                feeDelta = int128(uint128(feeAmount));
            }
        }

        int128 extra = _afterSwapExtra(sender, key, params, delta, hookData);
        return (IHooks.afterSwap.selector, feeDelta + extra);
    }

    /// @dev Override to add post-swap logic. Runs AFTER the protocol fee is taken.
    /// Return an ADDITIONAL hook delta on the unspecified currency (0 for none); a hook
    /// that returns a non-zero positive delta MUST itself `poolManager.take` that amount,
    /// so the returned total equals what was actually taken. Default: no extra behavior.
    function _afterSwapExtra(
        address, /* sender */
        PoolKey calldata, /* key */
        IPoolManager.SwapParams calldata, /* params */
        BalanceDelta, /* delta */
        bytes calldata /* hookData */
    )
        internal
        virtual
        returns (int128)
    {
        return 0;
    }
}
