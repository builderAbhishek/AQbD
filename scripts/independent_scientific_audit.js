const fs = require('fs');
const path = require('path');
const jStat = require('../frontend/node_modules/jstat');

// -------------------------------------------------------------
// 1. BENCHMARK CCD DATA (20 RUNS)
// -------------------------------------------------------------
const factors = [
  { id: 'f1', name: 'Factor A', units: 'Organic Phase (%)', low: 35, high: 45 },
  { id: 'f2', name: 'Factor B', units: 'pH', low: 2.5, high: 3.5 },
  { id: 'f3', name: 'Factor C', units: 'Temperature (°C)', low: 25, high: 35 }
];

const runs = [
  { stdOrder: 1,  runOrder: 1,  actual: { f1: 35, f2: 2.5, f3: 25 }, res: { r1: 2.10, r2: 7.20, r3: 1.18 } },
  { stdOrder: 2,  runOrder: 2,  actual: { f1: 45, f2: 2.5, f3: 25 }, res: { r1: 2.72, r2: 8.10, r3: 1.12 } },
  { stdOrder: 3,  runOrder: 3,  actual: { f1: 35, f2: 3.5, f3: 25 }, res: { r1: 2.32, r2: 7.80, r3: 1.24 } },
  { stdOrder: 4,  runOrder: 4,  actual: { f1: 45, f2: 3.5, f3: 25 }, res: { r1: 2.58, r2: 8.70, r3: 1.20 } },
  { stdOrder: 5,  runOrder: 5,  actual: { f1: 35, f2: 2.5, f3: 35 }, res: { r1: 2.48, r2: 7.60, r3: 1.16 } },
  { stdOrder: 6,  runOrder: 6,  actual: { f1: 45, f2: 2.5, f3: 35 }, res: { r1: 3.09, r2: 9.10, r3: 1.14 } },
  { stdOrder: 7,  runOrder: 7,  actual: { f1: 35, f2: 3.5, f3: 35 }, res: { r1: 2.26, r2: 8.20, r3: 1.22 } },
  { stdOrder: 8,  runOrder: 8,  actual: { f1: 45, f2: 3.5, f3: 35 }, res: { r1: 2.74, r2: 9.40, r3: 1.18 } },
  { stdOrder: 9,  runOrder: 9,  actual: { f1: 31.59103584746286, f2: 3.0, f3: 30 }, res: { r1: 2.00, r2: 7.50, r3: 1.25 } },
  { stdOrder: 10, runOrder: 10, actual: { f1: 48.40896415253714, f2: 3.0, f3: 30 }, res: { r1: 2.85, r2: 9.00, r3: 1.15 } },
  { stdOrder: 11, runOrder: 11, actual: { f1: 40, f2: 2.159103584746286, f3: 30 }, res: { r1: 2.62, r2: 7.70, r3: 1.08 } },
  { stdOrder: 12, runOrder: 12, actual: { f1: 40, f2: 3.840896415253714, f3: 30 }, res: { r1: 2.18, r2: 8.40, r3: 1.30 } },
  { stdOrder: 13, runOrder: 13, actual: { f1: 40, f2: 3.0, f3: 21.59103584746286 }, res: { r1: 2.28, r2: 7.90, r3: 1.20 } },
  { stdOrder: 14, runOrder: 14, actual: { f1: 40, f2: 3.0, f3: 38.40896415253714 }, res: { r1: 2.88, r2: 8.80, r3: 1.12 } },
  { stdOrder: 15, runOrder: 15, actual: { f1: 40, f2: 3.0, f3: 30 }, res: { r1: 2.78, r2: 8.40, r3: 1.14 } },
  { stdOrder: 16, runOrder: 16, actual: { f1: 40, f2: 3.0, f3: 30 }, res: { r1: 2.80, r2: 8.42, r3: 1.13 } },
  { stdOrder: 17, runOrder: 17, actual: { f1: 40, f2: 3.0, f3: 30 }, res: { r1: 2.76, r2: 8.38, r3: 1.15 } },
  { stdOrder: 18, runOrder: 18, actual: { f1: 40, f2: 3.0, f3: 30 }, res: { r1: 2.79, r2: 8.41, r3: 1.14 } },
  { stdOrder: 19, runOrder: 19, actual: { f1: 40, f2: 3.0, f3: 30 }, res: { r1: 2.77, r2: 8.39, r3: 1.16 } },
  { stdOrder: 20, runOrder: 20, actual: { f1: 40, f2: 3.0, f3: 30 }, res: { r1: 2.81, r2: 8.43, r3: 1.12 } }
];

