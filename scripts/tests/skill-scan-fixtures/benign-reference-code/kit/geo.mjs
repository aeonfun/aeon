export function spread(rm, F) {
  return [0, 1, 2].map((i) => rm * Math.sqrt(Math.max(0, 1 - F.a[i] * F.a[i])));
}
export const area = (xc, yc, rm) => xc * xc + yc * yc - rm * rm;
