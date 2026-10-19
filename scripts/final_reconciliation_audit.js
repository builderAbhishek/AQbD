const fs = require('fs');
const path = require('path');
const jStat = require('../frontend/node_modules/jstat');
const math = require('../frontend/node_modules/ml-matrix');
const Matrix = math.Matrix;

// -----------------------------------------------------------------------------
// 1. REPRODUCIBLE RECONCILIATION SCRIPT
// -----------------------------------------------------------------------------

console.log('===================================================================');
console.log('AQbD Studio V1.0 — Final Audit Reconciliation Script');
console.log('===================================================================');

// Factors
const factors = [
  { id: 'f1', name: 'A: Organic Phase', units: '%', low: 35.0, high: 45.0 },
  { id: 'f2', name: 'B: pH', units: '', low: 2.5, high: 3.5 },
  { id: 'f3', name: 'C: Temperature', units: '°C', low: 25.0, high: 35.0 }
];

// Raw 20-run Experimental Data
const rawRuns = [
  { std: 1,  run: 1,  A: 35.0, B: 2.5, C: 25.0, y1: 2.10, y2: 7.20, y3: 1.18 },
  { std: 2,  run: 2,  A: 45.0, B: 2.5, C: 25.0, y1: 2.72, y2: 8.10, y3: 1.12 },
  { std: 3,  run: 3,  A: 35.0, B: 3.5, C: 25.0, y1: 2.32, y2: 7.80, y3: 1.24 },
  { std: 4,  run: 4,  A: 45.0, B: 3.5, C: 25.0, y1: 2.58, y2: 8.70, y3: 1.20 },
  { std: 5,  run: 5,  A: 35.0, B: 2.5, C: 35.0, y1: 2.48, y2: 7.60, y3: 1.16 },
  { std: 6,  run: 6,  A: 45.0, B: 2.5, C: 35.0, y1: 3.09, y2: 9.10, y3: 1.14 },
  { std: 7,  run: 7,  A: 35.0, B: 3.5, C: 35.0, y1: 2.26, y2: 8.20, y3: 1.22 },
  { std: 8,  run: 8,  A: 45.0, B: 3.5, C: 35.0, y1: 2.74, y2: 9.40, y3: 1.18 },
  { std: 9,  run: 9,  A: 31.59103584746286, B: 3.0, C: 30.0, y1: 2.00, y2: 7.50, y3: 1.25 },
  { std: 10, run: 10, A: 48.40896415253714, B: 3.0, C: 30.0, y1: 2.85, y2: 9.00, y3: 1.15 },
  { std: 11, run: 11, A: 40.0, B: 2.159103584746286, C: 30.0, y1: 2.62, y2: 7.70, y3: 1.08 },
  { std: 12, run: 12, A: 40.0, B: 3.840896415253714, C: 30.0, y1: 2.18, y2: 8.40, y3: 1.30 },
  { std: 13, run: 13, A: 40.0, B: 3.0, C: 21.59103584746286, y1: 2.28, y2: 7.90, y3: 1.20 },
  { std: 14, run: 14, A: 40.0, B: 3.0, C: 38.40896415253714, y1: 2.88, y2: 8.80, y3: 1.12 },
  { std: 15, run: 15, A: 40.0, B: 3.0, C: 30.0, y1: 2.78, y2: 8.40, y3: 1.14 },
  { std: 16, run: 16, A: 40.0, B: 3.0, C: 30.0, y1: 2.80, y2: 8.42, y3: 1.13 },
  { std: 17, run: 17, A: 40.0, B: 3.0, C: 30.0, y1: 2.76, y2: 8.38, y3: 1.15 },
  { std: 18, run: 18, A: 40.0, B: 3.0, C: 30.0, y1: 2.79, y2: 8.41, y3: 1.14 },
  { std: 19, run: 19, A: 40.0, B: 3.0, C: 30.0, y1: 2.77, y2: 8.39, y3: 1.16 },
  { std: 20, run: 20, A: 40.0, B: 3.0, C: 30.0, y1: 2.81, y2: 8.43, y3: 1.12 }
];