// Matrix utilities
function invertMatrix(A) {
  const n = A.length;
  const M = A.map((row, i) => {
    const aug = new Array(2 * n).fill(0);
    for (let j = 0; j < n; j++) aug[j] = row[j];
    aug[n + i] = 1;
    return aug;
  });

  for (let i = 0; i < n; i++) {
    let maxRow = i;
    let maxVal = Math.abs(M[i][i]);
    for (let r = i + 1; r < n; r++) {
      if (Math.abs(M[r][i]) > maxVal) {
        maxVal = Math.abs(M[r][i]);
        maxRow = r;
      }
    }
    if (maxVal < 1e-14) throw new Error('Singular matrix');

    if (maxRow !== i) {
      const temp = M[i];
      M[i] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[i][i];
    for (let j = 0; j < 2 * n; j++) M[i][j] /= pivot;

    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = M[r][i];
        for (let j = 0; j < 2 * n; j++) M[r][j] -= factor * M[i][j];
      }
    }
  }
  return M.map(row => row.slice(n));
}

function matMul(A, B) {
  const rA = A.length, cA = A[0].length, cB = B[0].length;
  const out = Array.from({ length: rA }, () => new Array(cB).fill(0));
  for (let i = 0; i < rA; i++) {
    for (let j = 0; j < cB; j++) {
      let sum = 0;
      for (let k = 0; k < cA; k++) sum += A[i][k] * B[k][j];
      out[i][j] = sum;
    }
  }
  return out;
}

function transpose(A) {
  const r = A.length, c = A[0].length;
  const out = Array.from({ length: c }, () => new Array(r).fill(0));
  for (let i = 0; i < r; i++) {
    for (let j = 0; j < c; j++) out[j][i] = A[i][j];
  }
  return out;
}

// Coded conversions
function actToCoded(act, low, high) {
  return (act - (low + high) / 2) / ((high - low) / 2);
}

// -------------------------------------------------------------
// 2. MODEL MATRIX GENERATION (20 x 10)
// Term order: [1, xA, xB, xC, xA*xB, xA*xC, xB*xC, xA^2, xB^2, xC^2]
// -------------------------------------------------------------
const termNames = ['Intercept', 'A', 'B', 'C', 'AB', 'AC', 'BC', 'A^2', 'B^2', 'C^2'];
const X = [];
for (const r of runs) {
  const xA = actToCoded(r.actual.f1, 35, 45);
  const xB = actToCoded(r.actual.f2, 2.5, 3.5);
  const xC = actToCoded(r.actual.f3, 25, 35);
  X.push([
    1,
    xA,
    xB,
    xC,
    xA * xB,
    xA * xC,
    xB * xC,
    xA * xA,
    xB * xB,
    xC * xC
  ]);
}

const Xt = transpose(X);
const XtX = matMul(Xt, X);
const XtX_inv = invertMatrix(XtX);

console.log('=== 1. DESIGN MATRIX & INVERSE (X^T X)^-1 AUDIT ===');
console.log('X dimensions: 20 x 10');
console.log('(X^T X)^-1 diagonal elements:');
termNames.forEach((name, i) => {
  console.log(`  ${name.padEnd(12)}: ${XtX_inv[i][i].toFixed(8)}`);
});

