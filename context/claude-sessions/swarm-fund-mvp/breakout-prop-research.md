# Breakout Prop Research (2026-03-23)

## Key Finding: No Bot API

Breakout Prop was acquired by Kraken in September 2025. However, **execution does NOT happen on Kraken**.

- Breakout uses its own **Breakout Terminal** (TradingView-based)
- Liquidity sourced from **OKX, Bybit, and Binance** — not Kraken
- **No confirmed public API** for automated bot execution
- You do NOT need a Kraken account to use Breakout

## Implication for Swarm Fund

Kraken was DROPPED as execution venue because:
1. Agent swarm cannot route orders to Breakout programmatically
2. Kraken margin trading is separate from Breakout eval
3. $200k funded account would require manual/terminal-based execution
4. $200k aggregate cap limits scalability vs direct exchange trading

## Evaluation Details (for future reference)

- **Classic 1-Step:** 10% profit target, 4% daily loss / static max drawdown, no time limit
- **Account sizes:** $5k to $100k per account (up to $200k aggregate)
- **Leverage:** 5x on BTC/ETH, 2x on altcoins (system-enforced)
- **Profit split:** 80% (upgradable to 90%)
- **Payouts:** On-demand 24/7 in USDC (ERC-20), 12-24hr processing
- **Fees:** 0.04% per side per $10k notional
- **Pass rates:** Industry-wide estimated at 8-15%

## Revisit Conditions

- Breakout releases public API for automated trading
- Kraken Pro integration completes (Breakout migrating to Kraken Pro)
- Someone confirms bot execution is permitted via their support

## Sources

- breakoutprop.com, kraken.com/breakout, support.kraken.com
- PropTradingVibes review, QuantVPS rules breakdown
- The Block: Kraken acquires Breakout (Sep 2025)
