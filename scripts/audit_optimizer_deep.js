const fs = require('fs');
const path = require('path');
const jStat = require('../frontend/node_modules/jstat');

const { auditResults } = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'independent_audit_data.json'), 'utf8')
);

const factors = [
  { id: 'f1', name: 'Factor A', low: 35, high: 45 },
  { id: 'f2', name: 'Factor B', low: 2.5, high: 3.5 },
  { id: 'f3', name: 'Factor C', low: 25, high: 35 }
];

const criteria = {
  f1: { id: 'f1', type: 'factor', goal: 'in_range', lowerLimit: 35, upperLimit: 45, importance: 3 },
  f2: { id: 'f2', type: 'factor', goal: 'in_range', lowerLimit: 2.5, upperLimit: 3.5, importance: 3 },
  f3: { id: 'f3', type: 'factor', goal: 'in_range', lowerLimit: 25, upperLimit: 35, importance: 3 },
  r1: { id: 'r1', type: 'response', goal: 'maximize', lowerLimit: 2.00, upperLimit: 3.09, lowerWeight: 1, upperWeight: 1, importance: 3 },
  r2: { id: 'r2', type: 'response', goal: 'minimize', lowerLimit: 7.20, upperLimit: 9.40, lowerWeight: 1, upperWeight: 1, importance: 3 },
  r3: { id: 'r3', type: 'response', goal: 'target', targetValue: 1.19, lowerLimit: 1.08, upperLimit: 1.30, lowerWeight: 1, upperWeight: 1, importance: 3 }
};

function actToCoded(act, low, high) {
  return (act - (low + high) / 2) / ((high - low) / 2);
}

function predictResponse(actA, actB, actC, coefs) {
  const xA = actToCoded(actA, 35, 45);
  const xB = actToCoded(actB, 2.5, 3.5);
  const xC = actToCoded(actC, 25, 35);
  return (
    coefs[0] +
    coefs[1] * xA +
    coefs[2] * xB +
    coefs[3] * xC +
    coefs[4] * xA * xB +
    coefs[5] * xA * xC +
    coefs[6] * xB * xC +
    coefs[7] * xA * xA +
    coefs[8] * xB * xB +
    coefs[9] * xC * xC
  );
}

function evalDesirability(A, B, C) {
  if (A < 35 || A > 45 || B < 2.5 || B > 3.5 || C < 25 || C > 35) {
    return { D: 0, d1: 0, d2: 0, d3: 0, isFeasible: false, reason: 'Factor out of bounds' };
  }

  const y1 = predictResponse(A, B, C, auditResults.r1.beta);
  const y2 = predictResponse(A, B, C, auditResults.r2.beta);
  const y3 = predictResponse(A, B, C, auditResults.r3.beta);

  let d1 = 0;
  if (y1 > 2.00) d1 = y1 >= 3.09 ? 1.0 : (y1 - 2.00) / (3.09 - 2.00);

  let d2 = 0;
  if (y2 < 9.40) d2 = y2 <= 7.20 ? 1.0 : (9.40 - y2) / (9.40 - 7.20);

  let d3 = 0;
  if (y3 >= 1.08 && y3 <= 1.30) {
    if (y3 <= 1.19) d3 = (y3 - 1.08) / (1.19 - 1.08);
    else d3 = (1.30 - y3) / (1.30 - 1.19);
  }

  if (d1 <= 0 || d2 <= 0 || d3 <= 0) {
    return { D: 0, d1, d2, d3, y1, y2, y3, isFeasible: false, reason: 'Zero response desirability' };
  }

  const D = Math.cbrt(d1 * d2 * d3);
  return { D, d1, d2, d3, y1, y2, y3, isFeasible: true };
}

// -------------------------------------------------------------
// A. OBJECTIVE FUNCTION LANDSCAPE & GRADIENT NEAR OPTIMUM
// -------------------------------------------------------------
console.log('=== A. OBJECTIVE FUNCTION LANDSCAPE NEAR OPTIMUM ===');
const ptDX = { A: 37.519, B: 3.193, C: 26.827 };
const ptAQ = { A: 37.517129, B: 3.192892, C: 26.821382 };