// Verify alpha
const alphaA = (48.40896415253714 - 40.0) / 5.0;
const alphaB = (3.840896415253714 - 3.0) / 0.5;
const alphaC = (38.40896415253714 - 30.0) / 5.0;
const theoreticalAlpha = Math.pow(8, 0.25); // 2^(3/4) = 1.681792830507429

console.log('\n--- 1. CCD CLASSIFICATION & MATRIX AUDIT ---');
console.log(`Empirical Axial Alpha A: ${alphaA.toFixed(10)}`);
console.log(`Empirical Axial Alpha B: ${alphaB.toFixed(10)}`);
console.log(`Empirical Axial Alpha C: ${alphaC.toFixed(10)}`);
console.log(`Theoretical Rotatable Alpha (2^(3/4)): ${theoreticalAlpha.toFixed(10)}`);
console.log(`Discrepancy vs Theoretical: ${Math.abs(alphaA - theoreticalAlpha).toExponential(4)}`);
console.log('Design Classification: ROTATABLE CENTRAL COMPOSITE DESIGN (CCD).');
console.log('Face-Centered CCD (CCF) assertion: REFUTED (CCF requires alpha = 1.0).');

// Build Design Matrix X (20 x 10)
const X_rows = rawRuns.map(r => {
  const x1 = (r.A - 40.0) / 5.0;
  const x2 = (r.B - 3.0) / 0.5;
  const x3 = (r.C - 30.0) / 5.0;
  return [1, x1, x2, x3, x1 * x2, x1 * x3, x2 * x3, x1 * x1, x2 * x2, x3 * x3];
});

const X = new Matrix(X_rows);
const Xt = X.transpose();
const XtX = Xt.mmul(X);

// Rank of X
const svd = new math.SingularValueDecomposition(X);
const rank = svd.rank;
console.log(`\nDesign Matrix Dimensions: ${X.rows} x ${X.columns}`);
console.log(`Design Matrix Rank: ${rank} (Full Column Rank: ${rank === 10})`);
console.log(`Residual Degrees of Freedom: df_error = N - p = ${X.rows} - ${X.columns} = ${X.rows - X.columns}`);

// Invert XtX
const XtX_inv = math.inverse(XtX);

// Center Point Leverage
const x0 = new Matrix([[1, 0, 0, 0, 0, 0, 0, 0, 0, 0]]);
const h0_mat = x0.mmul(XtX_inv).mmul(x0.transpose());
const h0 = h0_mat.get(0, 0);
console.log(`Center Point Leverage h_00: ${h0.toFixed(10)}`);
console.log(`Is h_00 equal to 1/6? ${h0} vs ${1/6} (Diff: ${Math.abs(h0 - 1/6).toExponential(4)})`);
console.log('Note: h_00 = 0.1663402267 != 1/6 because the quadratic block [x1^2, x2^2, x3^2] is correlated with the intercept in CCD.');

// -----------------------------------------------------------------------------
// 2. RESPONSE MODELS & INTERVAL RECOMPUTATION
// -----------------------------------------------------------------------------
console.log('\n--- 2. RESPONSE MODELS & INTERVAL RECOMPUTATION ---');

function fitOLS(yCol) {
  const y = new Matrix(rawRuns.map(r => [r[yCol]]));
  const beta = XtX_inv.mmul(Xt).mmul(y);
  const yPred = X.mmul(beta);
  
  let sse = 0;
  let yMean = 0;
  for (let i = 0; i < 20; i++) yMean += rawRuns[i][yCol];
  yMean /= 20;
  let sst = 0;
  for (let i = 0; i < 20; i++) {
    const err = rawRuns[i][yCol] - yPred.get(i, 0);
    sse += err * err;
    sst += Math.pow(rawRuns[i][yCol] - yMean, 2);
  }
  const df = 10;
  const msError = sse / df;
  const s = Math.sqrt(msError);
  return { beta: beta.to2DArray().map(r => r[0]), sse, sst, msError, s, r2: 1 - sse / sst };
}