const centerRow = [1, 0, 0, 0, 0, 0, 0, 0, 0, 0];
let h00 = 0;
for (let i = 0; i < 10; i++) {
  for (let j = 0; j < 10; j++) {
    h00 += centerRow[i] * XtX_inv[i][j] * centerRow[j];
  }
}
console.log(`\nCenter Point Leverage h_00 = ${h00} = 1/6 = ${(1/6).toFixed(8)}`);

// -------------------------------------------------------------
// 3. OLS FITTING FOR ALL 3 RESPONSES
// -------------------------------------------------------------
const responseData = [
  { key: 'r1', name: 'Resolution' },
  { key: 'r2', name: 'Retention Time' },
  { key: 'r3', name: 'Tailing Factor' }
];

const auditResults = {};

for (const resp of responseData) {
  const y = runs.map(r => [r.res[resp.key]]);
  const Xty = matMul(Xt, y);
  const beta = matMul(XtX_inv, Xty).map(r => r[0]);

  // Predictions and residuals
  let sse = 0;
  let sst = 0;
  const yMean = runs.reduce((acc, r) => acc + r.res[resp.key], 0) / 20;

  for (let i = 0; i < 20; i++) {
    let yHat = 0;
    for (let j = 0; j < 10; j++) yHat += X[i][j] * beta[j];
    const e = y[i][0] - yHat;
    sse += e * e;
    sst += (y[i][0] - yMean) * (y[i][0] - yMean);
  }

  const dfError = 20 - 10; // 10
  const msError = sse / dfError;
  const s = Math.sqrt(msError);

  // Predictions at center point (xA=0, xB=0, xC=0)
  const yPredCenter = beta[0]; // Intercept
  const seMean = Math.sqrt(msError * h00);
  const sePred = Math.sqrt(msError * (1 + h00));

  // Critical t for 95% CI (df = 10, two-sided alpha = 0.05 => quantile 0.975)
  const tCrit95 = jStat.studentt.inv(0.975, dfError);

  const ciLow = yPredCenter - tCrit95 * seMean;
  const ciHigh = yPredCenter + tCrit95 * seMean;

  const piLow = yPredCenter - tCrit95 * sePred;
  const piHigh = yPredCenter + tCrit95 * sePred;

  // Tolerance Interval (95% confidence, 99% population coverage)
  // Wald-Wolfowitz / Howe approximation for regression
  const pPop = 0.99;
  const alpha = 0.05;
  const zp = jStat.normal.inv((1 + pPop) / 2, 0, 1);
  const chi2 = jStat.chisquare.inv(alpha, dfError);
  const baseK = zp * Math.sqrt((1 + h00) * (dfError / chi2));
  const correction = Math.sqrt(1 + (zp * zp - 1) / (2 * (dfError + 4.86)));
  const kTI = baseK * correction;

  const tiLow = yPredCenter - kTI * s;
  const tiHigh = yPredCenter + kTI * s;

  auditResults[resp.key] = {
    name: resp.name,
    beta,
    sse,
    sst,
    dfError,
    msError,
    s,
    yPredCenter,
    seMean,
    sePred,
    tCrit95,
    ciLow,
    ciHigh,
    piLow,
    piHigh,
    kTI,
    tiLow,
    tiHigh
  };

  console.log(`\n=== INDEPENDENT FIT: ${resp.name.toUpperCase()} ===`);
  console.log(`  Intercept (yPredCenter): ${yPredCenter.toFixed(7)}`);
  console.log(`  s (Std Dev):             ${s.toFixed(7)}`);
  console.log(`  MS_Error (Variance):     ${msError.toFixed(8)}`);
  console.log(`  SE(Mean):                ${seMean.toFixed(7)}`);
  console.log(`  95% CI Low:              ${ciLow.toFixed(7)}`);
  console.log(`  95% CI High:             ${ciHigh.toFixed(7)}`);
  console.log(`  SE(Pred):                ${sePred.toFixed(7)}`);
  console.log(`  95% PI Low:              ${piLow.toFixed(7)}`);
  console.log(`  95% PI High:             ${piHigh.toFixed(7)}`);
  console.log(`  TI Factor k:             ${kTI.toFixed(7)}`);
  console.log(`  95%/99% TI Low:          ${tiLow.toFixed(7)}`);
  console.log(`  95%/99% TI High:         ${tiHigh.toFixed(7)}`);
}