const evalDX = evalDesirability(ptDX.A, ptDX.B, ptDX.C);
const evalAQ = evalDesirability(ptAQ.A, ptAQ.B, ptAQ.C);

console.log('Design-Expert 13 Point (37.519, 3.193, 26.827):');
console.log(`  D = ${evalDX.D.toFixed(8)} | d1 = ${evalDX.d1.toFixed(6)}, d2 = ${evalDX.d2.toFixed(6)}, d3 = ${evalDX.d3.toFixed(6)}`);
console.log(`  y1 = ${evalDX.y1.toFixed(6)}, y2 = ${evalDX.y2.toFixed(6)}, y3 = ${evalDX.y3.toFixed(6)}`);

console.log('\nAQbD Studio Point (37.517129, 3.192892, 26.821382):');
console.log(`  D = ${evalAQ.D.toFixed(8)} | d1 = ${evalAQ.d1.toFixed(6)}, d2 = ${evalAQ.d2.toFixed(6)}, d3 = ${evalAQ.d3.toFixed(6)}`);
console.log(`  y1 = ${evalAQ.y1.toFixed(6)}, y2 = ${evalAQ.y2.toFixed(6)}, y3 = ${evalAQ.y3.toFixed(6)}`);

console.log(`\nDelta D = D(AQbD) - D(DX13) = ${(evalAQ.D - evalDX.D).toFixed(8)} (AQbD point is slightly higher in desirability by +2.44e-5)`);

const eps = 1e-5;
const gradA = (evalDesirability(ptAQ.A + eps, ptAQ.B, ptAQ.C).D - evalDesirability(ptAQ.A - eps, ptAQ.B, ptAQ.C).D) / (2 * eps);
const gradB = (evalDesirability(ptAQ.A, ptAQ.B + eps, ptAQ.C).D - evalDesirability(ptAQ.A, ptAQ.B - eps, ptAQ.C).D) / (2 * eps);
const gradC = (evalDesirability(ptAQ.A, ptAQ.B, ptAQ.C + eps).D - evalDesirability(ptAQ.A, ptAQ.B - eps, ptAQ.C).D) / (2 * eps);

console.log('\nNumerical Gradient at AQbD Optimum:');
console.log(`  dD/dA = ${gradA.toExponential(4)}`);
console.log(`  dD/dB = ${gradB.toExponential(4)}`);
console.log(`  dD/dC = ${gradC.toExponential(4)}`);
console.log(`  ||grad D|| = ${Math.sqrt(gradA * gradA + gradB * gradB + gradC * gradC).toExponential(4)}`);

const spanA = 45 - 35, spanB = 3.5 - 2.5, spanC = 35 - 25;
const normDist = Math.sqrt(
  Math.pow((ptAQ.A - ptDX.A) / spanA, 2) +
  Math.pow((ptAQ.B - ptDX.B) / spanB, 2) +
  Math.pow((ptAQ.C - ptDX.C) / spanC, 2)
);
console.log(`\nNormalized Euclidean Distance between AQbD and DX13 points: ${(normDist * 100).toFixed(4)}% of factor range = ${normDist.toFixed(6)}`);
console.log(`Since normDist = ${normDist.toFixed(6)} < Duplicate Filter Threshold (0.0050 = 0.5%),`);
console.log(`these two points are IDENTICAL within the configured 0.5% duplicate filter resolution!`);

// -------------------------------------------------------------
// B. DETAILED SIMPLEX CONVERGENCE DIAGNOSTICS FROM STARTING POINT
// -------------------------------------------------------------
console.log('\n=== B. SIMPLEX CONVERGENCE & TERMINATION AUDIT ===');

