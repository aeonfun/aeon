# Long-term Memory
*Last consolidated: 2026-10-22*

## About This Repo
- Autonomous agent on GitHub Actions。**外部时钟** = Cloudflare Worker `aeon-cron`：每 15 分钟触发 `scheduler.yml`、每 10 分钟触发 `messages.yml`。GitHub 自带的 fork `schedule` 基本不投递，别指望它。
- `enabled: true` ≠ 跑过。判断 skill 是否真跑，看 `memory/cron-state.json` 的 `last_dispatch` 和 `logs/`。
- `scheduler.yml` 用**精确时隙债务模型**（`scripts/cron-due.sh` + `CATCHUP_HOURS=12`）：晚了的时隙 12h 内补跑，所以唤醒在几分都无所谓。

## Tracked Token
| Token | Contract | Chain |
|---|---|---|
| DEUS | 0x940A319B75861014A220D9c6c144d108552B089B | base |

> `price-alert` reads only this table's first row — one token at a time. Currently DEUS.
> Escrow / xDEUS addresses: [DEUS escrow](/topics/deus-escrow.md).

## Lessons Learned
> 详情见 [lessons.md](/topics/lessons.md)。这里是每条一行。

**取数形状**
- **钱包型 watch 不能用 `eth_getLogs{address:<EOA>}`** —— EOA 不发事件，永久返回 0。正确形状是在**代币合约**上做 topic 过滤：`[Transfer, null, padded(wallet)]` 收、`[Transfer, padded(wallet)]` 发。
- **代币合约作为 watch 地址时，`to == watch` 算不出买卖方向** —— 要看池子：`X → PoolManager` 卖，`PoolManager → X` 买。
- **多跳路由把一笔交易记成 4 笔 Transfer** —— 聚合只认最终进/出 PoolManager 的那一腿。
- **xDEUS is ERC-721, not ERC-20** —— `decimals()` reverts，`tokenId` 在 `topics[3]`；topic0 哈希相同，无需改配置。
- **扫 timelock 别只扫"最近几天"。** RH 链 ~34k 块/小时，48h 排程跨 ~160 万块；锚点从已知排程块往前推。另 `topics: null` 会静默返回空数组 —— 扫全部事件就省略该字段。
- **Never trust a zero-log window** —— 报"平静"前，先重查一个已知活跃窗口 + `eth_call` 余额。
- **Path C 只读 ERC-20 logs，看不到 native ETH** —— gas 充值类触发器是盲区，需另跑 `eth_getBalance`。
- **RH 4663 完全免 key**，24k 块窗口可扫，行情用 GeckoTerminal/CoinGecko。

**判读**
- **calldata 解码 ≠ 链上事实。** 先看余额与出账，再谈机制。
- **新钱包 + 固定金额整数 = 先看 gas。** "第一笔 ETH 入账"比"转账发生"更接近真实开砸时刻。
- **链上预警有保质期。** 出货持续性看**总量与节奏**，不是单笔。
- **owner 自有余额与 timelock 是两条独立供给** —— 别只盯 unlock 排程。
- **claim 制 vesting 的"日释放"要看 scheduleId。** 同合约不同 schedule 量级差异巨大（7=21,446 · 11=2,954 · 18=191,793），按均值估日供给会失真。
- **缺 `h1` ≠ 平静。** DexScreener 薄盘口常省略 `priceChange.h1`，按 0 处理会让 sharp-move gate 显示 QUIET 而实际**未测量**；state 存 `null` 以区分。**补测出 0.00% 也要看成交量** —— 0 买 / 1 卖、1h 成交 $0.018 时价格是陈旧标记，不是"走平"。

