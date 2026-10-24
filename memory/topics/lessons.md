---
title: Lessons learned — archive
description: Detail behind the one-line lessons in MEMORY.md, kept here so MEMORY.md stays an index.
tags:
  - lessons
  - runbook
timestamp: 2026-10-24T00:40:00Z
---

# Lessons learned — archive

MEMORY.md carries the one-line form of each lesson. This file holds the detail.

## NOTE / Robinhood Chain

- **代币合约本身作为 watch 时，`to == watch` 算不出方向。** NOTE 的 watch 地址就是代币合约，所以要按池子判断：`X → PoolManager` 是卖，`PoolManager → X` 是买。按错误逻辑，2026-10-21 14:57Z 那笔 88,744 NOTE 的**买入**会显示成大额流出。多跳路由下同一笔 tx 里 NOTE 会转手 4 次，按"每笔 Transfer"计数会把 1 笔记成 4 笔。详见 [NOTE 笔记](/topics/tokens/note-systems.md)。
- **calldata 解码 ≠ 链上事实。**「30 天线性释放每天 2 万」是从 selector `0x091e7db9` 的 calldata 推出来的；4 小时后 0 笔出账、四个标准 selector 全 revert，证明那只是登记调用。**先看余额与出账，再谈机制。**
- **新钱包 + 固定金额整数 = 先看 gas。** NOTE 团队抛售前会把整数枚转进全新 EOA；该 EOA 无 ETH 时无法卖出，所以"第一笔 ETH 入账"比"转账发生"更接近真实开砸时刻。盯 gas 充值，不要盯转账本身。
- **链上预警有保质期。** 一旦团队把"一次性砸盘"改成"线性释放"，盯转账就失效了 —— 信号还在，但边际价值塌了。判断出货持续性要看**总量与节奏**，不是单笔。
- **owner 自有余额与 timelock 是两条独立供给。** 别只盯 unlock 排程：NOTE owner EOA 不等 10-23 解锁就自行转出了 24 万。
- **Robinhood Chain (4663) 不需要 key。** `rpc.mainnet.chain.robinhood.com` 免密钥即可 `eth_getLogs` 宽区间；GeckoTerminal (`networks/robinhood`) 和 CoinGecko 都能报价。别浪费回合找端点。
- **监控盲区：Path C 只读 ERC-20 logs，看不到 native ETH。** Robinhood 无 key 时 `onchain-monitor` 走 Path C，因此"staging 钱包被充 gas"这类触发器永远不会响，需要额外跑 `eth_getBalance` 轮询。

## 行情取数形状（DeFiLlama / CoinGecko）

- **DeFiLlama `/v2/chains` 已不再返回 `change_1d` / `change_7d`。** 2026-10-23 实测 421 条记录里 0 条带这两个字段。任何"直接取字段"的代码都会给每条链算出 `0.00%` 并显示成"全部持平"——一个静默的假阴性。链级涨跌要走 `/v2/historicalChainTvl/{chain}` 自己按日快照算。
- **CoinGecko `/global` 的 `market_cap_change_percentage_24h_usd` 不可信。** 2026-10-23 该字段报 −3.83%，而用同一批 `/coins/markets` 前 20 名反推只有 −0.07%，且 BTC/ETH/SOL 24h 全在 ±0.15% 内（Coinbase 现货交叉验证 $81,582 vs CoinGecko $81,634）。要用总市值变动就用 top-N 加权重算，别引用这个聚合字段。
- **链级 TVL 跳变先怀疑"上新"，别当净流入。** Hyperliquid L1 的 7d 显示 +122%，实际是 10-21 单日 chainTVL 从 $1.02B 阶跃到 $2.49B（协议收录变化），而 Hyperliquid Bridge *协议本身* 7d 是 −0.17%。任何链级异动都要下钻到协议级 `chainTvls` 才会发现。
- **百分比过滤器必须配绝对额地板。** 「fees 7d 涨 >20% 且 TVL 7d <+5%」这条筛出了 Aave V2（+39.4%）——其 7d 手续费总额只有 **$37,212**。纯百分比会把灰尘当信号。加 `total7d >= $1M`。
- **APY 高不代表可投。** Uniswap V3 的 USDC-WETH 池 `apyBase` 22% 过了所有"real yield"过滤（无 reward、非 outlier、置信度 3），但那是做市 LP 的手续费，不是无风险利率。报告里必须标"LP, not passive"，否则下游会把它当稳定币收益。

## Keyless Base reads