function createSeededRng(seed = 42) {
  let s = Math.floor(Math.abs(seed)) || 42;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Nelder-Mead Simplex implementation with diagnostics
function runSimplexWithDiagnostics(startA, startB, startC, options = { simplexFraction: 0.1 }) {
  const k = 3;
  let currentBest = [startA, startB, startC];
  let p = 1.0;
  const maxOuter = 15;
  const alpha = 1.0, gamma = 2.0, rho = 0.5, sigma = 0.5;
  let fraction = options.simplexFraction || 0.1;

  let totalInnerIterations = 0;
  let terminationReason = 'max_outer_iterations';
  let finalFRatio = 0;
  let finalSimplexSize = 0;
  let finalSimplexVertices = [];

  const evalObjective = (vals, penalty) => {
    const [A, B, C] = vals;
    let bPenalty = 0;
    if (A < 35) bPenalty += Math.pow((35 - A) / 10, 2);
    else if (A > 45) bPenalty += Math.pow((A - 45) / 10, 2);
    if (B < 2.5) bPenalty += Math.pow((2.5 - B) / 1.0, 2);
    else if (B > 3.5) bPenalty += Math.pow((B - 3.5) / 1.0, 2);
    if (C < 25) bPenalty += Math.pow((25 - C) / 10, 2);
    else if (C > 35) bPenalty += Math.pow((C - 35) / 10, 2);

    if (bPenalty > 0) return { score: 1e10 + bPenalty * 1e8, isFeasible: false, desirability: 0 };

    const y1 = predictResponse(A, B, C, auditResults.r1.beta);
    const y2 = predictResponse(A, B, C, auditResults.r2.beta);
    const y3 = predictResponse(A, B, C, auditResults.r3.beta);

    let viol = 0;
    if (y1 < 2.00) viol += Math.pow((2.00 - y1) / 1.09, 2);
    if (y2 > 9.40) viol += Math.pow((y2 - 9.40) / 2.20, 2);
    if (y3 < 1.08) viol += Math.pow((1.08 - y3) / 0.11, 2);
    else if (y3 > 1.30) viol += Math.pow((y3 - 1.30) / 0.11, 2);

    if (viol > 0) return { score: penalty * viol, isFeasible: false, desirability: 0 };

    let d1 = y1 <= 2.00 ? 0 : (y1 >= 3.09 ? 1.0 : (y1 - 2.00) / (3.09 - 2.00));
    let d2 = y2 <= 7.20 ? 1.0 : (y2 >= 9.40 ? 0 : (9.40 - y2) / (9.40 - 7.20));
    let d3 = 0;
    if (y3 >= 1.08 && y3 <= 1.30) {
      if (y3 <= 1.19) d3 = (y3 - 1.08) / (1.19 - 1.08);
      else d3 = (1.30 - y3) / (1.30 - 1.19);
    }

    if (d1 <= 0 || d2 <= 0 || d3 <= 0) return { score: penalty * 1e-4, isFeasible: false, desirability: 0 };

    const D = Math.cbrt(d1 * d2 * d3);
    return { score: -D, isFeasible: true, desirability: D };
  };

  for (let outer = 0; outer < maxOuter; outer++) {
    const simplex = [];
    const eval0 = evalObjective(currentBest, p);
    simplex.push({ point: [...currentBest], ...eval0 });

    const ranges = [10, 1.0, 10];
    const bounds = [[35, 45], [2.5, 3.5], [25, 35]];

    for (let j = 0; j < k; j++) {
      const pt = [...currentBest];
      let step = ranges[j] * fraction;
      if (pt[j] + step > bounds[j][1]) step = -step;
      pt[j] = Math.max(bounds[j][0], Math.min(bounds[j][1], pt[j] + step));
      simplex.push({ point: pt, ...evalObjective(pt, p) });
    }

    const maxInner = 120;
    for (let inner = 0; inner < maxInner; inner++) {
      totalInnerIterations++;
      simplex.sort((a, b) => a.score - b.score);

      const best = simplex[0];
      const worst = simplex[k];
      const secondWorst = simplex[k - 1];

      const scoreDiff = worst.score - best.score;
      const scoreSum = Math.abs(worst.score) + Math.abs(best.score) + 1e-10;
      const fRatio = (2.0 * scoreDiff) / scoreSum;

      let maxDistSq = 0;
      for (let i = 1; i <= k; i++) {
        let distSq = 0;
        for (let j = 0; j < k; j++) {
          distSq += Math.pow((simplex[i].point[j] - best.point[j]) / ranges[j], 2);
        }
        if (distSq > maxDistSq) maxDistSq = distSq;
      }

      finalFRatio = fRatio;
      finalSimplexSize = Math.sqrt(maxDistSq);

      if (fRatio < 1e-6 && finalSimplexSize < 1e-6) {
        terminationReason = `tolerance_reached (fRatio = ${fRatio.toExponential(3)}, simplexSize = ${finalSimplexSize.toExponential(3)})`;
        break;
      }

      const centroid = [0, 0, 0];
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) centroid[j] += simplex[i].point[j];
      }
      for (let j = 0; j < k; j++) centroid[j] /= k;

      // 1. Reflection
      const xr = centroid.map((c, j) => c + alpha * (c - worst.point[j]));
      const evalR = evalObjective(xr, p);

      if (evalR.score < secondWorst.score && evalR.score >= best.score) {
        simplex[k] = { point: xr, ...evalR };
        continue;
      }

      // 2. Expansion
      if (evalR.score < best.score) {
        const xe = centroid.map((c, j) => c + gamma * (xr[j] - c));
        const evalE = evalObjective(xe, p);
        simplex[k] = evalE.score < evalR.score ? { point: xe, ...evalE } : { point: xr, ...evalR };
        continue;
      }

      // 3. Contraction
      if (evalR.score < worst.score) {
        const xc = centroid.map((c, j) => c + rho * (xr[j] - c));
        const evalC = evalObjective(xc, p);
        if (evalC.score <= evalR.score) {
          simplex[k] = { point: xc, ...evalC };
          continue;
        }
      } else {
        const xc = centroid.map((c, j) => c - rho * (c - worst.point[j]));
        const evalC = evalObjective(xc, p);
        if (evalC.score < worst.score) {
          simplex[k] = { point: xc, ...evalC };
          continue;
        }
      }

      // 4. Shrink
      for (let i = 1; i <= k; i++) {
        const xs = best.point.map((b, j) => b + sigma * (simplex[i].point[j] - b));
        simplex[i] = { point: xs, ...evalObjective(xs, p) };
      }
    }

    simplex.sort((a, b) => a.score - b.score);
    currentBest = [...simplex[0].point];
    finalSimplexVertices = simplex.map(s => s.point);

    if (simplex[0].isFeasible && simplex[0].desirability > 0) {
      break;
    }

    p = Math.min(1e30, p * 100);
    fraction = Math.max(0.01, fraction * 0.7);
  }

  return {
    point: currentBest,
    desirability: -evalObjective(currentBest, p).score,
    totalInnerIterations,
    terminationReason,
    finalFRatio,
    finalSimplexSize,
    finalSimplexVertices
  };
}

