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
- **缺 `h1` ≠ 平静。** DexScreener 薄盘口常省略 `priceChange.h1`，按 0 处理会让 sharp-move gate 显示 QUIET 而实际**未测量**；state 存 `null` 以区分。**补测出 0.00% 也要看成交量** —— 0 买 / 1 卖、1h 成交 $0.018 时价格是陈旧标记，不是"走平"。
- **view 调用 revert 先怀疑 selector，别怪 RPC。** `isOperationReady` = `0x13bc9f20`、`getTimestamp` = `0xd45c4435`（查 4byte）。旧的 `0xeba2f7f3` / `0xd45dec21` 未注册 → revert，被误记成"公共 RPC 不支持 view"。用对后 RH RPC 正常，能观测 0→1 翻转。opId 取 `CallScheduled` 的 **topics[1]**。

**运维**
- `./notify` 写**普通 Markdown**，别为 Telegram 手工转义；多行走 `-f file.md`。
- **网关 403 会被误记成 skill 回归。** 判据：`num_turns:1` + 0 tool calls + `api_error_status:403` → 网关问题，不是 skill bug。10-21 的 `hivemindos: 403 All target providers failed` 连杀 7 次 run，数小时自愈。

## Next Priorities
- **🔴 120 万 NOTE 解锁已执行（10-23 10:00:35Z）。** `CallExecuted` tx `0xc1c80d83…3f9b` blk 95,856,036。timelock **15,254,442 → 14,054,442**，owner **281,682 → 1,481,682**，nonce 370。**执行后 8 分钟零转出 —— 真正的观察窗口从这里开始。** ≈$59.1k 可动 = 日量 10.3%。**下次扫描 21:00Z，11 小时盲区。**
- **🔴 第三次上膛：owner 09:50:10Z 转 90,000 NOTE 到全新空钱包（解锁前 7.5 分）。** `0x572bb527…51a93e` EOA、**ETH 0 / nonce 0 / 持 90,000 / 零出账**。**无 gas 就卖不了 —— 扳机是第一笔 ETH 入账。**
- **待命 140,000 NOTE ≈ $5.6k：** 新上膛 90k（无 gas）+ 上膛钱包4 `0xe4bf6f7e` 50k（nonce 0、有 gas）。owner 另有 1,481,682 ≈ $59.1k。
- **Fleet 洞：`token-movers` / `defi-overview` / `unlock-monitor` enabled 有排程，但 cron-state 无条目、logs 无记录 → 从未派发。** 今天这个解锁不在其覆盖内。
- **09:08Z 窗口：owner 当时零动作。** 5 watch 全 ON_CHAIN_OK，零日志窗口均以活跃块 control 验证。**01:39Z 那 10 万已全额卖出，池子吸收住（6h +5.82%）。**
- **vesting schedule 25 受益人 = owner 本人**（非 `0x2807de7a`），剩约 19.8 万可领。**量级不恒定**：7=21,446 · 8=2,937 · 11=2,954 · 18=191,793 · **25=401,682**。别按"每天 2 万"估。

## Active Topics
- `price-alert` success。DEUS $0.01734（09:56Z），1h −0.25%，24h −2.42%。四门槛全未触及。**08:36–08:37Z 死盘被两笔买入打破**（$494 ≈ 24h 量 3.3%），链上核对余额留在买家 → 真吸筹非套利腿。[logs/2026-10-23#price-alert]
- **读盘铁律：按 sender 跨池对齐，别按单池买卖笔数读方向。** 判断吸筹还要看余额留没留（余额在 = 方向性买入；同秒另一池反向 = 套利）。详见 [lessons](/topics/lessons.md)。
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**09:57:36Z 解锁已到期可执行；09:50Z owner 第三次上膛 90k。** 详见 Next Priorities。$0.03991（24h −14.53%）。
- `price-alert` success。DEUS 10:04Z **$0.01734**，24h −2.42%，1h −0.25%（连续第二小时可测），四门槛未触及，`last_alerts.*` 全 null。**昨日"首次真实吸筹"已证伪为单次机会主义下单**：`0x1e70e2fd` 余额仍是 17,635.3151 DEUS，**零追加**。09:49–09:51Z VIRTUAL 池 7 连买 / 0 卖 / $372.59 是**套利腿**：`0xb824534a`（nonce 1,334）同分钟在 USDC 池每 4–10s 卖出，**三买家余额 1 wei / 0 / 0**，全没留仓。旁证：两池价差 +0.98%（当日最阔），溢价池（USDC）才出现卖单 —— 机器人在抹平价差，不是有人在买。距 $0.041 +136.4%、$0.012 −30.8%、ATH +296.5%。**结论：不改变减质押计划，不动 5 天冷却钟。** [logs/2026-10-23#price-alert]
- **读盘铁律：按 sender 跨池对齐，别按单池买卖笔数读方向。** 06:16/06:21 是套利腿；04:26:35Z `0xb9817…e105d72` 两池同砸（≈$136）—— 早盘唯一真实抛压。**新增正例：判断吸筹也要看余额留没留**（余额在 = 方向性买入；同秒另一池反向 = 套利）。详见 [lessons](/topics/lessons.md)。
- [Note Systems (NOTE)](topics/tokens/note-systems.md) — Robinhood 4663。**10-22 owner 复活（18:09–18:51Z 三笔），余额 120,000→371,682，nonce 365→368。** 详见 Next Priorities 的上膛钱包。$0.04059（24h −27.4%），24h 净卖压 +472,236（0.79%），连续第三个净卖窗口。 [source: logs/2026-10-22#onchain-monitor]

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
