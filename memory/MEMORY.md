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
- **DeFiLlama `/v2/chains` 无 `change_1d`/`change_7d`** —— 链级涨跌改用 `/v2/historicalChainTvl/{chain}` 自算。
- **CoinGecko `/global` 的 24h mcap 变动不可信**（报 −3.83%，top-20 反推 −0.07%）。用 `/coins/markets` 加权重算。
- **百分比过滤器要配绝对额地板** —— 「fees +39.4%」可能仅 $37k。加 `total7d >= $1M`。
- **钱包型 watch 不能用 `eth_getLogs{address:<EOA>}`** —— EOA 不发事件，永久返回 0。要在**代币合约**上做 topic 过滤：`[Transfer, null, padded(wallet)]` 收、`[Transfer, padded(wallet)]` 发。
- **24h 涨跌幅别用日线首尾收盘价算。** `ohlcv_list[0]` 是未走完的当日 K 线，会得出符号相反的结论（10-23 算成 +2.0%，实际 −10.5%）。用厂商 rolling 24h 交叉验证。
- **暴跌次日的 24h 读数会自动"变好"，那是窗口效应不是企稳。** 判企稳看小时线：下影线有没有被买回、跌后几小时窄带与量能。三家 h24 可差 4pp（GT −4.35% / DS −2.06% / CG +0.005%）。
- **xDEUS is ERC-721** —— `decimals()` reverts，`tokenId` 在 `topics[3]`；topic0 同哈希，无需改配置。
- **扫 timelock 别只扫"最近几天"。** RH ~34k 块/小时，48h 排程跨 ~160 万块，锚点从已知排程块往前推。`topics: null` 静默返回空 —— 扫全部事件就省略该字段。
- **Never trust a zero-log window** —— 报"平静"前先重查已知活跃窗口 + `eth_call` 余额。
- **RH 4663 免 key**，24k 块窗口可扫；GT `robinhood` 直连 200。

**判读**
- **上膛钱包的扳机是「第一笔 ETH 入账」。** 没 gas 发不了交易；盯 `eth_getBalance` 由 0 变正比盯 nonce 更早。
- **claim 制 vesting 的"日释放"要看 scheduleId。** 同合约不同 schedule 量级差百倍，按均值估会失真。
- **缺 `h1` ≠ 平静。** 薄盘口常省略 `priceChange.h1`，按 0 处理会让 gate 显 QUIET 但实际**未测量**；state 存 `null`，且要看成交量。
- **view 调用 revert 先怀疑 selector，别怪 RPC。** `isOperationReady` = `0x13bc9f20`、`getTimestamp` = `0xd45c4435`。opId 取 `CallScheduled` 的 **topics[1]**。

**运维**
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。
- **网关错误会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status`（10-21 的 403、10-23 WebSearch 400 均数小时自愈）。

## Next Priorities
- **🔴 120 万 NOTE 已解锁（10-23 10:00:35Z）并开始处置。** owner 10:15:50Z 回锁 401,682 成 schedule 26（≈28.7 天，claim 制），10:25:06Z 转 150,000 到新空钱包上膛。owner 1,481,682 → **930,000**，nonce 373。详见 [note-systems](/topics/tokens/note-systems.md)。
- **待命 290,000 NOTE ≈ $11.5k，四次上膛同一手法（先给币后充 gas）：** 上膛6 `0x3a9039c7` 150k · 上膛5 `0x572bb527` 90k（均无 gas）· 上膛4 `0xe4bf6f7e` 50k（有 gas）。**扳机 = 第一笔 ETH 入账。**
- **不要按"日供给"计 schedule 26。** schedule 25 当年同样 calldata 推算成"每天 2 万"，后被证伪为 claim 制（40h 零领取）。**见真实 `release`（topic0 `0x3bfce8de`）才算。**
- ~~Fleet 洞：token-movers / defi-overview / unlock-monitor 从未派发~~ → **已证伪：三个 10-23 09:01Z 才 enable。判「从未派发」前先看 aeon.yml 改动时间。**

## Active Topics
- `price-alert` success。DEUS **$0.01768**（14:05Z），1h −0.10%，24h −1.41%，流动性 $681,814。**量能塌：v1h $163.38（13:01Z 为 $877.40，−81%），1h tape 0 买/6 卖。** 四门槛全未触及：$0.012 −32.1% · $0.025 +41.4% · $0.032 +81.0% · $0.041 +131.9%（unstake 线）。ATH +288.9%。[logs/2026-10-23#price-alert]
- **11:18Z 之后每一笔「买盘」都是零留仓的双腿套利，不是吸筹。** 14:01:31Z `0x6663f69e` **同一秒**在 USDC 池买 $22.96、VIRTUAL 池卖 $22.44 —— 抹价差。12:54Z / 12:56Z / 14:00Z 同构，五笔买家 `balanceOf(DEUS)` 全为 0。11:18Z $168.87 / 11:21Z $264.40 / 12:51Z $721.17 三笔为 1inch router 扫 4–5 池汇一跳、余额全零。**不动 5 天冷却钟。**
- **`0xa2f42a10`（10:59Z 那笔 $2,022.50 真买盘）仍在仓 113,627.09 DEUS**，11:06Z/12:02Z/13:01Z/14:05Z 四轮读数逐位一致，零出账、零加仓，ETH 0.00004395 / nonce 0x4。**仍无第二个方向性钱包。**
- **读盘铁律：按 sender 跨池对齐，别按单池买卖笔数读方向。** 同一 sender 同秒一池买一池卖 = 套利；余额留没留才是方向。详见 [lessons](/topics/lessons.md)。
- **宏观快照**：[market-context](/topics/market-context.md)。10-23：chop，F&G 68→50，breadth 5/20，TVL $90.4B。
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。解锁已执行：40.2 万回锁、15 万上膛，待命 29 万。**10-23 二次 single-token：CONSOLIDATING $0.04002（24h −2.1% 为窗口效应），vol 3.1×；09Z 砸 $0.03495 被完整买回。地板 $0.0349 / 修复上沿 $0.0438。**
- **`token-movers` var 坑：`geckoterminal:<chain>:<contract>` 被 rule 4 先吃掉。** 单币写 `<contract>:robinhood`，别加前缀。

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing.
- [Market context](/topics/market-context.md) — 滚动宏观快照，token-pick / narrative-tracker 消费。
- [Base RPC access](/topics/base-rpc-access.md) · [Ops plumbing](/topics/ops-plumbing.md) · [price-alert state contract](/topics/price-alert-state.md) · [Topics index](/topics/index.md)

## 监控清单（memory/on-chain-watches.yml）

当前 5 个：DEUS escrow · xDEUS · NOTE timelock · NOTE owner EOA · NOTE vesting 0xfdd9。Base $200/$250；NOTE $500。timelock 不加 `event_topics`。已摘：`NOTE` 本体、`NOTE staging 0x69bb`。见 [ops-plumbing](/topics/ops-plumbing.md)。
**新增 watch 必须同步在 `on-chain-state.json` 建条目并把 `last_block` 设成当前块，否则首次运行会重放历史；删除要同步删孤儿键。**
钱包型 watch **必须用 topic 过滤扫代币合约**。

## 链上取数

- **`$BASE_RPC_URL` / `$RH_RPC_URL` 是 Infura 免费档，`eth_getLogs` 只允许 10 块** —— 判据：错误体含 `Free tier plan` + `10 block range`。**绕过 env 直打公共端点。**
- Base `base.gateway.tenderly.co`（1,000 块）· RH `rpc.mainnet.chain.robinhood.com`（24k 块，免 key）。
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