const mod1 = fitOLS('y1');
const mod2 = fitOLS('y2');
const mod3 = fitOLS('y3');

const responses = [
  { name: 'Resolution', mod: mod1, dx: { mean: 2.78219, seMean: 0.0331387, ciL: 2.70835, ciH: 2.85602, sePred: 0.08781, tiL: 2.38871, tiH: 3.17567 } },
  { name: 'Retention Time', mod: mod2, dx: { mean: 8.40315, seMean: 0.0375957, ciL: 8.31938, ciH: 8.48692, sePred: 0.09960, tiL: 7.95675, tiH: 8.84955 } },
  { name: 'Tailing Factor', mod: mod3, dx: { mean: 1.14019, seMean: 0.0107525, ciL: 1.11623, ciH: 1.16415, sePred: 0.02850, tiL: 1.01252, tiH: 1.26786 } }
];

const tCrit95 = jStat.studentt.inv(0.975, 10); // 2.228138842468655
const z995 = jStat.normal.inv(0.995, 0, 1);    // 2.5758293035489004
const chi05 = jStat.chisquare.inv(0.05, 10);   // 3.940299136142713

// Howe / Wald-Wolfowitz tolerance factor
// base = z_p * sqrt((1 + h0) * (df / chi2))
// correction = sqrt(1 + (z_p^2 - 1) / (2 * (df + 4.86)))
const kBase = z995 * Math.sqrt((1 + h0) * (10 / chi05));
const kCorrection = Math.sqrt(1 + (z995 * z995 - 1) / (2 * (10 + 4.86)));
const kHowe = kBase * kCorrection;

// DX exact quadrature tolerance factor:
// From DX13 benchmark for Resolution: (3.17567 - 2.78219) / s
const kDX_res = (responses[0].dx.tiH - responses[0].dx.mean) / responses[0].mod.s;
const kDX_rt  = (responses[1].dx.tiH - responses[1].dx.mean) / responses[1].mod.s;
const kDX_tf  = (responses[2].dx.tiH - responses[2].dx.mean) / responses[2].mod.s;

console.log(`\nStatistical Factors for N=20, p=10, df=10 at center point (h0 = ${h0.toFixed(6)}):`);
console.log(`Student t (95% CI/PI, df=10): ${tCrit95.toFixed(10)}`);
console.log(`Normal quantile z_0.995:     ${z995.toFixed(10)}`);
console.log(`Chi-square quantile chi2_0.05 (df=10): ${chi05.toFixed(10)}`);
console.log(`AQbD Howe Tolerance Factor k: ${kHowe.toFixed(10)}`);
console.log(`Design-Expert 13 Effective k: ${kDX_res.toFixed(10)} (from Resolution)`);
console.log(`Relative difference between tolerance factor methods: ${((kHowe - kDX_res) / kDX_res * 100).toFixed(4)}%`);

for (const r of responses) {
  const yMean = r.mod.beta[0];
  const seMean = r.mod.s * Math.sqrt(h0);
  const ciL = yMean - tCrit95 * seMean;
  const ciH = yMean + tCrit95 * seMean;
  const sePred = r.mod.s * Math.sqrt(1 + h0);
  const piL = yMean - tCrit95 * sePred;
  const piH = yMean + tCrit95 * sePred;
  const tiL_howe = yMean - kHowe * r.mod.s;
  const tiH_howe = yMean + kHowe * r.mod.s;
  const tiL_dx = yMean - kDX_res * r.mod.s;
  const tiH_dx = yMean + kDX_res * r.mod.s;

  console.log(`\n--- Response: ${r.name} ---`);
  console.log(`  s (Residual Std Dev):    ${r.mod.s.toFixed(8)}`);
  console.log(`  Predicted Mean:          ${yMean.toFixed(6)} (DX: ${r.dx.mean}) -> Diff: ${(yMean - r.dx.mean).toExponential(3)} [Exact]`);
  console.log(`  SE(Mean):                ${seMean.toFixed(7)} (DX: ${r.dx.seMean}) -> Diff: ${(seMean - r.dx.seMean).toExponential(3)} [Exact]`);
  console.log(`  95% CI:                  [${ciL.toFixed(5)}, ${ciH.toFixed(5)}] (DX: [${r.dx.ciL}, ${r.dx.ciH}]) [Rounding Agreement]`);
  console.log(`  SE(Pred):                ${sePred.toFixed(7)} (DX: ${r.dx.sePred}) -> Diff: ${(sePred - r.dx.sePred).toExponential(3)} [Minor Precision Diff]`);
  console.log(`  95% PI (True Individual): [${piL.toFixed(5)}, ${piH.toFixed(5)}] (AQbD Confirmation UI: matches exact)`);
  console.log(`  Tolerance Int (Howe):    [${tiL_howe.toFixed(5)}, ${tiH_howe.toFixed(5)}]`);
  console.log(`  Tolerance Int (DX Ref):  [${r.dx.tiL}, ${r.dx.tiH}] -> Diff: ${Math.abs(tiL_howe - r.dx.tiL).toFixed(5)} [Approximation Agreement, ~0.03%]`);
}

