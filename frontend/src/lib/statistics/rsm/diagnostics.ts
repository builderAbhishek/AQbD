/**
 * Approximation of the inverse normal CDF (probit function).
 * Uses a rational approximation (e.g. Beasley-Springer-Moro or similar).
 * Accurate enough for normal probability plotting.
 */
export function inverseNormalCDF(p: number): number {
  // A simple approximation for the inverse cumulative normal distribution
  if (p <= 0.0 || p >= 1.0) {
    throw new Error("p must be strictly between 0 and 1");
  }

  // Uses the rational approximation from Abramowitz and Stegun (1964)
  // or a common equivalent.
  const a = [2.50662823884, -18.61500062529, 41.39119773534, -25.44106049637];
  const b = [-8.47351093090, 23.08336743743, -21.06224101826, 3.13082909833];
  const c = [0.3374754822726147, 0.9761690190917186, 0.1607979714918209,
             0.0276438810333863, 0.0038405729373609, 0.0003951896511919,
             0.0000321767881768, 0.0000002888167364, 0.0000003960315187];

  let x = p - 0.5;
  let r: number;

  if (Math.abs(x) < 0.42) {
    // central region
    r = x * x;
    r = x * (((a[3] * r + a[2]) * r + a[1]) * r + a[0]) /
            ((((b[3] * r + b[2]) * r + b[1]) * r + b[0]) * r + 1.0);
    return r;
  } else {
    // tail region
    r = p;
    if (x > 0) {
      r = 1.0 - p;
    }
    r = Math.log(-Math.log(r));
    let z = c[0] + r * (c[1] + r * (c[2] + r * (c[3] + r * (c[4] + r * (c[5] + r * (c[6] + r * (c[7] + r * c[8])))))));
    if (x < 0) {
      z = -z;
    }
    return z;
  }
}
