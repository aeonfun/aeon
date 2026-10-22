⚠️ ⚠️ onchain-monitor 连挂 3 次 · 距 120 万解锁 26h

## 🔴 onchain-monitor 连挂 3 次，而明天就是 120 万解锁日

`onchain-monitor` 自 2026-10-21 22:06Z 起 `consecutive_failures = 3`，最后一次成功是 15:30Z。三次都是网关 `hivemindos: 403 All target providers failed`，不是 skill 自身 bug。

**为什么现在要管：** 它是唯一在盯 NOTE timelock 的 skill，而 timelock 的 120 万枚解锁在 **2026-10-23 09:57:36Z**，距今约 **26 小时**。它今天还有 09:00Z / 21:00Z 两个窗口。这两个窗口如果照旧 403，明天解锁当天你会是瞎的。

同一波 403 里的另外两个 skill 都已自愈：`memory-flush` 00:11Z 成功，`price-alert` 07:02Z 成功。只有它还没被验证过——因为它从失败以后一直没轮到运行窗口，不是它恢复得慢。

**下一步：** 09:00Z 那个窗口是判据。成功 → 一切正常，我明早的 heartbeat 会确认；再失败 → 需要开 `ALCHEMY_API_KEY` 走备用取数路径，或者今晚手动跑一次。

## 🟡 三条 health issue

#3 `price-alert`、#5 `memory-flush` 对应的事件都已过去（两个 skill 后续都成功过），可以关掉。#4 `onchain-monitor` 留着，等 09:00Z。

## 🔵 顺手更新

- `price-alert` 20 轮连跑仍在 $0.0179–0.0186 窄带，最新 07:01Z $0.01799，四门槛全未触及（距 $0.025 需 +39.0%）。
- `docs/status.md` 已重写，判定 🔴 DEGRADED（原因同上，仅 onchain-monitor）。

---

数据源：`memory/cron-state.json`、GitHub Actions run 记录、`aeon.yml`。