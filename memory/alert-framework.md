# 通用预警框架

适用任何链上代币。核心原则：**用相对量，不用绝对值**——绝对阈值换币就废。

## 五个基准量（每币标定一次）
- cost_basis       成本线
- position_size    持仓（币 + 美元）
- pool_tvl         池子深度
- daily_volume     近 30 日日均成交量
- unlock_schedule  解锁 / 通胀表

## 五类指标（按杀伤力排序）

### 1. 供给 / 解锁  [P0]
公式 unlock_amount ÷ daily_volume；>50% 黄，>100% 红
查：下一笔解锁时间与数量、通胀参数变更

### 2. 流动性 / 深度  [P0]
公式 pool_tvl 变化；pool_tvl ÷ position_size
触发：TVL 单日 -20%；TVL < position_size×5；单笔 swap > pool_tvl 3%

### 3. 价格结构  [破位 P0 / 波动 P1]
用：相对 cost_basis ±X%、距 90 日高低、24h ±Y%
不用：绝对美元价
有冷却期（如 xDEUS 5 天）时，阈值须留出冷却期的波动空间

### 4. 筹码 / 持币结构  [P1]
看：top10 占比变化、单笔转账 > pool_tvl 1%、交易所净流入
需要索引器（Alchemy / Etherscan）

### 5. 协议 / 合约事件  [P0]
看：代理 admin 变更、合约升级、紧急暂停、治理提案、费率/通胀改动
特点：往往先于价格动

## 分档
| 形态 | 有效指标 |
|---|---|
| 只有 DEX 池 | 1 2 3 5 |
| 有 CEX 现货 | + 成交量异动、交易所流入 |
| 有衍生品 | + funding rate、OI 暴增、清算簇 |

## 退出可行性（必算）
exit_days = position_size ÷ (daily_volume × 可承受滑点) + 冷却期天数
> 3 天 → 进预警

## 分级推送
P0 立即：解锁、TVL 骤降、协议异常、价格破位
P1 汇总：日常波动、筹码微变
原则：天天响 = 没响