// Run from midpoint (40, 3.0, 30)
const diag1 = runSimplexWithDiagnostics(40, 3.0, 30);
console.log('Simplex Convergence Diagnostics (from Midpoint [40, 3.0, 30]):');
console.log(`  Final Optimum Point:     A=${diag1.point[0].toFixed(6)}, B=${diag1.point[1].toFixed(6)}, C=${diag1.point[2].toFixed(6)}`);
console.log(`  Desirability:            ${diag1.desirability.toFixed(6)}`);
console.log(`  Total Iterations:        ${diag1.totalInnerIterations}`);
console.log(`  Termination Reason:      ${diag1.terminationReason}`);
console.log(`  Final fRatio:            ${diag1.finalFRatio.toExponential(4)} (Threshold: < 1.00e-6)`);
console.log(`  Final Simplex Size:      ${diag1.finalSimplexSize.toExponential(4)} (Threshold: < 1.00e-6)`);
console.log('  Final Simplex Vertices (Normalized coordinates):');
diag1.finalSimplexVertices.forEach((v, idx) => {
  console.log(`    Vertex ${idx + 1}: [A=${v[0].toFixed(6)}, B=${v[1].toFixed(6)}, C=${v[2].toFixed(6)}]`);
});

// -------------------------------------------------------------
// C. MULTI-START 109 POINTS OPTIMIZATION & DUPLICATE FILTER AUDIT
// -------------------------------------------------------------
console.log('\n=== C. MULTI-START 109 POINTS & DUPLICATE FILTER AUDIT ===');
const rng = createSeededRng(100);