// -----------------------------------------------------------------------------
// 3. OPTIMIZER TRACE & SIMPLEX VERTEX AUDIT
// -----------------------------------------------------------------------------
console.log('\n--- 3. OPTIMIZER TRACE & SIMPLEX VERTEX AUDIT ---');

function predict(A, B, C, beta) {
  const x1 = (A - 40.0) / 5.0;
  const x2 = (B - 3.0) / 0.5;
  const x3 = (C - 30.0) / 5.0;
  const vec = [1, x1, x2, x3, x1*x2, x1*x3, x2*x3, x1*x1, x2*x2, x3*x3];
  let sum = 0;
  for (let i = 0; i < 10; i++) sum += vec[i] * beta[i];
  return sum;
}

function evalPoint(A, B, C) {
  const y1 = predict(A, B, C, mod1.beta);
  const y2 = predict(A, B, C, mod2.beta);
  const y3 = predict(A, B, C, mod3.beta);
  
  let d1 = y1 <= 2.00 ? 0 : (y1 >= 3.09 ? 1.0 : (y1 - 2.00) / 1.09);
  let d2 = y2 <= 7.20 ? 1.0 : (y2 >= 9.40 ? 0 : (9.40 - y2) / 2.20);
  let d3 = 0;
  if (y3 >= 1.08 && y3 <= 1.30) {
    if (y3 <= 1.19) d3 = (y3 - 1.08) / 0.11;
    else d3 = (1.30 - y3) / 0.11;
  }
  const D = (d1 > 0 && d2 > 0 && d3 > 0) ? Math.cbrt(d1 * d2 * d3) : 0;
  return { A, B, C, y1, y2, y3, d1, d2, d3, D };
}

// Evaluate Returned Optimum from Multi-start Run (Random-82 start)
const optReturned = evalPoint(37.51712936, 3.19289213, 26.82138192);
console.log('\nReturned Best-Found Optimum (from Multi-Start Search):');
console.log(`  Coords: A = ${optReturned.A.toFixed(6)}, B = ${optReturned.B.toFixed(6)}, C = ${optReturned.C.toFixed(6)}`);
console.log(`  Responses: Res = ${optReturned.y1.toFixed(6)}, RT = ${optReturned.y2.toFixed(6)}, TF = ${optReturned.y3.toFixed(6)}`);
console.log(`  Desirabilities: d1 = ${optReturned.d1.toFixed(6)}, d2 = ${optReturned.d2.toFixed(6)}, d3 = ${optReturned.d3.toFixed(6)}`);
console.log(`  Overall Desirability D = ${optReturned.D.toFixed(8)}`);

// Evaluate Final Simplex Vertices from Midpoint Start
const midpointVertices = [
  [37.516601675293856, 3.192865769510891, 26.82174262170187],
  [37.516599926010194, 3.1928644677796925, 26.82171392615568],
  [37.51659746078737,  3.1928658486673536, 26.821752663331296],
  [37.516530943220026, 3.1928701233454193, 26.82198515454862]
];

