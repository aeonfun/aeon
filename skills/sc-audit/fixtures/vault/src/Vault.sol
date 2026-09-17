// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/// @title Vault
/// @notice A minimal ETH vault used ONLY as an sc-audit fuzz-arm regression fixture.
///         It is intentionally broken. Do not deploy or reuse.
///
/// Core accounting invariant that MUST always hold:
///   sum(balanceOf[*]) <= totalDeposited <= address(this).balance
/// (The `<=` form is deliberate: SELFDESTRUCT can force ETH in without executing code,
///  so the contract balance can exceed totalDeposited in correct code too. Asserting a
///  strict `==` would produce a spurious fuzzer failure.)
///
/// Every legitimate path (deposit / withdraw) preserves it. One path breaks it on
/// purpose so a property fuzzer (Echidna / Medusa) can find a counterexample.
contract Vault {
    mapping(address => uint256) public balanceOf;
    uint256 public totalDeposited;

    /// @notice Deposit ETH; credits the caller and the running total by msg.value.
    function deposit() external payable {
        balanceOf[msg.sender] += msg.value;
        totalDeposited += msg.value;
    }

    /// @notice Withdraw previously deposited ETH.
    function withdraw(uint256 amount) external {
        require(balanceOf[msg.sender] >= amount, "insufficient balance");
        balanceOf[msg.sender] -= amount;
        totalDeposited -= amount;
        (bool ok, ) = payable(msg.sender).call{value: amount}("");
        require(ok, "transfer failed");
    }

    /// @notice INTENTIONAL BUG (the whole point of this fixture): credits the caller's
    ///         balance out of thin air. It takes no ETH and never updates
    ///         `totalDeposited`, so it breaks the accounting invariant and lets the
    ///         caller withdraw ETH that other users deposited (fund theft).
    function claimBonus(uint256 amount) external {
        balanceOf[msg.sender] += amount;
    }
}
