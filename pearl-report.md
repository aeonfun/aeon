## Pearl (PRL) — 为什么这么火

**一句话：** 一个用 GPU 做矩阵乘法挖矿的比特币分叉链，被安上了"AI 的比特币"叙事，然后在 Coinbase 上币路线图公布的 48 小时内被点着了。市值 $8.6 亿（#84），30 天 +158%，现价 $2.44 **正好在历史新高**。

⚠️ **先避坑：** 叫 PRL / PEARL 的至少有四个不同项目。要分析的这个是 **Pearl Research Labs** 的 L1（CoinGecko id `pearl-2`，官网 pearlresearch.ai）。另外还有 Perle（Solana）、Oyster Pearl（老 ERC-20）、以及 Base 上一堆叫 "Pearl Research" 的貔貅盘（`0xed55c0…`、`0xe7c25c…`，市值两三万美元）。**这条链是独立 L1，没有合约地址可买** —— 只能在交易所买。

## 三层催化剂，按重要性排

1. **Coinbase 上币路线图（10-19）** —— 真正的点火器。Coinbase Assets 官宣把 AXIS、PEARL、STABLE 加进 roadmap。注意：**roadmap ≠ 上币**，官方措辞是"取决于做市支持和技术就绪"，没有日期。市场把"可能上币"直接当成"已经上币"在定价。之后 12 天涨的钱基本是这一条。
2. **AI 叙事** —— "Bitcoin for AI"。名人背书（Ansem 等）把它讲成了 AI 算力资产，吃到了整个 AI-infra 板块的溢出资金。
3. **上了 NVIDIA Inception + Together AI 合作** —— 唯一有真实商业对照的一条，但见下面硬伤 2。

## 机制上真实的部分

- 主网 2026-04-27 上线，fork 自 btcd（Go 版比特币），保留最长链规则和 UTXO 模型。
- 挖矿跑的是矩阵乘法而不是 SHA-256，理论依据是 Komargodski & Weinstein 2025 的论文。
- **没有预挖、没有团队份额、没有投资人额度、没有 vesting** —— 2.1B 全部由 PoW 产出，创世补贴为 0。这在当下的新币里是罕见的干净结构，也是多头最硬的一条论据。

## 三个硬伤（都有数）

**1. 通胀吃掉叙事。** 当前区块奖励 ~2,236 PRL，日产 **109–121 万 PRL ≈ 每天 $265–296 万的新增抛压**。24 小时成交量只有 $1,454 万 —— **矿工每天要卖掉相当于日成交量 18–20% 的东西**。按当前节奏年化产出 ~4.2 亿枚，是现有流通量（3.53 亿）的 **1.19 倍**。流通量一年翻倍，价格必须持续有新钱接。

**2. "有用功"很可能不有用。** 2026-06 的预印本（arXiv 2606.04819，审稿中）实测 8,012 个矿池 worker，**在主流挖矿软件里找不到任何 inference 代码**；Pearl 自己的参考实现 `mine()` 用 `rng.random_range(-64..64)` 生成随机矩阵，和任何模型无关。结论：矿工跑随机矩阵乘法和跑真实推理，收益完全一样。Together AI 那个 25% 折扣，官方自己说的是"由未来 PRL 排放的价值来补贴" —— 也就是说，**折扣的钱来自通胀，不是来自节省的算力成本**。

**3. 筹码极度集中在一次意外里。** 难度起步是 1，区块时间实际跑到 13 秒（目标 194 秒）。**前 40,000 个区块在 5.9 天内出完，挖出 1.217 亿 PRL —— 占今天流通量的 34.5%**，每一枚都按最高档位的补贴发放。这批币的成本接近零。按现价算，那是 **$2.97 亿的浮盈**，随时可以倒给追高的人。

## 流动性：这是最该警惕的地方

| 交易所 | 24h 成交 | 占比 |
|---|---|---|
| SafeTrade | $9.88M | 68% |
| BigONE | $5.61M | 39% |
| Ourbit | $2.47M | 17% |

**没有一个一线所。** 68% 的量在一个二线所。Coinbase 真上币是利好，但在那之前，$1,450 万的日成交量撑不起 $8.6 亿的市值 —— 换手率 1.7%，稍微大一点的单子就能砸穿盘口。

## 结论

火的不是技术，是**"Coinbase 路线图 + AI 叙事 + 无预挖的干净结构"三件事同时发生**，落在一个流通量只有 16.8%、日成交 $1,450 万的小盘子上。24 小时涨 23% 到历史新高，这种位置追进去，你买的是别人的退出流动性。

**这是典型的"叙事定价、供给砸盘"结构：** FDV $51 亿 vs 市值 $8.6 亿，中间 6 倍是矿工未来要卖给你的币。真要参与，等的不是突破，是**上线 Coinbase 消息落地的当天**——历史上那条曲线几乎总是"confirm 即顶"。

如果要我继续盯，我会挂三个观察点：Coinbase 正式开交易公告、日均排放随难度上升的衰减速度、以及 SafeTrade 单所成交量占比是否下降（占比降 = 流动性真的在变好）。

## 来源

- CoinGecko `pearl-2` 实时行情（2026-10-21 抓取）：https://www.coingecko.com/en/coins/pearl-2
- Coinbase Assets 路线图公告（2026-10-19）：https://x.com/CoinbaseAssets/status/2112267624289620129
- arXiv 2606.04819《The Usefulness Gap in Proof-of-Useful-Work》：https://arxiv.org/html/2606.04819v1
- Kryptex 矿池 PRL 排放数据：https://pool.kryptex.com/prl/about-coin
- Phemex《Pearl 40,000 Blocks》: https://phemex.com/academy/what-is-pearl-prl-ai-mining-coin
- Datawallet 代币经济学解析：https://www.datawallet.com/crypto/pearl-explained
- Hashrate Index 机制拆解：https://hashrateindex.com/blog/pearl-prl-ai-compute-cryptocurrency/