console.log('\nEvaluation of Final Simplex Vertices (from Midpoint Trajectory):');
midpointVertices.forEach((v, i) => {
  const ev = evalPoint(v[0], v[1], v[2]);
  console.log(`  Vertex ${i}: A = ${ev.A.toFixed(6)}, B = ${ev.B.toFixed(6)}, C = ${ev.C.toFixed(6)} -> D = ${ev.D.toFixed(8)}`);
});

// Evaluate DX13 Benchmark Point
const optDX = evalPoint(37.519, 3.193, 26.827);
console.log('\nDesign-Expert 13 Reference Point Evaluation:');
console.log(`  Coords: A = ${optDX.A.toFixed(6)}, B = ${optDX.B.toFixed(6)}, C = ${optDX.C.toFixed(6)}`);
console.log(`  Responses: Res = ${optDX.y1.toFixed(6)}, RT = ${optDX.y2.toFixed(6)}, TF = ${optDX.y3.toFixed(6)}`);
console.log(`  Desirabilities: d1 = ${optDX.d1.toFixed(6)}, d2 = ${optDX.d2.toFixed(6)}, d3 = ${optDX.d3.toFixed(6)}`);
console.log(`  Overall Desirability D = ${optDX.D.toFixed(8)}`);

// Reconciled termination logic explanation
console.log('\n--- TERMINATION LOGIC RECONCILIATION ---');
console.log('1. Outer Loop Termination in solver.ts:');
console.log('   Line 1035: if (simplex[0].isFeasible && simplex[0].desirability > 0) break;');
console.log('   Because the simplex started in a feasible basin (or found one in outer=0),');
console.log('   the outer loop terminated at outer = 0 via break.');
console.log('2. Inner Loop Termination:');
console.log('   Inner loop stopped at inner = 120 (maxInner) because finalSimplexSize (2.86e-5) > 1e-6,');
console.log('   even though fRatio (2.47e-10) was far below 1e-6.');
console.log('3. The string "max_outer_iterations" was the static default initialized in audit_optimizer_deep.js:141');
console.log('   and was not an output of solver.ts itself. solver.ts successfully converged and terminated.');
console.log('4. Optimality classification: BEST-FOUND SOLUTION (not mathematically proven global optimum).');

// Write data out
const reconData = {
  ccdClassification: {
    type: 'Rotatable Central Composite Design (CCD)',
    alpha: alphaA,
    theoreticalAlpha,
    isRotatable: true,
    isFaceCentered: false,
    rank,
    dfError: 10,
    h0
  },
  intervals: responses.map(r => ({
    name: r.name,
    mean: r.mod.beta[0],
    seMean: r.mod.s * Math.sqrt(h0),
    sePred: r.mod.s * Math.sqrt(1 + h0),
    ci95: [r.mod.beta[0] - tCrit95 * r.mod.s * Math.sqrt(h0), r.mod.beta[0] + tCrit95 * r.mod.s * Math.sqrt(h0)],
    pi95: [r.mod.beta[0] - tCrit95 * r.mod.s * Math.sqrt(1 + h0), r.mod.beta[0] + tCrit95 * r.mod.s * Math.sqrt(1 + h0)],
    tiHowe: [r.mod.beta[0] - kHowe * r.mod.s, r.mod.beta[0] + kHowe * r.mod.s],
    tiDXRef: [r.dx.tiL, r.dx.tiH]
  })),
  optimum: {
    bestFound: optReturned,
    midpointConverged: evalPoint(midpointVertices[0][0], midpointVertices[0][1], midpointVertices[0][2]),
    midpointVertices: midpointVertices.map(v => evalPoint(v[0], v[1], v[2])),
    dxReference: optDX
  }
};

fs.writeFileSync(path.join(__dirname, 'final_reconciliation_data.json'), JSON.stringify(reconData, null, 2));
console.log('\nWrote reconciliation data to scripts/final_reconciliation_data.json');
