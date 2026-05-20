BEGIN {
  FS = "\t"
  btc7 = -4.573
  eth7 = -7.381
  n = split("ZEST,VVV,PENGU,ONDO,PI,DRV,ZEC,MON,SOL,SERV,BNKR,OCT", tr, ",")
  for (i = 1; i <= n; i++) trmap[tr[i]] = 1
}
{
  sym = $1; px = $2; mc = $3; vol = $4; d24 = $5; d7 = $6; ratio = $7; id = $8
  score = 0
  if (d24 + 0 > 0) score++
  if (d7 + 0 > 0) score++
  if (d24 + 0 > 5 && d7 + 0 > 5) score += 2
  if (ratio + 0 >= 0.20) score += 3
  else if (ratio + 0 >= 0.10) score += 2
  if (d7 + 0 > btc7 && d7 + 0 > eth7) score += 2
  if (sym in trmap) score += 2
  printf "%d\t%s\tpx=%.4g\t24h=%+.2f%%\t7d=%+.2f%%\tmc=$%.2fb\tvol=$%.0fm\tv/m=%.3f\ttrend=%s\tid=%s\n", score, sym, px + 0, d24 + 0, d7 + 0, mc / 1e9, vol / 1e6, ratio + 0, (sym in trmap) ? "Y" : "-", id
}
