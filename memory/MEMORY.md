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
- **DeFiLlama `/v2/chains` 不再返回 `change_1d`/`change_7d`** —— 421 条全无。链级涨跌改用 `/v2/historicalChainTvl/{chain}` 自算，否则静默全 `0.00%`。
- **CoinGecko `/global` 的 24h mcap 变动不可信** —— 10-23 报 −3.83%，top-20 反推只有 −0.07%。用 `/coins/markets` 加权重算。
- **链级 TVL 跳变先怀疑上新** —— Hyperliquid L1 +122% 7d 其实是 10-21 chainTVL 阶跃，Bridge 协议本身 −0.17%。要下钻 `chainTvls`。
- **百分比过滤器要配绝对额地板** —— Aave V2「fees +39.4%」7d 手续费仅 $37k。加 `total7d >= $1M`。
- **钱包型 watch 不能用 `eth_getLogs{address:<EOA>}`** —— EOA 不发事件，永久返回 0。正确形状是在**代币合约**上做 topic 过滤：`[Transfer, null, padded(wallet)]` 收、`[Transfer, padded(wallet)]` 发。
- **代币合约作为 watch 地址时，`to == watch` 算不出买卖方向** —— 要看池子：`X → PoolManager` 卖，`PoolManager → X` 买。多跳路由会把一笔记成 4 笔 Transfer，聚合只认最终进/出 PoolManager 那腿。
- **代币合约作为 watch 地址时，`to == watch` 算不出买卖方向** —— 要看池子：`X → PoolManager` 卖，`PoolManager → X` 买。
- **多跳路由把一笔交易记成 4 笔 Transfer** —— 聚合只认最终进/出 PoolManager 的那一腿。
- **24h 涨跌幅别用日线首尾收盘价算。** `ohlcv_list[0]` 是当日未走完的 K 线，拿它比 `[1]` 会得到符号相反的结论（10-23 NOTE 算成 +2.0%，实际 −10.5%）。用厂商 rolling 24h 交叉验证。
- **暴跌次日的 24h 读数会自动"变好"，那是窗口效应不是企稳。** 10-22 NOTE −30.5%，10-23 同一池报 −2.1%，只因主跌段滚出 24h 窗口。**判企稳要看小时线**：下影线有没有被买回、跌后几小时的窄带与量能。三家厂商 h24 可差 4pp（GT −4.35% / DS −2.06% / CG +0.005%），单一数字不可当结论。
- **xDEUS is ERC-721, not ERC-20** —— `decimals()` reverts，`tokenId` 在 `topics[3]`；topic0 哈希相同，无需改配置。
- **扫 timelock 别只扫"最近几天"。** RH 链 ~34k 块/小时，48h 排程跨 ~160 万块；锚点从已知排程块往前推。另 `topics: null` 会静默返回空数组 —— 扫全部事件就省略该字段。
- **Never trust a zero-log window** —— 报"平静"前，先重查一个已知活跃窗口 + `eth_call` 余额。
- **Path C 只读 ERC-20 logs，看不到 native ETH** —— gas 充值类触发器是盲区，需另跑 `eth_getBalance`。
- **RH 4663 完全免 key**，24k 块窗口可扫。**GT `robinhood` 网络可用**（不在 `/networks` 列表，直连 200）；trades feed 只回 300 笔。

**判读**
- **上膛钱包的真正扳机是「第一笔 ETH 入账」，不是「NOTE 到账」。** 没有 gas 就发不了交易；盯 `eth_getBalance` 由 0 变正比盯 nonce 更早。
- **calldata 解码 ≠ 链上事实。** 先看余额与出账，再谈机制。
- **链上预警有保质期。** 出货持续性看**总量与节奏**，不是单笔。
- **owner 自有余额与 timelock 是两条独立供给** —— 别只盯 unlock 排程。
- **claim 制 vesting 的"日释放"要看 scheduleId。** 同合约不同 schedule 量级差百倍（7=21,446 · 11=2,954 · 18=191,793），按均值估会失真。
- **缺 `h1` ≠ 平静。** 薄盘口常省略 `priceChange.h1`，按 0 处理会让 gate 显示 QUIET 但实际**未测量**；state 存 `null`。补测出 0.00% 也要看成交量。
- **view 调用 revert 先怀疑 selector，别怪 RPC。** `isOperationReady` = `0x13bc9f20`、`getTimestamp` = `0xd45c4435`。opId 取 `CallScheduled` 的 **topics[1]**。

