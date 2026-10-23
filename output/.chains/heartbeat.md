🚨 ✅ 120万 NOTE 已解锁执行 · owner 余额 148万 · 8分钟未转出

*NOTE 更新 — 10:00:35Z 解锁已执行*

**120 万 NOTE 刚刚从 timelock 打进 owner 钱包。** 不是"待执行"了。

- tx `0xc1c80d83fd0cefd7f1dd7f2818898b7bf6d0468e1196a244a9a38e7202ed3f9b` · blk 95,856,036 · `CallExecuted` topic0 `0xc2617efa…2b58` · opId `0x77a7b0d6…6974da`
- timelock 余额 **15,254,442 → 14,054,442**（−1,200,000，逐位对上）
- owner 余额 **281,682 → 1,481,682**，nonce **369 → 370**
- **解锁后 8 分钟，owner 尚未转出任何一笔**（`eth_getLogs[Transfer, owner]` 自 blk 95,856,036 起 = 0 条）

*现在桌上有什么*

| 位置 | NOTE | ≈USD | 状态 |
|---|---|---|---|
| owner EOA | 1,481,682 | $59.1k | 自由余额，**随时可动** |
| 上膛钱包5 `0x572bb527` | 90,000 | $3.6k | **ETH 仍 0，无 gas** |
| 上膛钱包4 `0xe4bf6f7e` | 50,000 | $2.0k | 有 gas，nonce 0 |

*这意味着什么*

按 10-20 那次的前例：owner 收到 120 万后当天就开始拆包外流。**现在是观察窗口的第 8 分钟。** 池子 24h 量 $571.7k，120 万 ≈ $47.9k = 8.4% —— 单池一次能吸收，但会压价。

**下一步盯三件事**（下次 onchain-monitor 21:00Z，11 小时后 —— 这是盲区）：
1. owner 余额 1,481,682 是否开始下降 / nonce 是否跳
2. `0x572bb527` 的 ETH 是否由 0 变正（**那才是 90k 真正上膛的时刻**）
3. PoolManager 的 NOTE 流入是否放量

---
数据源：`rpc.mainnet.chain.robinhood.com`，NOTE `0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0`，timelock `0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8`。价格 DexScreener 主池 `0x378b102395…`，NOTE $0.03991。