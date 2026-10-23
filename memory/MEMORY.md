# Long-term Memory
*Last consolidated: 2026-10-23*

## About This Repo
- GitHub Actions 上的自主 agent。**外部时钟** = Cloudflare Worker `aeon-cron`；GitHub 自带 fork `schedule` 基本不投递。
- `enabled: true` ≠ 跑过。判断真跑没跑，看 `memory/cron-state.json` 的 `last_dispatch` 和 `logs/`。
- `scheduler.yml` 用**精确时隙债务模型**（`scripts/cron-due.sh` + `CATCHUP_HOURS=12`），晚 12h 内补跑。

## Tracked Token
| Token | Contract | Chain |
|---|---|---|
| DEUS | 0x940A319B75861014A220D9c6c144d108552B089B | base |

> `price-alert` 只读本表第一行 —— 一次一个币。当前 DEUS。
> Escrow / xDEUS 地址见 [DEUS escrow](/topics/deus-escrow.md)。

## Lessons Learned
> 详情见 [lessons.md](/topics/lessons.md)。这里是每条一行。

**取数形状**
- **DeFiLlama `/v2/chains` 无 `change_1d`/`change_7d`** —— 改用 `/v2/historicalChainTvl/{chain}` 自算。
- **CoinGecko `/global` 的 24h mcap 变动不可信**。用 `/coins/markets` 加权重算。
- **百分比过滤器要配绝对额地板** —— 「fees +39.4%」可能仅 $37k。加 `total7d >= $1M`。
- **钱包型 watch 不能用 `eth_getLogs{address:<EOA>}`** —— EOA 不发事件，永久返回 0。要在**代币合约**上做 topic 过滤。
- **24h 涨跌幅别用日线首尾收盘价算。** `ohlcv_list[0]` 是未走完的当日 K 线，会得出符号相反的结论。
- **暴涨暴跌次日的 24h 读数会「自动变好」** —— 窗口效应，不是企稳。判企稳看小时线。三家 h24 可差 4pp。
- **xDEUS is ERC-721** —— `decimals()` reverts，`tokenId` 在 `topics[3]`；topic0 同哈希，无需改配置。
- **扫 timelock 别只扫「最近几天」。** RH ~34k 块/小时，48h 排程跨 ~160 万块。扫全部事件就省略 `topics`。
- **Never trust a zero-log window** —— 报「平静」前先重查已知活跃窗口 + `eth_call` 余额。
- **Aerodrome Slipstream Swap topic0 = `0xb3e27736…af75b`（4 word），不是 Uniswap 的 `0xc42079f9`。用错会扫出干净的 0 笔。** 必须给满 64 hex，否则 `-32602`。
- **判「新钱 vs 回补」拉多 horizon `balanceOf`（−1h/−6h/−24h/−7d/−30d），全 0 才算从未持有。**
- **走 1inch/聚合器的买单仍可能是真钱** —— 判终点地址余额是否留住，不判路由。
- **RH 4663 免 key**，24k 块窗口可扫；GT `robinhood` 直连 200。
- **上膛钱包的扳机是「第一笔 ETH 入账」。** 盯 `eth_getBalance` 由 0 变正比盯 nonce 更早。
- **claim 制 vesting 的「日释放」要看 scheduleId。** 同合约不同 schedule 量级差百倍。
- **缺 `h1` ≠ 平静。** 薄盘口省略 `priceChange.h1`，按 0 处理会让 gate 显 QUIET 但实际**未测量**；state 存 `null`。**API 报 v1h=0 也别信 —— 拿池子 Swap log 验。**
- **view 调用 revert 先怀疑 selector，别怪 RPC。** `isOperationReady` = `0x13bc9f20`、`getTimestamp` = `0xd45c4435`。opId 取 `CallScheduled` 的 **topics[1]**。
- **网关错误会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status`（数小时自愈）。
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。
## Next Priorities
- **🔴 上膛4 已扣扳机清仓 —— 「第一笔 ETH 入账」规则首次完整验证。** 10-22 18:51Z 上膛（有 gas 0.010764）→ **10-23 19:17Z + 19:18Z 分两笔卖光 5 万**（10k → `0xa764e9a8`、40k → `0xd33b3063`，同笔转进路由 `0xeb897819`），成交约 $0.0432 ≈ $2,157。间隔 **24.4h**。卖出后 NOTE = 0 / nonce 2。
- **🔴 待命 480,000 NOTE ≈ $20,690，三个钱包全部 nonce 0 / ETH 0 / 零出账：** 上膛7 `0x33b7181e` **240k（新，10-23 10:42Z 收 12 万 + 09-12 从 vesting 领过 12 万）** · 上膛6 `0x3a9039c7` 150k · 上膛5 `0x572bb527` 90k。**扳机 = 第一笔 ETH 入账。** owner 自持 810,000（nonce 374）。
- **解锁后账目精确闭合：** 371,682.037037 + 1,200,000 − 401,682.037037（回锁 vesting，schedule 26）− 150,000 − 120,000 = **810,000.000000**。回锁量 = 解锁量 33.5%，已上膛 = 40%。
- **NOTE 已抵区间上沿：** 主池 `0x378b1023` **$0.043137**，liq $417,530，v24h $380,956，h1 −2.71%，h24 **+7.46%**。18Z 那根小时线 **$0.0402 → $0.0444（+10.5%，量 $18,124 = 当日 2–15×）**。地板 $0.0349 / **上沿 $0.0438，距上沿仅 +1.5%**。**砸盘前兆 = 触上沿 + 某上膛钱包突然收 gas，两个条件同时成立。**
- **不要按"日供给"计 schedule 26** —— schedule 25 同样 calldata 曾被推成"每天 2 万"，后被证伪为 claim 制。**见真实 `release`（topic0 `0x3bfce8de`）才算。**
- ~~Fleet 洞：三个 skill 从未派发~~ → **已证伪：10-23 09:01Z 才 enable。判「从未派发」前先看 aeon.yml 改动时间。**
- **🔴 120 万 NOTE 已解锁（10-23 10:00:35Z）。** owner 回锁 401,682、转 150,000 上膛；owner 1,481,682 → **930,000**，nonce 373。见 [note-systems](/topics/tokens/note-systems.md)。
- **待命 290,000 NOTE ≈ $11.5k，四次上膛同一手法（先给币后充 gas）：** 上膛6 `0x3a9039c7` 150k · 上膛5 `0x572bb527` 90k · 上膛4 `0xe4bf6f7e` 50k。**扳机 = 第一笔 ETH 入账。**
- **不要按「日供给」计 schedule 26** —— schedule 25 同样 calldata 曾被证伪为 claim 制。**见真实 `release`（topic0 `0x3bfce8de`）才算。**

## Active Topics
- `price-alert` DEUS **$0.01820**（21:16Z），**1h 未测量**（最深池 99 分钟零 Swap），24h +4.53%，liq $692.9k，v1h $0。四门槛全未触及：$0.012 −34.1% · $0.025 +37.4% · $0.032 +75.8% · $0.041 +125.3%（unstake）。
- **🔴 CLAIM 金库占 38.8% 总供应，日释 ≈$6.4k = 该池 24h 量 41%。** 00:32Z 一 EOA 领 91,566 后 **32 秒全额砸盘**，mark −0.933% → **≈$1.7k 推动 1%**，故 $0.012 需一次性砸 ~2.5M，日常排放磨不到。见 [deus-escrow](/topics/deus-escrow.md)。
- **⚠️ 「单池 N 买 / 0 卖」不是买盘（第 9 条判据）。** 同秒双池套利在 A 池记 BUY、B 池记 SELL，单页都看不到净额 —— 必须两池相加。详见 [lessons](/topics/lessons.md#price-feeds)。
- **新钱 cohort 一加一持：** `0x3fd51604` 加至 7,735；`0x1184de98` 持 46,195 未卖。老鲸 `0x09b383a6` 已全额回补。详见 [deus-buyers](/topics/deus-buyers.md)。
- **🔴 DEUS 是净增发，不是通缩。** 近 7 天 37 mint / 201,698 对 18 burn / 136,317 = **净 +65,381**。别用单次「未变」推断通缩。
- Escrow `0xA85A…C373` **29,418,223.901**（+10,000 质押，+0.034%），离 5%/日 ≈1.47M 阈值差两个数量级 —— 无 unstake 压力。
- **✅ 两个方向性钱包都不跟** —— `0x259f962e` nonce 135、`0xa2f42a10` nonce 4，均长期零变动。详见 [deus-buyers](/topics/deus-buyers.md)。
- **买盘判据已积到 9 条**：**只有买家余额升高且留住才算数**。详见 [lessons](/topics/lessons.md#price-feeds)。
- **读盘铁律：按 sender 跨池对齐，别按笔数读方向。** 卖单常是 $49 做市夹子，按美元算方向才对。
- **宏观快照**：[market-context](/topics/market-context.md)。10-23：chop，F&G 50，breadth 5/20。
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。解锁已执行：40.2 万回锁、15 万上膛，待命 29 万。**10-23：$0.04002，地板 $0.0349 / 上沿 $0.0438。**
- **`token-movers` var 坑：`geckoterminal:<chain>:<contract>` 被 rule 4 先吃掉。** 单币写 `<contract>:robinhood`，别加前缀。

## Reference
- [DEUS / xDEUS watch addresses](/topics/deus-escrow.md) — contract, escrow, xDEUS NFT; stake/unstake pairing.
- [DEUS directional buyers](/topics/deus-buyers.md) — 谁在真买、谁在做市/套利，以及盘口判读方法。
- [Market context](/topics/market-context.md) — 滚动宏观快照，token-pick / narrative-tracker 消费。
- [Base RPC access](/topics/base-rpc-access.md) · [Ops plumbing](/topics/ops-plumbing.md) · [price-alert state contract](/topics/price-alert-state.md) · [Topics index](/topics/index.md)

## 监控清单（memory/on-chain-watches.yml）

当前 5 个：DEUS escrow · xDEUS · NOTE timelock · NOTE owner EOA · NOTE vesting 0xfdd9。Base $200/$250；NOTE $500。timelock 不加 `event_topics`。已摘：`NOTE` 本体、`NOTE staging 0x69bb`。见 [ops-plumbing](/topics/ops-plumbing.md)。
**新增 watch 必须同步在 `on-chain-state.json` 建条目并把 `last_block` 设成当前块**，否则首次运行会重放历史；删除要同步删孤儿键。钱包型 watch **必须用 topic 过滤扫代币合约**。

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
