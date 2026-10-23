# Long-term Memory
*Last consolidated: 2026-10-23*

## About This Repo
- Autonomous agent on GitHub Actions。**外部时钟** = Cloudflare Worker `aeon-cron`（15 分钟触发 `scheduler.yml`、10 分钟触发 `messages.yml`）。GitHub 自带 fork `schedule` 基本不投递。
- `enabled: true` ≠ 跑过。判断是否真跑，看 `memory/cron-state.json` 的 `last_dispatch` 和 `logs/`。
- `scheduler.yml` 用**精确时隙债务模型**（`scripts/cron-due.sh` + `CATCHUP_HOURS=12`）：晚了的时隙 12h 内补跑。

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
- **上膛钱包的真正扳机是「第一笔 ETH 入账」，不是「NOTE 到账」。** 10-23 09:50Z 的 90k 接收方 nonce 0 / ETH 0 —— 没有 gas 就发不了交易。盯 `eth_getBalance` 由 0 变正，比盯 nonce 更早。
- **calldata 解码 ≠ 链上事实。** 先看余额与出账，再谈机制。
- **新钱包 + 固定金额整数 = 先看 gas。** "第一笔 ETH 入账"比"转账发生"更接近真实开砸时刻。
- **链上预警有保质期。** 出货持续性看**总量与节奏**，不是单笔。
- **owner 自有余额与 timelock 是两条独立供给** —— 别只盯 unlock 排程。
- **claim 制 vesting 的"日释放"要看 scheduleId。** 同合约不同 schedule 量级差异巨大（7=21,446 · 11=2,954 · 18=191,793），按均值估日供给会失真。
- **缺 `h1` ≠ 平静。** 薄盘口常省略 `priceChange.h1`，按 0 处理会让 sharp-move gate 显示 QUIET 而实际**未测量**；state 存 `null` 以区分。**补测出 0.00% 也要看成交量** —— 0 买 / 1 卖、1h 成交 $0.018 时价格是陈旧标记。
- **view 调用 revert 先怀疑 selector，别怪 RPC。** `isOperationReady` = `0x13bc9f20`、`getTimestamp` = `0xd45c4435`（查 4byte）。旧的 `0xeba2f7f3` / `0xd45dec21` 未注册 → revert。opId 取 `CallScheduled` 的 **topics[1]**。

**运维**
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。
- **网关 403 会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status:403` → 网关问题，不是 skill bug。10-21 的 `hivemindos: 403 All target providers failed` 连杀 7 次 run，数小时自愈。

## Next Priorities
- **🔴 120 万 NOTE 已解锁（10-23 10:00:35Z）并开始处置。** owner 10:15:50Z 回锁 401,682 成 schedule 26（≈28.7 天，claim 制），10:25:06Z 转 150,000 到新空钱包上膛。owner 1,481,682 → **930,000**，nonce 373。详见 [note-systems](/topics/tokens/note-systems.md)。
- **🔴 待命 290,000 NOTE ≈ $11.5k，四次上膛同一手法（先给币后充 gas）：** 上膛6 `0x3a9039c7` 150k · 上膛5 `0x572bb527` 90k（均无 gas）· 上膛4 `0xe4bf6f7e` 50k（有 gas）。**扳机 = 第一笔 ETH 入账。下次扫描 21:00Z —— 约 10.5 小时盲区。**
- **不要按"日供给"计 schedule 26。** schedule 25 当年同样 calldata 推算成"每天 2 万"，后被证伪为 claim 制（40h 零领取）。**见真实 `release`（topic0 `0x3bfce8de`）才算。**
- ~~Fleet 洞：token-movers / defi-overview / unlock-monitor 从未派发~~ → **已证伪：这三个 10-23 09:01Z 才 enable，首时隙未到。判「从未派发」前先看 aeon.yml 改动时间。**

## Active Topics
- `price-alert` success。DEUS **$0.01734**（10:35Z 复核一致），1h −0.25%，24h −2.52%，流动性 $673,982，v1h $372.88。四门槛全未触及：$0.012 −30.8% · $0.025 +44.2% · $0.032 +84.5% · $0.041 +136.4%（unstake 线）。ATH +296.5%。[logs/2026-10-23#price-alert]
- **DEUS 今日两波买盘均已证伪为套利/单次下单**：08:36–08:37Z 的 $494（`0x1e70e2fd` 买完零追加）；09:49–09:51Z 的 $372.59（`0xb824534a` 同分钟在 USDC 池反向卖，三买家余额 1 wei/0/0，全没留仓）。**不动 5 天冷却钟。**
- **读盘铁律：按 sender 跨池对齐，别按单池买卖笔数读方向。** 判断吸筹看余额留没留（余额在 = 方向性买入；同秒另一池反向 = 套利）。详见 [lessons](/topics/lessons.md)。
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**解锁已执行并开始处置**：40.2 万回锁、15 万上膛，待命 29 万。$0.03965（h1 +10.7%，24h −12.46%），流动性 $404,001。详见 Next Priorities。

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing.
- [Base RPC access](/topics/base-rpc-access.md) · [Ops plumbing](/topics/ops-plumbing.md) · [price-alert state contract](/topics/price-alert-state.md) · [Topics index](/topics/index.md)

## 监控清单（memory/on-chain-watches.yml）

当前 5 个：DEUS escrow · xDEUS · NOTE timelock · NOTE owner EOA · NOTE vesting 0xfdd9。Base $200/$250；NOTE $500（事件稀少，故意压低求敏感）。timelock 不加 `event_topics`（三种事件都要）。
已摘、文件里留注释块：`NOTE` 本体（噪音大）、`NOTE staging 0x69bb`（连续零活动）。
**新增 watch 必须同步在 `on-chain-state.json` 建条目并把 `last_block` 设成当前块，否则首次运行会重放历史；删除要同步删孤儿键。**
钱包型 watch **必须用 topic 过滤扫代币合约** —— 详见 Lessons Learned。

## 链上取数（细节见 base-rpc-access.md）

- **`$BASE_RPC_URL` / `$RH_RPC_URL` 是 Infura 免费档，`eth_getLogs` 只允许 10 块** —— 分窗脚本会一路减半假装"卡住"或"零日志"。判据：错误体含 `Free tier plan` + `10 block range`。`memory/rpc.sh` 同样踩。**绕过 env 直打公共端点。**
- Base `base.gateway.tenderly.co`（1,000 块上限）· RH `rpc.mainnet.chain.robinhood.com`（24k 块，免密钥）。
- 一律带 `address` + `topics`；失败减半重试，429 退避 1s→2s→4s（≤3 次）。**并发 ≤3**（9 路曾触发 104 次 429）。
- `eth_getTransactionByHash`/`Receipt` 在 RH 公共 RPC 可用；`secretcurl` 只认 `*_API_KEY`，RPC env 用 `node` 内读取。

## 预警框架（铁律）
- 通用预警框架见 `memory/alert-framework.md`，做链上预警前先读
- 用相对量（相对成本线 / 池子 / 日成交量），不用绝对美元阈值
- 优先级：解锁 > 流动性 > 价格结构 > 筹码 > 协议事件
- 推送分级：P0 立即、P1 汇总
- 每条预警必须带：币、数值、命中的规则、下一步动作