- **Keys are unset in this repo's runs** (`ALCHEMY_`, `ETHERSCAN_`, `COINGECKO_API_KEY`). Keyless Base reads work only via Tenderly's public gateway, capped at 1,000 blocks per `eth_getLogs` — and 20,000 results, so always pass an `address` filter. See [Base RPC access](/topics/base-rpc-access.md).
- **Never trust a zero-log window.** Re-query a window with known activity and check the escrow balance via `eth_call`; only then is "quiet" real.
- **`balanceOf` 的 calldata 要把地址**左**补零，右补零会静默返回 0。** 2026-10-23 14:05Z 的 price-alert 里，我用 `"0x70a08231" + addr.slice(2).padStart(64,"0")` 拼参数，结果地址落在低位、高 24 位补零，`eth_call` 不报错、直接返回 `0x0` —— 差点把「真买家仍持 113,627 DEUS」写成「已清仓」。正确形状：selector `0x70a08231` + **24 个 hex 零** + 40 位地址，合计 74 个 hex 字符（`data.length === 74`）。**凡余额为 0，先用一个已知非零地址做对照再下结论。**
- **公共 RPC 的 429 会以「空结果」返回，被 `.catch()` 静默吞成「无活动」。** 2026-10-23 10:35Z 扫 NOTE owner 交易，连续几次得到 `found: []` 并据此判「窗口内无 owner 交易」；实际是 `{code:429, message:"Rate Limit Hit"}`，`Promise.all` 把它当空数组收了。改用**单笔 topic 过滤 + 2s 退避重试**才拿到真实的 2 笔出账。**判据：只要结果是「零」，先看重试计数与 HTTP 体，别把限流读成静默。**
- **`mainnet.base.org` 会把合法的 `balanceOf` 整批 revert，几分钟后自愈 —— revert ≠ 余额 0，也 ≠ 合约问题。** 2026-10-23 18:03Z 五个不同的合法 `balanceOf` 同时 revert，换 `base.gateway.tenderly.co` 立刻返回正确值。**换端点复核，别改代码找 bug。**
- **`eth_getLogs` 的 topic0 必须给满 64 hex。** 只传 4 字节选择器（`0xb3e27736`）在 Tenderly 上返回 `-32602 invalid params`，更糟的情况是**返回干净的 0 笔**，与死池无法区分。完整哈希 `0xb3e2773606abfd36b5bd91394b3a54d1398336c65005baf7bf7a05efeffaf75b`。
- **扫描脚本要在扫描阶段就落盘或分批输出。** 2026-10-23 21:24Z 的 `trace.js` 先枚举完 5 地址 × 双方向 × 24k 窗的 `eth_getBlockByNumber` 才回填时间戳，10 分钟被后台杀掉、零输出 —— 一次全白跑。**边扫边写，别等全部枚举完再算元数据。**

## Watch configuration

- **钱包型 watch 不能用 `eth_getLogs{address: <EOA>}`。** EOA 不发事件，该写法永久返回 0 —— owner EOA / staging / vesting / DEUS escrow 四个 watch 曾长期处于假零。正确形状是在**代币合约**上做 topic 过滤：`[Transfer, null, padded(wallet)]` 收、`[Transfer, padded(wallet)]` 发。
- **xDEUS is ERC-721, not ERC-20** — `decimals()` reverts, `Transfer` carries `tokenId` in `topics[3]`. The ERC-20 topic0 hash still matches, so watch config needs no change.

## 扫 timelock：窗口与 topics 两个坑

1. **窗口别从"最近几天"往回数。** Robinhood 链实测约 34k 块/小时，48h 的排程跨度约 160 万块。2026-10-22 用 `from=94700000` 起扫，完全漏掉 blk 94195015 的 `CallScheduled`，结论一度变成"120 万解锁不存在/已撤销"。正确做法是从**已知排程块**往前推，而不是从当前块往回数。
2. **`eth_getLogs` 不要传 `topics: null`。** 部分节点会返回空数组而不报错，静默变成"没有事件"。要扫全部事件就**省略 topics 字段**，而不是显式传 null。

误判代价很高：这两条任何一条踩中，都会把"明天有 120 万解锁"读成"没有风险"。

## Price feeds