**运维**
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。
- **网关错误会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status` → 网关问题，不是 skill bug（10-21 的 403 连杀 7 次 run，数小时自愈；10-23 WebSearch 400 同理）。

## Next Priorities
- **🔴 120 万 NOTE 已解锁（10-23 10:00:35Z）并开始处置。** owner 10:15:50Z 回锁 401,682 成 schedule 26（≈28.7 天，claim 制），10:25:06Z 转 150,000 到新空钱包上膛。owner 1,481,682 → **930,000**，nonce 373。详见 [note-systems](/topics/tokens/note-systems.md)。
- **待命 290,000 NOTE ≈ $11.5k，四次上膛同一手法（先给币后充 gas）：** 上膛6 `0x3a9039c7` 150k · 上膛5 `0x572bb527` 90k（均无 gas）· 上膛4 `0xe4bf6f7e` 50k（有 gas）。**扳机 = 第一笔 ETH 入账。**
- **不要按"日供给"计 schedule 26。** schedule 25 当年同样 calldata 推算成"每天 2 万"，后被证伪为 claim 制（40h 零领取）。**见真实 `release`（topic0 `0x3bfce8de`）才算。**
- ~~Fleet 洞：token-movers / defi-overview / unlock-monitor 从未派发~~ → **已证伪：三个 10-23 09:01Z 才 enable。判「从未派发」前先看 aeon.yml 改动时间。**

## Active Topics
- `price-alert` success。DEUS **$0.01770**（13:01Z），1h +0.34%，24h −1.31%，流动性 $682,140，v1h $877 / v24h $16,653（仍只 ~4% 于 10-22 节奏）。四门槛全未触及：$0.012 −32.2% · $0.025 +41.2% · $0.032 +80.8% · $0.041 +131.6%（unstake 线）。ATH +288.5%。[logs/2026-10-23#price-alert]
- **10:59:19Z 那笔 $2,022.50 是本周唯一真方向性买盘，已 122 分钟零加仓零出货。** 买家 `0xa2f42a10a8eb9089ac51108af68fa202bf2c3130` 余额 113,627.090929296282205709 DEUS 自 11:06Z 起逐位未变，ETH 0.00004395、nonce 0x4（仅一次空转）。之后三笔"买盘"（11:18Z $168.87 / 11:21Z $264.40 / 12:51Z $721.17）**全为聚合器套利**：同笔扫四至五池汇进一跳（1inch router `0x1111111254…2a65`，或转给共享 sink `0xfea20e68`），**全部买家与中间地址余额 0**。**不动 5 天冷却钟。**
- **同段 tape 上的"卖盘"常是同一笔路由的另一腿，不是派发** —— 12:51–12:56Z 两笔卖（`0xfe68082a` / `0x6661014a`）余额同报 0，与买盘同笔。判方向先 `balanceOf` 再谈买卖。
- **DEUS 今日两波买盘均已证伪为套利/单次下单**：08:36–08:37Z 的 $494（`0x1e70e2fd` 买完零追加）；09:49–09:51Z 的 $372.59（`0xb824534a` 同分钟在 USDC 池反向卖，三买家余额 1 wei/0/0，全没留仓）。**不动 5 天冷却钟。**
- **读盘铁律：按 sender 跨池对齐，别按单池买卖笔数读方向。** 判断吸筹看余额留没留（余额在 = 方向性买入；同秒另一池反向 = 套利）。详见 [lessons](/topics/lessons.md)。
- **市场宏观快照**：[market-context](/topics/market-context.md)（每次 defi-overview 刷新）。10-23：chop，F&G 68→50 但 BTC ±0.13%，breadth 5/20，TVL $90.4B（−2.08% 24h）。
- `price-alert` success。DEUS **$0.01763**（11:06Z），1h +1.63%，24h −1.24%，流动性 $680,952。四门槛全未触及：$0.012 −31.9% · $0.025 +41.8% · $0.032 +81.5% · $0.041 +132.6%（unstake 线）。[logs/2026-10-23#price-alert]
- **10:59:19Z 今日第一笔真方向性买盘 $2,022.50**（`0xa2f42a10`，0.84 ETH 换 113,627 DEUS），链上验留仓。仅占池子 0.3%，**不动冷却钟**；看是否加仓/有第二钱包跟单。
- **DEUS 另两波买盘已证伪为套利**：08:36Z $494（`0x1e70e2fd` 买完零追加）· 09:49Z $372.59（同分钟另一池反向卖）。**不动冷却钟。**
- **读盘铁律：按 sender 跨池对齐**，别按单池笔数读方向；看余额留没留。详见 [lessons](/topics/lessons.md)。
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**解锁已执行并开始处置**：40.2 万回锁、15 万上膛，待命 29 万。$0.03965（h1 +10.7%，24h −12.46%），流动性 $404,001。详见 Next Priorities。

## Active Topics
- `price-alert` success。DEUS **$0.01763**（11:06Z），24h −1.24%，流动性 $680,952。四门槛全未触及：$0.012 −31.9% · $0.025 +41.8% · $0.032 +81.5% · $0.041 +132.6%。
- **10:59:19Z 出现今日第一笔真方向性买盘 $2,022.50**（买家 `0xa2f42a10`，nonce 3，0.84 ETH 换 113,627 DEUS）。**链上验证留仓**：余额逐位等于买入量，0 出账 —— 与 08:37/09:49 两波套利不同。但仅占池子 0.3%，**不动 5 天冷却钟**；观察是否加仓或有第二钱包跟单。
- **读盘铁律：按 sender 跨池对齐，别按单池买卖笔数读方向。** 判断吸筹看余额留没留（余额在 = 方向性买入；同秒另一池反向 = 套利）。详见 [lessons](/topics/lessons.md)。
- **DEUS 今日两波买盘均已证伪为套利/单次下单**：08:36Z 的 $494（`0x1e70e2fd` 买完零追加）；09:49Z 的 $372.59（`0xb824534a` 同分钟 USDC 池反向卖，三买家余额≈0）。**不动 5 天冷却钟。**
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。解锁已执行：40.2 万回锁、15 万上膛，待命 29 万。**10-23 二次 single-token：CONSOLIDATING $0.04002，24h −2.1%（窗口效应，主跌段已滚出），vol 3.1×。09Z 砸 $0.03495 被完整买回，四小时锁在 1.8% 窄带。地板 $0.0349 / 修复上沿 $0.0438。**
- **`token-movers` var 坑：`geckoterminal:<chain>:<contract>` 被 rule 4 先吃掉。** 单币写 `<contract>:robinhood`，别加前缀。

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing.
- [Market context](/topics/market-context.md) — 滚动宏观快照，token-pick / narrative-tracker 消费。
- [Base RPC access](/topics/base-rpc-access.md) · [Ops plumbing](/topics/ops-plumbing.md) · [price-alert state contract](/topics/price-alert-state.md) · [Topics index](/topics/index.md)

## 监控清单（memory/on-chain-watches.yml）

当前 5 个：DEUS escrow · xDEUS · NOTE timelock · NOTE owner EOA · NOTE vesting 0xfdd9。Base $200/$250；NOTE $500。timelock 不加 `event_topics`。已摘：`NOTE` 本体（噪音大）、`NOTE staging 0x69bb`。
当前 5 个：DEUS escrow · xDEUS · NOTE timelock · NOTE owner EOA · NOTE vesting 0xfdd9。见 [ops-plumbing](/topics/ops-plumbing.md)。
**新增 watch 必须同步在 `on-chain-state.json` 建条目并把 `last_block` 设成当前块，否则首次运行会重放历史；删除要同步删孤儿键。**
钱包型 watch **必须用 topic 过滤扫代币合约**。

## 链上取数（细节见 base-rpc-access.md）

- **`$BASE_RPC_URL` / `$RH_RPC_URL` 是 Infura 免费档，`eth_getLogs` 只允许 10 块** —— 分窗脚本会减半假装"卡住"。判据：错误体含 `Free tier plan` + `10 block range`。**绕过 env 直打公共端点。**
- Base `base.gateway.tenderly.co`（1,000 块）· RH `rpc.mainnet.chain.robinhood.com`（24k 块，免密钥）。
- 一律带 `address` + `topics`；失败减半重试，429 退避 1s→2s→4s（≤3 次）。**并发 ≤3**。
- `secretcurl` 只认 `*_API_KEY`，RPC env 用 `node` 内读取。

## 预警框架（铁律）
- 通用预警框架见 `memory/alert-framework.md`，做链上预警前先读
- 用相对量（相对成本线 / 池子 / 日成交量），不用绝对美元阈值
- 优先级：解锁 > 流动性 > 价格结构 > 筹码 > 协议事件
- 推送分级：P0 立即、P1 汇总
- 每条预警必须带：币、数值、命中的规则、下一步动作

## 输出语言

**一律简体中文。** 所有 notify、报告、日志正文都用中文写。
代币名、合约地址、协议名、代码、命令保留原文，不翻译。