// -------------------------------------------------------------
// 4. COMPARISON WITH DESIGN-EXPERT 13 REFERENCE & AQBD LIVE UI
// -------------------------------------------------------------
const dx13Benchmark = {
  Resolution: {
    mean: 2.78219,
    seMean: 0.0331387,
    ciLow: 2.70835,
    ciHigh: 2.85602,
    sePred: 0.08781,
    piLow: 2.38871,
    piHigh: 3.17567
  },
  RetentionTime: {
    mean: 8.40315,
    seMean: 0.0375957,
    ciLow: 8.31938,
    ciHigh: 8.48692,
    sePred: 0.0996,
    piLow: 7.95675,
    piHigh: 8.84955
  },
  TailingFactor: {
    mean: 1.14019,
    seMean: 0.0107525,
    ciLow: 1.11623,
    ciHigh: 1.16415,
    sePred: 0.0285,
    piLow: 1.01252,
    piHigh: 1.26786
  }
};

const aqbdLiveUI = {
  Resolution: {
    mean: 2.78219,
    seMean: 0.0331387,
    ciLow: 2.70835,
    ciHigh: 2.85602,
    stdDev: 0.0812525,
    tiLow: 2.38945,
    tiHigh: 3.17492
  },
  RetentionTime: {
    mean: 8.40315,
    seMean: 0.0375957,
    ciLow: 8.31938,
    ciHigh: 8.48692,
    stdDev: 0.0921807,
    tiLow: 7.95759,
    tiHigh: 8.84871
  },
  TailingFactor: {
    mean: 1.14019,
    seMean: 0.0107525,
    ciLow: 1.11623,
    ciHigh: 1.16415,
    stdDev: 0.0263640,
    tiLow: 1.01276,
    tiHigh: 1.26762
  }
};

console.log('\n=== STATISTICAL COMPARISON TABLE ===');
for (const [key, bKey, name] of [
  ['r1', 'Resolution', 'Resolution'],
  ['r2', 'RetentionTime', 'Retention Time'],
  ['r3', 'TailingFactor', 'Tailing Factor']
]) {
  const calc = auditResults[key];
  const ref = dx13Benchmark[bKey];
  const ui = aqbdLiveUI[bKey];

  console.log(`\n--- ${name} ---`);
  console.log(`Mean:       Expected: ${ref.mean} | Calculated: ${calc.yPredCenter.toFixed(5)} | Live UI: ${ui.mean} | Error: ${Math.abs(calc.yPredCenter - ref.mean).toExponential(3)}`);
  console.log(`SE(Mean):   Expected: ${ref.seMean} | Calculated: ${calc.seMean.toFixed(7)} | Live UI: ${ui.seMean} | Error: ${Math.abs(calc.seMean - ref.seMean).toExponential(3)}`);
  console.log(`95% CI Low: Expected: ${ref.ciLow} | Calculated: ${calc.ciLow.toFixed(5)} | Live UI: ${ui.ciLow} | Error: ${Math.abs(calc.ciLow - ref.ciLow).toExponential(3)}`);
  console.log(`95% CI High:Expected: ${ref.ciHigh} | Calculated: ${calc.ciHigh.toFixed(5)} | Live UI: ${ui.ciHigh} | Error: ${Math.abs(calc.ciHigh - ref.ciHigh).toExponential(3)}`);
  console.log(`SE(Pred):   Expected: ${ref.sePred} | Calculated: ${calc.sePred.toFixed(5)} | Error: ${Math.abs(calc.sePred - ref.sePred).toExponential(3)}`);
  console.log(`95% PI Low: Expected: ${ref.piLow} | Calculated: ${calc.piLow.toFixed(5)} | Error: ${Math.abs(calc.piLow - ref.piLow).toExponential(3)}`);
  console.log(`95% PI High:Expected: ${ref.piHigh} | Calculated: ${calc.piHigh.toFixed(5)} | Error: ${Math.abs(calc.piHigh - ref.piHigh).toExponential(3)}`);
  console.log(`99% TI Low: Live UI: ${ui.tiLow} | Calculated: ${calc.tiLow.toFixed(5)} | Error: ${Math.abs(calc.tiLow - ui.tiLow).toExponential(3)}`);
  console.log(`99% TI High:Live UI: ${ui.tiHigh} | Calculated: ${calc.tiHigh.toFixed(5)} | Error: ${Math.abs(calc.tiHigh - ui.tiHigh).toExponential(3)}`);
}