- **缺 `h1` ≠ 平静。** DexScreener 对薄盘口常省略 `priceChange.h1`；skill 按 0 处理，于是 sharp-move gate 显示 QUIET 而实际是**未测量**。state 里存 `null` 而非 0，下一轮才能区分"测过且平"与"没测到"。
- **DS 缺 h1 时用 GeckoTerminal 同 pair 补测，别默认 0。** 端点 `/networks/base/pools/0x3e97…c1fa`，DS 和 GT 价格、流动性一致到 5 位小数。补测后 state 里记 `h1_source: "geckoterminal"` 和 `h1_note`，下一轮才知道这个数是替代来源。
- **两源 h24 有 0.8–1.6pp 系统性分歧，h6 甚至会反号。** 21:01Z 差 1.55pp、22:02Z 0.83pp、23:01Z 1.09pp，而同一时刻价格完全一致。属 24h 窗口锚点（开盘时点）差异，不是坏数据 —— **把 h24 当近似值，不要当精确值引用。**
- **成交量为零时，"走平"是机械的，不是平静的。** 23:01Z 深池 1h 成交 $0.018 / 1 笔（0 买 1 卖），价格必然显示 0.00% —— 此时该读的是成交额塌陷本身（$276.66 → $5.46 → $0.018），不是百分比。
- **单池的 txns.h1 买卖计数不能读成资金流，必须跨池对齐 `sender + 时间戳`。** 10-23 08:01Z 把 DEUS 两个池的逐笔成交按 `tx_from_address` 对齐，三个时刻全部是**同一个地址在两边动作**，不是多路资金：①04:26:35Z `0xb9817…e105d72` 在 VIRTUAL 池**卖** $31.46、在 USDC 池也**卖** $104.81（同一人两边砸，共 ~$136）；②06:16:53Z `0x6664f…855154`、③06:21:39Z `0x66608…f285bf` 各在 VIRTUAL 池**卖**、USDC 池**买**（同价反向 = 自套利/路由，不是看空）。**教训：只看一个池的 0买/N卖 会读成"有人在抛"，实际可能是同一个人的套利腿。判断方向要按 sender 聚合，不是按单池笔数。** 也解释了此前两池 h1 反复反号（见上条）。
- **买入同理：确认方向性吸筹要查"余额留没留"，不是看成交方向。** 10-23 08:37:53Z `0x1e70e2fd`（**nonce 1 = 该钱包首笔交易**）在 VIRTUAL 池买 $305.97 / 17,635.31 DEUS @ $0.017350。拉 receipt `0x356d58c8…` 解 Transfer：468.632 VIRTUAL 从 Uniswap v4 池 `0xc200f21e` → 路由器 `0x67d03631` → 池 `0x3e97`，DEUS 出池直接进买家。再 `balanceOf` 查买家 = **17,635.32 DEUS 全留**，且该 sender 在 USDC 池无反向卖单 → **真吸筹**。反例是 06:16/06:21 那种同秒两池反向、余额不留的套利腿。**判据：`buy` + 余额留存 = 方向性建仓；`buy` + 他池同秒卖 = 套利。** 金额也要折算：$306 仅 24h 量的 2.05%，价格影响 <1bp —— 信号意义在"首次非套利买盘"，不在体量。
- **"连续 N 笔买入、0 卖"是套利腿的典型外观，不是吸筹证据。** 10-23 09:49:03–09:51:47Z VIRTUAL 池 7 连买 / 0 卖 / $372.59，看着像扫货；`balanceOf` 三个买家全是 **1 wei、0、0** —— `0xb824534a`（**nonce 1,334**，不是新钱包）同分钟在 USDC 池 0x58dBa 每 4–10 秒卖出，**余额归零 = 原地套利**。**一轮 `balanceOf` 就能定性，比解 receipt 便宜，先查余额再谈方向。** 旁证是跨池价差：当时 VIRTUAL $0.01734 vs USDC $0.01751（**+0.98%**，当日最阔），价差那侧（USDC 池）才是出现卖单的池 —— **溢价池记卖、折价池记买 = 机器人在抹平价差，不是有人在买。**
- **单次吸筹不等于趋势，第二天要复核它有没有继续加仓。** 08:37Z 的 `0x1e70e2fd` 隔一小时余额仍是最初那 17,635.3151 DEUS，**零追加** —— 一次性机会主义下单，不是买方波。**"首次非套利买盘"值得记一笔，但在它加第二笔之前不要升级成"吸筹趋势"，更不能据此谈减质押。**
- **同块扫多个池、汇进同一跳、再转给共享 sink = 聚合器/套利，不是吸筹。** 10-23 11:18:51Z $168.87 与 11:21:03Z $264.40 两笔"买盘"看着是量能延续，receipt 一解全露馅：tx `0xd49559c1` / `0x17682c97` 各在**同一块内从五个池**（0x58dba / 0x1b2f3f5c / 0x498581ff / 0x75bc1495 / 0x3e97c5ec）凑量，汇进中间跳（`0x939e398d` / `0x7d683941`），再整笔 3.2 万 / 3.1 万 DEUS 转给**同一个** sink `0xfea20e68`，且 **sink 与全部中间跳的 DEUS 余额都是 0**。**判据升级：方向性买家只从一条路径取货、且收货地址余额留得住；一单跨 4–5 个场所还倒给共享地址，是在做路由不是在建仓。** 看到"买盘延续"先 balanceOf 收款方，比解 receipt 便宜。
- **成交量要跟买盘一起读。** 同一轮 v1h 从 $2,011.67 掉到 $612.58、v24h 由 $16,900 到 $16,610 —— **$2k 大单之后量在衰减**，说明那单没引来跟风。价格几乎没动（+0.06%）而量塌了，是"单笔冲击 → 无人接力"的典型形状，不是启动。
- **`eth_getCode` 以 `0xef0100` 开头 = EIP-7702 委托智能账户，不是普通 EOA。** 10-23 14:55Z 的 `0x259f962e…`（5 笔买 $4,564、余额全留）返回 `0xef0100` + `0x63c0c19a282a1b52b07dd5a65b58948a07dae32b`，delegate 是暴露 `0x84b0196e`/`0xd03c7914`/`0xd691c964`/`0xf23a6e61`/`0xffa1ad74` 的智能账户实现。配合 nonce 135 + 0.819 ETH，这是**有历史的成熟钱包新近转向**，不是新充值的小号。**分类时把 `eth_getCode` 编进判据：空返回 = EOA；`0xef0100…` = 7702 智能账户**（"fresh EOA 留仓"的说法会低估它）。
- **薄盘口上，买卖"笔数"会给出与"美元额"相反的方向结论。** 10-23 15:05Z 1h 是 **4 买 / 18 卖**，看着像在派发；但 14:50Z 起按美元是 **买 $4,326 / 卖 $1,245 = 74/26**。原因：卖单全是做市夹子 —— `0x9694…`（nonce 0x394c）12 笔每笔 ~$49、**卖完仍持 19,360.79 DEUS**；`0x6abe…`（nonce 257,965）每笔 $78–194、余额 0。**读向先换算美元额，再看笔数。**
- **`eth_getLogs` 在公共 Tenderly 端点上限 1000 块，且区间超一块就整单报错、不截断。** 要算 `latest-999 .. latest`；猜 `latest-1000` 会得到 `Block range too large for public access: maximum 1000 blocks`。同一条链上同一次运行里这个上限是硬性的，别试第二次。
- **🔴 Aerodrome Slipstream 的 Swap topic0 是 `0xb3e27736`，不是 Uniswap V3 的 `0xc42079f9`；且 data 只有 4 个 word，不是 5 个。** 10-23 19:09Z 我用 `0xc42079f9` 扫最深池 `0x3E97…` 最近 2100 块，得到**干净的 0 笔 swap**，几乎据此写下"池子死了"，但 DexScreener 同池 v1h 报 $860。真因：Slipstream 池的 Swap 用另一套签名，`0xc42079f9` 那个 topic 在这个池上**根本不存在**。**判据（第三次踩「零日志」）：当厂商报价显示有量、而链上扫出 0 笔 swap 时，先对一个已知活跃块 `dump 全部 log`（不传 topics）看真实 topic0 集合，再决定信不信这个 0。** 正确解码：Slipstream Swap data = `amount0, amount1(带符号), sqrtPriceX96, liquidity` —— 4 个 word；DEUS 在这三个池里都是 token1。
- **判「是不是新钱」要拉多 horizon 余额，只回看 24h 会把建仓误判成回补、只看单笔方向会把回补误判成建仓。** 10-23 19:09Z 两笔买入（$838 + $95）的收款方 `0x1184de98` / `0x3fd5`，在 −1h / −6h / −24h / −7d / −30d 的 `balanceOf` **全部精确为 0** —— 这是四天来第一批真外部新钱。**方法：`eth_call balanceOf` 打到 `head - {1800, 10800, 43200, 302400, 1296000}` 五个历史块，全 0 才叫「从未持有」。** 对照第 7 条（老鲸回补），两者只看 24h 会得出同一结论，加上 −7d/−30d 才分得开。
- **经 1inch v6（`0x111111125421ca6dc452d289314280a0f8842a65`）或其它聚合器路由的买单，仍然可能是真钱。** 判据不是「有没有走路由」（走路由是常态），而是**终端收款地址的 `balanceOf` 是否升高且留住**。19:09Z 那笔 $95 就是经 1inch 跨三池扫出来的，但终点 `0x3fd5` 余额从 0 变成 5,225 DEUS 并留住 —— 真钱；而 16:41Z 那笔终点余额精确为 0 —— 代客成交。**同一个 router，两种性质，只能靠终点地址的余额分辨。**
- **helper 合约 nonce 1 + 有代码 = 一次性路由/授权合约，不是买家。** 19:09Z 的 $838 买单里，`0x8d8f598c` 与 `0x0a2854fb` 都是 `code 0x60806040…`、nonce 1、余额归零的转账中转站；真正的买家是 tx 的 `from`（`0x1184de98`，nonce 920）。**追买家要追 `eth_getTransactionByHash().from` 与 DEUS 最终落点，别把 helper 当主体。**
- **「单池 N 买 / 0 卖」是第 9 条判据，也是最容易上当的一种外观。** 2026-10-23 19:07–19:37Z DexScreener 报最深池 **37 买 / 0 卖**、GT 同窗 35 笔腿清一色 `buy`（$718.91），看着像一波凶猛买盘。拆回执全是同秒双池套利：发起方是 `0x666…` / `0x6341d948` EOA 簇（nonce 4,459 / 215,435 / 213,982 / 216,683），**全部 `balanceOf` = 0**；DEUS 在同一笔交易里走 最深池 → helper `0xae629bf1` → USDC 池 `0x58dba34e`。**为什么单池页面看不出：一轮「A 池买、B 池卖」在 A 池记纯 BUY、在 B 池记纯 SELL，两边都看不到净额。** 跨池净额才 是方向：VIRTUAL 池 +$718.91 流入，USDC 池 买 $380.35 / 卖 $539.93 = **净卖 $159.58**。**方法：判买盘不看笔数、不看方向列，只看（a）发起方余额是否升高且留住，（b）DEUS 是否停在非「立即转发」的地址上。**
- **第 6 条判据补强：买也可能是「代客成交」。** 2026-10-23 16:41:51Z 出现 $81.52（VIRTUAL 池）+ $249.79（USDC 池）同秒双池扫单，像买盘回归；sender `0x9a3811b1…dfbf` 是 `code 0x` 的普通 EOA、nonce **3,549**、`balanceOf(DEUS)` **精确为 0** —— 聚合器替别人成单后把货转走。**只有买家余额升高且留住才算数，这一条盖过所有 App 上看到的"买"。**
- **第 8 条判据：`0x1184de98` / `0x3fd5` 是四天来第一批真外部新钱**，在 −1h/−6h/−24h/−7d/−30d 余额全 0。次日复核：`0x3fd51604` 19:24:01Z 又买 $45.77（nonce 290→291，余额 5,225 → 7,735），是新钱里第一个回头加仓的；`0x1184de98` 未再动（nonce 920、持 46,195 未卖）。**一加一持，结构偏建设性但量级仍小（$4.6 万）—— 这是"加仓才算数"的正面样本。**[source: logs/2026-10-23#price-alert]

# Citations

- `memory/logs/2026-10-21#onchain-monitor`, `#telegram-reply`, `#heartbeat-brief`, `#price-alert`
- `memory/logs/2026-10-22#price-alert`（21:01Z / 22:02Z / 23:01Z 三源对比）
- `memory/logs/2026-10-23#price-alert`（11:06Z 单笔方向性买盘 → 12:02Z 复核实证两笔跟进买盘为聚合器套利；15:05Z 第二个方向性钱包 `0x259f962e…` + 笔数/美元额反向 + 7702 识别；19:09Z Slipstream topic0 坑 + 多 horizon 余额判新钱 + 1inch 路由终点判据；20:05Z 单池 37 买 / 0 卖 实为同秒双池套利 + 供给口径改为净增发；17:01Z–21:16Z 两个方向性钱包冻结、h1 缺失 ≠ 平静）
- `memory/logs/2026-10-23#onchain-monitor`（21:24Z 上膛4 扣扳机清仓 + 第七个上膛钱包 24 万 + 待命重算 48 万）
- `memory/logs/2026-10-23#heartbeat`（RH 429 返回空结果而非错误；selector `isOperationReady`/`getTimestamp` 修正）
