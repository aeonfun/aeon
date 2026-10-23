## ⏰ NOTE 1.2M 解锁 · 49 分钟后到期（09:57:36Z）

**没被撤销，也没被提前执行 —— 计时器还活着。**

| 项 | 09:08Z 实测 |
|---|---|
| timelock 余额 | 15,254,442.020047023418334577（与 12h 前**逐位一致**） |
| 到期 | **09:57:36Z**（`getTimestamp` = 1792749456） |
| opId | `0x77a7b0d650cf28a45a80db71431d0790605733608d5c3e98508467a66b6974da` |
| owner EOA | nonce 368 · 371,682.037 · **零动作** |
| 上膛钱包4 | `0xe4bf6f7e…fcf9a` nonce **0** · 50,000 · **未扣扳机** |

**可执行量：1,200,000 NOTE ≈ $47.7k ≈ 日量 8.6%**（未过 50% 黄线）。历史手法是解锁后拆 9 笔，单次冲击约 −2%。

### 下一步
- **你的 09:57Z 之后有个 11h 盲区** —— 下一次 `onchain-monitor` 是 21:00Z，`price-alert` 只盯 DEUS。若要盯执行瞬间，现在手动跑一次 `onchain-monitor`（约 10 分钟后），或等 21:00Z 一次看两层。
- 位置未变：NOTE $0.03973（h1 −3.55%，24h −21.37%），池子 $400,322（12h 净卖压 +128,768 已吸收）。
- DEUS $0.01739，四门槛全未触及，距 $0.041 回本线 +135.8%。**DEUS 侧无需动作。**

来源：`rpc.mainnet.chain.robinhood.com` eth_getLogs/eth_call（18 calls × 5 job，0 retries）· NOTE `0xc4f730335Fb9e439ca5552f7b52B8E638c4245B0` · timelock `0x4a53afd9c4d707c8fddd6415947ef0a1e67518b8` · DexScreener `api.dexscreener.com`