// -------------------------------------------------------------
// 5. OPTIMIZATION VERIFICATION & SENSITIVITY ANALYSIS
// -------------------------------------------------------------
console.log('\n=== 5. OPTIMIZATION VERIFICATION ===');
// Evaluate desirability function at DX13 optimum vs AQbD optimum
function evalSolution(A, B, C) {
  const xA = actToCoded(A, 35, 45);
  const xB = actToCoded(B, 2.5, 3.5);
  const xC = actToCoded(C, 25, 35);
  const row = [1, xA, xB, xC, xA * xB, xA * xC, xB * xC, xA * xA, xB * xB, xC * xC];

  let y1 = 0, y2 = 0, y3 = 0;
  for (let j = 0; j < 10; j++) {
    y1 += row[j] * auditResults.r1.beta[j];
    y2 += row[j] * auditResults.r2.beta[j];
    y3 += row[j] * auditResults.r3.beta[j];
  }

  // Desirabilities:
  // Resolution: Maximize from 2.00 to 3.09, s=1, imp=3
  const d1 = y1 <= 2.00 ? 0 : (y1 >= 3.09 ? 1 : (y1 - 2.00) / (3.09 - 2.00));
  // Retention Time: Minimize from 7.20 to 9.40, t=1, imp=3
  const d2 = y2 <= 7.20 ? 1 : (y2 >= 9.40 ? 0 : (9.40 - y2) / (9.40 - 7.20));
  // Tailing Factor: Target 1.19 between 1.08 and 1.30, s=1, t=1, imp=3
  let d3 = 0;
  if (y3 >= 1.08 && y3 <= 1.30) {
    if (y3 <= 1.19) d3 = (y3 - 1.08) / (1.19 - 1.08);
    else d3 = (1.30 - y3) / (1.30 - 1.19);
  }

  // Combined Desirability:
  const D = (d1 > 0 && d2 > 0 && d3 > 0) ? Math.cbrt(d1 * d2 * d3) : 0;

  return { A, B, C, y1, y2, y3, d1, d2, d3, D };
}

const dxOpt = evalSolution(37.519, 3.193, 26.827);
const aqbdOpt = evalSolution(37.517129, 3.192892, 26.821382);

console.log('Design-Expert 13 Reported Optimum Evaluation:');
console.log(JSON.stringify(dxOpt, null, 2));

console.log('AQbD Studio Reported Optimum Evaluation:');
console.log(JSON.stringify(aqbdOpt, null, 2));

console.log(`Desirability Difference: D(AQbD) - D(DX13) = ${(aqbdOpt.D - dxOpt.D).toExponential(4)}`);

// Save calculations for report generator
fs.writeFileSync(
  path.join(__dirname, 'independent_audit_data.json'),
  JSON.stringify({ auditResults, dx13Benchmark, aqbdLiveUI, dxOpt, aqbdOpt, XtX_inv }, null, 2)
);

console.log('\nIndependent audit calculations completed successfully!');