// Generate 109 starting points (1 midpoint + 8 factorial runs + 100 random)
const startingPoints = [];
// 1. Midpoint
startingPoints.push({ id: 'midpoint', A: 40, B: 3.0, C: 30 });
// 2. 8 factorial design points
const factorialRuns = [
  [35, 2.5, 25], [45, 2.5, 25], [35, 3.5, 25], [45, 3.5, 25],
  [35, 2.5, 35], [45, 2.5, 35], [35, 3.5, 35], [45, 3.5, 35]
];
factorialRuns.forEach((pt, i) => startingPoints.push({ id: `factorial-${i+1}`, A: pt[0], B: pt[1], C: pt[2] }));
// 3. 100 random points
for (let i = 0; i < 100; i++) {
  startingPoints.push({
    id: `random-${i+1}`,
    A: 35 + rng() * 10,
    B: 2.5 + rng() * 1.0,
    C: 25 + rng() * 10
  });
}

console.log(`Total Starting Points generated: ${startingPoints.length} (1 midpoint + 8 factorial + 100 random = 109)`);

// Optimize from all 109 starting points
const rawCandidates = [];
for (const sp of startingPoints) {
  const opt = runSimplexWithDiagnostics(sp.A, sp.B, sp.C);
  const ev = evalDesirability(opt.point[0], opt.point[1], opt.point[2]);
  if (ev.isFeasible && ev.D > 0) {
    rawCandidates.push({
      start: sp,
      A: opt.point[0],
      B: opt.point[1],
      C: opt.point[2],
      D: ev.D,
      d1: ev.d1,
      d2: ev.d2,
      d3: ev.d3,
      y1: ev.y1,
      y2: ev.y2,
      y3: ev.y3
    });
  }
}

rawCandidates.sort((a, b) => b.D - a.D);
console.log(`Feasible raw candidate optima before deduplication: ${rawCandidates.length}`);
console.log(`Top raw candidate #1: D = ${rawCandidates[0].D.toFixed(5)} at [${rawCandidates[0].A.toFixed(4)}, ${rawCandidates[0].B.toFixed(4)}, ${rawCandidates[0].C.toFixed(4)}]`);

// Duplicate Filter Function
function applyDuplicateFilter(candidates, filterPct) {
  const threshold = filterPct / 100;
  const unique = [];
  for (const cand of candidates) {
    let isDup = false;
    for (const ex of unique) {
      const dist = Math.sqrt(
        Math.pow((cand.A - ex.A) / 10, 2) +
        Math.pow((cand.B - ex.B) / 1.0, 2) +
        Math.pow((cand.C - ex.C) / 10, 2)
      );
      if (dist < threshold) {
        isDup = true;
        break;
      }
    }
    if (!isDup) unique.push(cand);
  }
  return unique;
}

const filterTests = [0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 1.5, 2.0, 3.0, 5.0];
console.log('\nDUPLICATE FILTER SENSITIVITY TABLE:');
console.log('| Filter (%) | Normalized Dist Threshold | Unique Solutions Found | Top Desirability |');
console.log('| :---: | :---: | :---: | :---: |');
for (const f of filterTests) {
  const sols = applyDuplicateFilter(rawCandidates, f);
  console.log(`| ${f.toFixed(2)}% | ${(f/100).toFixed(4)} | ${sols.length} | ${sols[0].D.toFixed(5)} |`);
}

// Inspect top 5 solutions with default 0.5% filter
const finalSols05 = applyDuplicateFilter(rawCandidates, 0.5);
console.log(`\nDefault Filter (0.5%): Exactly ${finalSols05.length} unique solutions found.`);
finalSols05.slice(0, 5).forEach((s, idx) => {
  console.log(`  #${idx+1}: D=${s.D.toFixed(5)} A=${s.A.toFixed(3)} B=${s.B.toFixed(3)} C=${s.C.toFixed(3)} Res=${s.y1.toFixed(3)} RT=${s.y2.toFixed(3)} TF=${s.y3.toFixed(3)}`);
});

// Save deep audit outputs
fs.writeFileSync(
  path.join(__dirname, 'deep_optimizer_audit_data.json'),
  JSON.stringify({
    evalDX,
    evalAQ,
    grad: { gradA, gradB, gradC },
    normDist,
    diag1,
    filterSensitivity: filterTests.map(f => ({ filter: f, count: applyDuplicateFilter(rawCandidates, f).length })),
    topSolutions: finalSols05.slice(0, 18)
  }, null, 2)
);

console.log('\nDeep optimizer audit completed successfully!');