**运维**
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。
- **网关 403 会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status:403` → 网关问题，不是 skill bug。10-21 的 `hivemindos: 403 All target providers failed` 连杀 7 次 run，数小时自愈。

## Next Priorities
- **上膛中的两个抛售钱包 —— 最高优先级、随时可能触发。** `0x3ace8e0a2937297be9488a8c235a616d1a929519`（100,000 NOTE，ETH 0.055798）与 `0xe4bf6f7efc32aad76e80916543d1277dbe8ecf9a`（50,000 NOTE，ETH 0.010764）都是 nonce 0、从未发过交易、gas 已到位、零出账。**任意一笔出账 = 开砸启动**，不需要再等充值。这是 10-20 / 10-21 同一套手法的前两步，已走完。
- **10-23 09:57:36Z 的 120 万 NOTE timelock 解锁 —— 与上面叠加。** opId `0x77a7b0d6…6974da`，calldata `NOTE.transfer(owner, 1,200,000)`、delay 172800s；全量扫描仍只有 1 条 `CallScheduled`、零 `Cancelled`、零 `Executed`，10-22 21:05Z 复核未撤销。**注意：这两天是两个已知供给事件同一天，不是单一的解锁日。**
- **vesting schedule 25 的受益人已更正为 owner 本人**（不是 `0x2807de7a`）。18:33Z owner 自领 401,682.037，schedule 25 剩余约 19.8 万仍可领。`owner()` = owner EOA。**别再把它当"第三方沉睡额度"。**
- **vesting release 量级不是恒定的**：scheduleId 7=21,446 · 8=2,937 · 11=2,954 · 18=191,793 · **25=401,682（10-22 18:33Z，迄今最大）**。不要按"每天 2 万"估日供给。

## Active Topics
- `price-alert` 长期 success，DEUS 在 $0.0172–$0.0174 窄带（10-23 04:02Z：$0.01723，24h −5.54%，四门槛全未触及，`last_alerts.*` 全 null）。**最深池已连续 3 个 run 零成交**（最后成交 01:30:29Z，至 04:02Z 约 151 分钟），h1 记 `null` 不可读；只有两个尘埃级小池还有活 h1（都 ±0.4% 内）。价格是陈旧标记，不是"走平"。距 $0.041 回本线 +137.9%。ATH 仍为 $0.06876，差 −74.9%。[source: logs/2026-10-23#price-alert]
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**10-22 owner 复活（18:09–18:51Z 三笔），余额 120,000→371,682，nonce 365→368。** 详见 Next Priorities 的上膛钱包。$0.04059（24h −27.4%），24h 净卖压 +472,236（0.79%），连续第三个净卖窗口。 [source: logs/2026-10-22#onchain-monitor]

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing; scale reference.
- [Base RPC access from the runner](/topics/base-rpc-access.md) — working endpoints and block caps.
- [Scheduler & notification plumbing](/topics/ops-plumbing.md) — diagnosing schedule events, notify formatting.
- [price-alert state file contract](/topics/price-alert-state.md) — field meanings and the seeding rule.
- [Topics index](/topics/index.md) — all durable notes.

## 监控清单（memory/on-chain-watches.yml）

当前 5 个：DEUS escrow · xDEUS · NOTE timelock · NOTE owner EOA · NOTE vesting 0xfdd9。Base 两条阈值 $200/$250；NOTE 供给侧三条阈值 $500（事件稀少，故意压低求敏感）。timelock 刻意不加 `event_topics` —— `CallScheduled`/`CallExecuted`/`Cancelled` 三种都要。
已摘、文件里保留注释块：`NOTE` 本体（全量 Transfer 噪音大）、`NOTE staging 0x69bb`（连续零活动）。
**新增 watch 必须同步在 `on-chain-state.json` 建条目并把 `last_block` 设成当前块，否则首次运行会重放历史；删除 watch 要同步删掉 state 里的孤儿键。**
钱包型 watch **必须用 topic 过滤扫代币合约**，不能直接拿地址查 log —— 详见 Lessons Learned。

## 链上取数（细节见 base-rpc-access.md）

- **10-22 起 `$BASE_RPC_URL` / `$RH_RPC_URL` 已是 Infura 免费档，`eth_getLogs` 只允许 10 块** —— 分窗脚本会一路减半假装"卡住"或"零日志"。判据：错误体含 `Free tier plan` + `10 block range`。`memory/rpc.sh` 继承同一 env，同样会踩。**显式绕过 env 直打公共端点。** [source: logs/2026-10-22#onchain-monitor]
- Base `base.gateway.tenderly.co`（1,000 块上限）· RH `rpc.mainnet.chain.robinhood.com`（24k 块，免密钥）。实测 22+18 calls / 0 retries [source: logs/2026-10-22#onchain-monitor]
- 一律带 `address` + `topics`；失败减半重试，429 退避 1s→2s→4s（≤3 次）。**并发 ≤3**（9 路并发曾触发 104 次 429）。
- `eth_getTransactionByHash`/`Receipt` 在 RH 公共 RPC 可用（拆多跳 tx 靠它）；`secretcurl` 只认 `*_API_KEY`，RPC env 用 `node` 内读取。

## 预警框架（铁律）
- 通用预警框架见 `memory/alert-framework.md`，做链上预警前先读
- 用相对量（相对成本线 / 池子 / 日成交量），不用绝对美元阈值
- 优先级：解锁 > 流动性 > 价格结构 > 筹码 > 协议事件
- 推送分级：P0 立即、P1 汇总
- 每条预警必须带：币、数值、命中的规则、下一步动作
