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
- **`isOperationPending/Ready/Done` 在公共 RPC 上 revert（`data:0x`），不能当 false 读。** 判 timelock 操作是否还活着要用 `getTimestamp(opId)` + 合约余额双证；opId 取 `CallScheduled` 的 **topics[1]**，不是 calldata 前 32 字节。

**运维**
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。
- **网关 403 会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status:403` → 网关问题，不是 skill bug。10-21 的 `hivemindos: 403 All target providers failed` 连杀 7 次 run，数小时自愈。

## Next Priorities
- **🔴 上膛钱包3 已开砸（10-23 01:39:41Z）。** `0x3ace8e0a` 100,000 NOTE 全额卖出，余额归零，nonce 0→1。4 跳经中转到 **Uniswap v4 PoolManager**（=卖出）。该链进池 105,000；全量流入 1,434,187 ≈$59.2k，约 24h 量 10.7%。**池子吸收住了：6h +5.82%。** [source: logs/2026-10-23#heartbeat]
- **仅剩一把枪：`0xe4bf6f7efc32aad76e80916543d1277dbe8ecf9a`（50,000 NOTE，nonce 仍 0，零出账）。** 同批孪生钱包，第一把打完后它没动。**它出账 = 第二批开砸，盯 nonce 0→1。**
- **10-23 09:57:36Z 的 120 万 NOTE timelock 解锁 —— 09:08Z 复核仍未执行、未撤销。** opId `0x77a7b0d650cf28a45a80db71431d0790605733608d5c3e98508467a66b6974da`，`getTimestamp` = 1792749456 = 09:57:36Z。**`balanceOf(timelock)` = 15,254,442.020047023418334577，与前次逐位一致。** 解锁 ≈ $47.7k ≈ 日量 8.6%（未过 50% 黄线）。**第一波（10 万）已在解锁前 8h 发生，不再是"解锁后才砸"。** [source: logs/2026-10-23#onchain-monitor]
- **09:08Z 全窗口复核：owner EOA 零动作（nonce 368、371,682.037 未动），上膛钱包4 `0xe4bf6f7e` 仍 nonce 0 / 50,000。** 5 个 watch 全部 ON_CHAIN_OK，无事件过阈值 → 未推送。**每个零日志窗口都已用已知活跃块做控制验证**（timelock 94,195,015 → 2 条）。
- **vesting schedule 25 的受益人已更正为 owner 本人**（不是 `0x2807de7a`）。18:33Z owner 自领 401,682.037，schedule 25 剩余约 19.8 万仍可领。`owner()` = owner EOA。**别再把它当"第三方沉睡额度"。**
- **vesting release 量级不是恒定的**：scheduleId 7=21,446 · 8=2,937 · 11=2,954 · 18=191,793 · **25=401,682（10-22 18:33Z，迄今最大）**。不要按"每天 2 万"估日供给。

## Active Topics
- `price-alert` success。DEUS 09:04Z $0.01739，24h −2.08%，四门槛未触及，`last_alerts.*` 全 null。**死盘在 08:36–08:37Z 破了**：两笔买入 96 秒内打两个盘口 —— USDC 池 `0x198a2324`（nonce 2）买 $187.62；VIRTUAL 池 `0x1e70e2fd`（**nonce 1，该钱包首笔交易**）买 $305.97 = 17,635.31 DEUS @ $0.017350。**链上核对 receipt：17,635.32 DEUS 全部留在买家地址，无对冲卖单 → 真吸筹，不是套利腿。** 但 $494 合计仅 ≈24h 量的 3.3%，非触发级。距 $0.041 +135.8%、$0.012 −31.0%、ATH −74.9%。[logs/2026-10-23#price-alert]
- **读盘铁律：按 sender 跨池对齐，别按单池买卖笔数读方向。** 06:16/06:21 是套利腿；04:26:35Z `0xb9817…e105d72` 两池同砸（≈$136）—— 早盘唯一真实抛压。**新增正例：判断吸筹也要看余额留没留**（余额在 = 方向性买入；同秒另一池反向 = 套利）。详见 [lessons](/topics/lessons.md)。
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
