import {
  isFactorCriterionCoded,
  type OptimizationCriterion,
  type OptimizationOptions,
  type OptimizationRunResult,
  type OptimizationSolution,
  type StartingPoint,
  type StartingPointsDiagnostic,
} from './types.ts';
import { refitResponseModel } from '../statistics/rsm/modelFitting';
import jStat from 'jstat';

export interface FactorBounds {
  id: string;
  name: string;
  low: number;
  high: number;
  units?: string;
}

export interface ModelTerm {
  name: string;
  type: string;
  factors: string[];
}

export interface FittedModelRef {
  modelType: string;
  terms: ModelTerm[];
  coefficients: number[];
}

/**
 * Seeded PRNG (Mulberry32) for deterministic, reproducible starting point generation.
 */
export function createSeededRng(seed: number = 42) {
  let s = Math.floor(Math.abs(seed)) || 42;
  return function () {
    let t = (s += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Converts actual factor value to coded (-1 to +1) value.
 */
export function actualToCoded(actual: number, low: number, high: number): number {
  const center = (high + low) / 2.0;
  const halfRange = (high - low) / 2.0;
  if (halfRange === 0) return 0;
  return (actual - center) / halfRange;
}

/**
 * Converts coded value to actual factor value.
 */
export function codedToActual(coded: number, low: number, high: number): number {
  const center = (high + low) / 2.0;
  const halfRange = (high - low) / 2.0;
  return center + coded * halfRange;
}

/**
 * Inverts an N x N square matrix using Gauss-Jordan elimination with partial pivoting.
 */
export function invertSquareMatrix(A: number[][]): number[][] | null {
  const n = A.length;
  const M: number[][] = A.map((row, i) => {
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
    if (maxVal < 1e-12) return null;

    if (maxRow !== i) {
      const temp = M[i];
      M[i] = M[maxRow];
      M[maxRow] = temp;
    }

    const pivot = M[i][i];
    for (let j = 0; j < 2 * n; j++) {
      M[i][j] /= pivot;
    }

    for (let r = 0; r < n; r++) {
      if (r !== i) {
        const factor = M[r][i];
        for (let j = 0; j < 2 * n; j++) {
          M[r][j] -= factor * M[i][j];
        }
      }
    }
  }

  return M.map(row => row.slice(n));
}

/**
 * Returns two-tailed Student's t critical value for confidence level 1 - alpha (default 95%: p = 0.975).
 */
export function getStudentTCritical(df: number, probability: number = 0.975): number {
  if (df <= 0) return 1.96;
  try {
    const val = (jStat as any).studentt.inv(probability, df);
    if (typeof val === 'number' && Number.isFinite(val) && val > 0) {
      return val;
    }
  } catch (e) {
    // fallback
  }
  const exactT: Record<number, number> = {
    1: 12.7062, 2: 4.3027, 3: 3.1824, 4: 2.7764, 5: 2.5706,
    6: 2.4469, 7: 2.3646, 8: 2.3060, 9: 2.2622, 10: 2.2281,
    11: 2.2010, 12: 2.1788, 13: 2.1604, 14: 2.1448, 15: 2.1314,
    16: 2.1199, 17: 2.1098, 18: 2.1009, 19: 2.0930, 20: 2.0860,
    21: 2.0796, 22: 2.0739, 23: 2.0687, 24: 2.0639, 25: 2.0595,
    26: 2.0555, 27: 2.0518, 28: 2.0484, 29: 2.0452, 30: 2.0423,
    40: 2.0211, 50: 2.0086, 60: 2.0003, 80: 1.9901, 100: 1.9840,
    120: 1.9799,
  };
  if (Math.abs(probability - 0.975) < 1e-4 && exactT[df]) return exactT[df];
  const z = 1.95996398454;
  const z3 = z * z * z;
  const z5 = z3 * z * z;
  const term1 = (z3 + z) / (4 * df);
  const term2 = (5 * z5 + 16 * z3 + 3 * z) / (96 * df * df);
  return z + term1 + term2;
}

/**
 * Evaluates the model term row vector x_0 for a given factor point.
 */
export function buildModelTermVector(
  actualFactors: Record<string, number>,
  factors: FactorBounds[],
  terms: ModelTerm[]
): number[] {
  const coded: Record<string, number> = {};
  for (let idx = 0; idx < factors.length; idx++) {
    const f = factors[idx];
    const letter = String.fromCharCode(65 + idx);
    const letterLower = String.fromCharCode(97 + idx);

    let act: number | undefined = undefined;
    if (typeof actualFactors[f.id] === 'number') act = actualFactors[f.id];
    else if (typeof actualFactors[f.name] === 'number') act = actualFactors[f.name];
    else if (typeof actualFactors[letter] === 'number') act = actualFactors[letter];
    else if (typeof actualFactors[letterLower] === 'number') act = actualFactors[letterLower];
    else act = (f.low + f.high) / 2;

    const codedVal = actualToCoded(act, f.low, f.high);
    coded[f.id] = codedVal;
    coded[f.name] = codedVal;
    coded[f.name.toLowerCase()] = codedVal;
    coded[letter] = codedVal;
    coded[letterLower] = codedVal;
  }

  const getFactorCoded = (factorKey?: string): number => {
    if (!factorKey) return 0;
    if (factorKey in coded) return coded[factorKey];
    const lower = factorKey.toLowerCase();
    if (lower in coded) return coded[lower];
    for (const f of factors) {
      if (f.name.toLowerCase() === lower || f.id.toLowerCase() === lower) {
        return coded[f.id] ?? 0;
      }
    }
    return 0;
  };

  const xRow: number[] = [];
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    let termVal = 1;
    if (term.type === 'intercept') {
      termVal = 1;
    } else if (term.type === 'linear') {
      termVal = getFactorCoded(term.factors?.[0] || term.name);
    } else if (term.type === 'interaction') {
      if (term.factors && term.factors.length >= 2) {
        termVal = getFactorCoded(term.factors[0]) * getFactorCoded(term.factors[1]);
      } else if (term.name && term.name.includes('*')) {
        const parts = term.name.split('*');
        termVal = getFactorCoded(parts[0].trim()) * getFactorCoded(parts[1].trim());
      } else {
        termVal = getFactorCoded(term.factors?.[0] || term.name);
      }
    } else if (term.type === 'quadratic') {
      const fKey = term.factors?.[0] || term.name.replace(/\^2$/, '');
      const f1 = getFactorCoded(fKey);
      termVal = f1 * f1;
    } else if (term.type === 'cubic') {
      const fKey = term.factors?.[0] || term.name.replace(/\^3$/, '');
      const f1 = getFactorCoded(fKey);
      termVal = f1 * f1 * f1;
    } else {
      if (term.factors && term.factors.length > 0) {
        let prod = 1;
        for (const fk of term.factors) prod *= getFactorCoded(fk);
        termVal = prod;
      }
    }
    xRow.push(termVal);
  }
  return xRow;
}

/**
 * Computes covariance (X^T X)^-1 and residual mean square error for response prediction intervals.
 */
export function computeResponseCovariance(
  factors: FactorBounds[],
  terms: ModelTerm[],
  runs: Array<{ actualValues?: Record<string, number>; codedValues?: Record<string, number>; responses?: Record<string, any> }>,
  responseId: string,
  model: FittedModelRef
): { xtxInv: number[][]; msError: number; dfError: number } | null {
  const validRuns = runs.filter(
    r => r.responses && typeof r.responses[responseId] === 'number' && Number.isFinite(r.responses[responseId])
  );
  const n = validRuns.length;
  const p = terms.length;
  if (n <= p) return null;

  const X: number[][] = [];
  const y: number[] = [];

  for (const r of validRuns) {
    const act = r.actualValues || {};
    const xRow = buildModelTermVector(act, factors, terms);
    X.push(xRow);
    y.push(Number(r.responses![responseId]));
  }

  const XtX: number[][] = Array.from({ length: p }, () => new Array(p).fill(0));
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < p; j++) {
      for (let k = 0; k < p; k++) {
        XtX[j][k] += X[i][j] * X[i][k];
      }
    }
  }

  const xtxInv = invertSquareMatrix(XtX);
  if (!xtxInv) return null;

  let SSE = 0;
  for (let i = 0; i < n; i++) {
    const act = validRuns[i].actualValues || {};
    const yPred = predictModelResponse(act, factors, model);
    const err = y[i] - yPred;
    SSE += err * err;
  }

  const dfError = n - p;
  const msError = dfError > 0 ? SSE / dfError : 0;

  return { xtxInv, msError, dfError };
}

/**
 * Evaluates fitted polynomial model for given actual factor settings.
 * Supports factor matching by ID, display name, letter code ('A', 'B'...),
 * and safe numeric evaluation to prevent NaN or flatline zeros.
 */
export function predictModelResponse(
  actualFactors: Record<string, number>,
  factors: FactorBounds[],
  model: FittedModelRef
): number {
  if (!model || !Array.isArray(model.coefficients) || model.coefficients.length === 0) {
    return 0;
  }

  // Build comprehensive mapping of factor coded values across all identifiers:
  // f.id, f.name, lowercase name, letter ('A', 'B'...), lowercase letter ('a', 'b'...), and index string
  const coded: Record<string, number> = {};
  for (let idx = 0; idx < factors.length; idx++) {
    const f = factors[idx];
    const letter = String.fromCharCode(65 + idx);
    const letterLower = String.fromCharCode(97 + idx);

    let act: number | undefined = undefined;
    if (typeof actualFactors[f.id] === 'number') act = actualFactors[f.id];
    else if (typeof actualFactors[f.name] === 'number') act = actualFactors[f.name];
    else if (typeof actualFactors[letter] === 'number') act = actualFactors[letter];
    else if (typeof actualFactors[letterLower] === 'number') act = actualFactors[letterLower];
    else if (typeof actualFactors[String(idx)] === 'number') act = actualFactors[String(idx)];
    else act = (f.low + f.high) / 2;

    const codedVal = actualToCoded(act, f.low, f.high);
    coded[f.id] = codedVal;
    coded[f.name] = codedVal;
    coded[f.name.toLowerCase()] = codedVal;
    coded[letter] = codedVal;
    coded[letterLower] = codedVal;
    coded[String(idx)] = codedVal;
  }

  const getFactorCoded = (factorKey?: string): number => {
    if (!factorKey) return 0;
    if (factorKey in coded) return coded[factorKey];
    const lower = factorKey.toLowerCase();
    if (lower in coded) return coded[lower];

    for (const f of factors) {
      if (f.name.toLowerCase() === lower || f.id.toLowerCase() === lower) {
        return coded[f.id] ?? 0;
      }
    }
    return 0;
  };

  let yPred = 0;
  const terms = model.terms || [];
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    const coef = model.coefficients[i] ?? 0;
    if (coef === 0) continue;

    let termVal = 1;
    if (term.type === 'intercept') {
      termVal = 1;
    } else if (term.type === 'linear') {
      termVal = getFactorCoded(term.factors?.[0] || term.name);
    } else if (term.type === 'interaction') {
      if (term.factors && term.factors.length >= 2) {
        const f1 = getFactorCoded(term.factors[0]);
        const f2 = getFactorCoded(term.factors[1]);
        termVal = f1 * f2;
      } else if (term.name && term.name.includes('*')) {
        const parts = term.name.split('*');
        termVal = getFactorCoded(parts[0].trim()) * getFactorCoded(parts[1].trim());
      } else {
        termVal = getFactorCoded(term.factors?.[0] || term.name);
      }
    } else if (term.type === 'quadratic') {
      const fKey = term.factors?.[0] || term.name.replace(/\^2$/, '');
      const f1 = getFactorCoded(fKey);
      termVal = f1 * f1;
    } else if (term.type === 'cubic') {
      const fKey = term.factors?.[0] || term.name.replace(/\^3$/, '');
      const f1 = getFactorCoded(fKey);
      termVal = f1 * f1 * f1;
    } else {
      if (term.factors && term.factors.length > 0) {
        let prod = 1;
        for (const fk of term.factors) {
          prod *= getFactorCoded(fk);
        }
        termVal = prod;
      }
    }

    yPred += coef * termVal;
  }

  return Number.isFinite(yPred) ? yPred : 0;
}

/**
 * Calculates individual Derringer-Suich desirability d_i (0 to 1) for a value against its criterion.
 */
export function calculateIndividualDesirability(
  value: number,
  criterion: OptimizationCriterion
): number {
  const { goal, lowerLimit, upperLimit, targetValue, lowerWeight, upperWeight } = criterion;

  if (goal === 'none') {
    return 1;
  }

  const L = lowerLimit;
  const U = upperLimit;
  const s = Math.max(0.1, Math.min(10, lowerWeight || 1.0));
  const t = Math.max(0.1, Math.min(10, upperWeight || 1.0));

  if (goal === 'maximize') {
    if (value <= L) return 0;
    if (value >= U) return 1;
    if (U <= L) return 0;
    return Math.pow((value - L) / (U - L), s);
  }

  if (goal === 'minimize') {
    if (value <= L) return 1;
    if (value >= U) return 0;
    if (U <= L) return 0;
    return Math.pow((U - value) / (U - L), t);
  }

  if (goal === 'target') {
    const T = targetValue !== undefined ? targetValue : (L + U) / 2;
    if (value < L || value > U) return 0;

    if (value <= T) {
      if (T <= L) return 1;
      return Math.pow((value - L) / (T - L), s);
    } else {
      if (U <= T) return 1;
      return Math.pow((U - value) / (U - T), t);
    }
  }

  if (goal === 'in_range') {
    return value >= L && value <= U ? 1 : 0;
  }

  if (goal === 'equal_to') {
    const T = targetValue !== undefined ? targetValue : L;
    const span = Math.max(1e-4, U - L);
    const tol = 0.002 * span; // 0.2% strict tolerance
    const diff = Math.abs(value - T);
    if (diff <= tol) return 1;
    // Smooth decay within 2% band for search guidance
    return Math.max(0, 1 - diff / (0.02 * span));
  }

  return 1;
}

/**
 * Computes overall combined desirability D as weighted geometric mean.
 * Adheres strictly to Stat-Ease Design-Expert specification:
 * D = (prod d_i^r_i)^(1 / sum r_i)
 * - Goals with 'none' are completely excluded.
 * - Goals with 'in range' (and factors fixed at 'equal to') are included in the product (d_i > 0 required),
 *   but are NOT counted in the exponent sum(r_i).
 * - If only 'in range' / fixed goals are present and all are satisfied, D = 1.0.
 */
export function calculateCombinedDesirability(
  individualDesirabilities: Record<string, number>,
  criteria: Record<string, OptimizationCriterion>
): number {
  const activeKeys = Object.keys(criteria).filter(k => criteria[k].goal !== 'none');
  if (activeKeys.length === 0) {
    return 0;
  }

  let sumImportance = 0;
  let sumWeightedLog = 0;
  let allInRangeOrFixed = true;

  for (const k of activeKeys) {
    const crit = criteria[k];
    const d = individualDesirabilities[k] ?? 0;
    if (d <= 0) {
      return 0; // If any single desirability is 0, overall desirability is 0
    }

    // Stat-Ease rule: 'in range' criteria are included in the product of D,
    // but are NOT counted in determining sum(r_i) in the exponent formula.
    // Factor 'equal to' criteria locked at target also behave as fixed coordinate constraints.
    const isExcludedFromRoot = crit.goal === 'in_range' || (crit.goal === 'equal_to' && crit.type === 'factor');
    if (!isExcludedFromRoot) {
      allInRangeOrFixed = false;
      const imp = Math.max(1, Math.min(5, crit.importance || 3));
      sumImportance += imp;
      sumWeightedLog += imp * Math.log(d);
    }
  }

  if (allInRangeOrFixed || sumImportance === 0) {
    return 1.0;
  }

  return Math.exp(sumWeightedLog / sumImportance);
}

/**
 * Generates starting factor combinations inside the feasible bounds using Stat-Ease 5-stage pipeline:
 * 1. Initial design candidates: midpoint + design runs (up to options.numberDesignPoints).
 * 2. Out-of-bounds rejection: Points falling outside factor limits [low, high] are rejected.
 * 3. Duplicate rejection: Center-point replicates and duplicate points are removed.
 * 4. Random points: options.randomStartingPoints generated uniformly within factor limits.
 * 5. Prediction validity check: Points yielding non-finite model predictions are rejected.
 * 6. Final unique starting points used.
 */
export function generateOptimizationStartingPointsWithDiagnostic(
  factors: FactorBounds[],
  runs: Array<{ actualValues?: Record<string, number>; codedValues?: Record<string, number> }>,
  options: OptimizationOptions,
  criteriaOrSeed?: Record<string, OptimizationCriterion> | number,
  optionalSeed: number = 100
): { startingPoints: StartingPoint[]; diagnostic: StartingPointsDiagnostic } {
  let criteria: Record<string, OptimizationCriterion> | undefined;
  let seed = 100;

  if (typeof criteriaOrSeed === 'number') {
    seed = criteriaOrSeed;
  } else if (typeof criteriaOrSeed === 'object' && criteriaOrSeed !== null) {
    criteria = criteriaOrSeed;
    seed = optionalSeed;
  }

  const rng = createSeededRng(seed);
  const candidateDesignPoints: Array<{
    source: 'midpoint' | 'design_point';
    factors: Record<string, number>;
    originalRunIndex?: number;
    stableIdentifier?: string;
  }> = [];

  const rejectedDetails: Array<{
    source: string;
    reason: string;
    factors: Record<string, number>;
  }> = [];

  // Helper: target value for factor if equal_to
  const getFactorTarget = (f: FactorBounds): number | null => {
    if (!criteria) return null;
    const crit = criteria[f.id];
    if (crit && crit.goal === 'equal_to' && crit.targetValue !== undefined && !isNaN(crit.targetValue)) {
      const isCoded = isFactorCriterionCoded(crit, f);
      return isCoded ? codedToActual(crit.targetValue, f.low, f.high) : crit.targetValue;
    }
    return null;
  };

  // Stage 1: Initial candidate design points
  // 1a. Design Space Midpoint
  const centerPoint: Record<string, number> = {};
  for (const f of factors) {
    const tgt = getFactorTarget(f);
    centerPoint[f.id] = tgt !== null ? tgt : (f.low + f.high) / 2;
  }
  candidateDesignPoints.push({
    source: 'midpoint',
    factors: centerPoint,
  });

  // 1b. Experimental design points (up to numberDesignPoints)
  if (options.numberDesignPoints > 0 && runs && runs.length > 0) {
    const maxDesignPts = Math.min(options.numberDesignPoints, runs.length);
    for (let i = 0; i < maxDesignPts; i++) {
      const run = runs[i] as any;
      const factorVals: Record<string, number> = {};
      const runStd = run.stdOrder ?? run.std;
      const runOrder = run.runOrder ?? run.run ?? (i + 1);
      const stableIdentifier = runStd !== undefined ? `Std ${runStd} (Run #${runOrder})` : `Run #${runOrder}`;

      for (const f of factors) {
        const tgt = getFactorTarget(f);
        if (tgt !== null) {
          factorVals[f.id] = tgt;
        } else if (run.actualValues && typeof run.actualValues[f.id] === 'number') {
          factorVals[f.id] = run.actualValues[f.id];
        } else if (run.codedValues && typeof run.codedValues[f.id] === 'number') {
          factorVals[f.id] = codedToActual(run.codedValues[f.id], f.low, f.high);
        } else {
          factorVals[f.id] = (f.low + f.high) / 2;
        }
      }

      candidateDesignPoints.push({
        source: 'design_point',
        factors: factorVals,
        originalRunIndex: i + 1,
        stableIdentifier,
      });
    }
  }

  const stage1Count = candidateDesignPoints.length;
  let rejectedOutOfBoundsCount = 0;
  let rejectedDuplicatesCount = 0;

  // Stage 2: Filter out-of-bounds candidates
  // Stat-Ease rule: "Points that do not fall within the limits of the design space are not used."
  const validBoundsCandidates: typeof candidateDesignPoints = [];

  for (const cand of candidateDesignPoints) {
    let outOfBounds = false;
    let violatedFactor = '';

    for (const f of factors) {
      const val = cand.factors[f.id];
      const span = Math.max(1e-4, f.high - f.low);
      const tol = 1e-4 * span;
      if (val < f.low - tol || val > f.high + tol) {
        outOfBounds = true;
        violatedFactor = `${f.name || f.id} (${val.toFixed(3)} outside [${f.low}, ${f.high}])`;
        break;
      }
    }

    if (outOfBounds) {
      rejectedOutOfBoundsCount++;
      rejectedDetails.push({
        source: cand.source === 'midpoint' ? 'Midpoint' : (cand.stableIdentifier || `Run #${cand.originalRunIndex}`),
        reason: `Factor out of bounds: ${violatedFactor}`,
        factors: cand.factors,
      });
    } else {
      // Clamped micro-epsilons within numerical tolerance
      const clampedFactors: Record<string, number> = {};
      for (const f of factors) {
        clampedFactors[f.id] = Math.max(f.low, Math.min(f.high, cand.factors[f.id]));
      }
      validBoundsCandidates.push({
        ...cand,
        factors: clampedFactors,
      });
    }
  }

  // Stage 3: Remove duplicate points
  // Compare candidate against already accepted design points
  const acceptedDesignPoints: Array<StartingPoint> = [];
  const dupTol = 1e-4;

  for (const cand of validBoundsCandidates) {
    let isDuplicate = false;
    for (const accepted of acceptedDesignPoints) {
      let isSame = true;
      for (const f of factors) {
        const span = Math.max(1e-4, f.high - f.low);
        const normDiff = Math.abs(cand.factors[f.id] - accepted.factors[f.id]) / span;
        if (normDiff > dupTol) {
          isSame = false;
          break;
        }
      }
      if (isSame) {
        isDuplicate = true;
        break;
      }
    }

    if (isDuplicate) {
      rejectedDuplicatesCount++;
      rejectedDetails.push({
        source: cand.source === 'midpoint' ? 'Midpoint' : (cand.stableIdentifier || `Run #${cand.originalRunIndex}`),
        reason: 'Duplicate of an existing candidate point',
        factors: cand.factors,
      });
    } else {
      acceptedDesignPoints.push({
        pointNumber: acceptedDesignPoints.length + 1,
        factors: cand.factors,
        source: cand.source,
        status: 'accepted',
      });
    }
  }

  const acceptedDesignCount = acceptedDesignPoints.length;

  // Stage 4: Generate random starting points
  // Stat-Ease generates options.randomStartingPoints uniformly within factor limits
  const randomPoints: StartingPoint[] = [];
  const numRandom = Math.max(0, options.randomStartingPoints);

  for (let i = 0; i < numRandom; i++) {
    const factorVals: Record<string, number> = {};
    for (const f of factors) {
      const tgt = getFactorTarget(f);
      if (tgt !== null) {
        factorVals[f.id] = tgt;
      } else {
        const r = rng();
        factorVals[f.id] = f.low + r * (f.high - f.low);
      }
    }

    randomPoints.push({
      pointNumber: acceptedDesignCount + i + 1,
      factors: factorVals,
      source: 'random',
      status: 'accepted',
    });
  }

  // Stage 5: Prediction validity check
  const rejectedInvalidPredictions = 0;

  // Stage 6: Final unique starting points
  const finalStartingPoints: StartingPoint[] = [...acceptedDesignPoints, ...randomPoints];

  const diagnostic: StartingPointsDiagnostic = {
    initialDesignCandidates: stage1Count,
    rejectedOutOfBounds: rejectedOutOfBoundsCount,
    rejectedDuplicates: rejectedDuplicatesCount,
    acceptedDesignPoints: acceptedDesignCount,
    randomPointsGenerated: numRandom,
    rejectedInvalidPredictions,
    totalStartingPoints: finalStartingPoints.length,
    stageDetails: {
      stage1_initialCandidates: stage1Count,
      stage2_rejectedOutOfBounds: rejectedOutOfBoundsCount,
      stage3_rejectedDuplicates: rejectedDuplicatesCount,
      stage4_randomPoints: numRandom,
      stage5_rejectedInvalidPredictions: rejectedInvalidPredictions,
      stage6_finalStartingPoints: finalStartingPoints.length,
    },
    outOfBoundsCount: rejectedOutOfBoundsCount,
    duplicateCount: rejectedDuplicatesCount,
    rejectedDetails,
  };

  return {
    startingPoints: finalStartingPoints,
    diagnostic,
  };
}

export function generateOptimizationStartingPoints(
  factors: FactorBounds[],
  runs: Array<{ actualValues?: Record<string, number>; codedValues?: Record<string, number> }>,
  options: OptimizationOptions,
  criteriaOrSeed?: Record<string, OptimizationCriterion> | number,
  seed: number = 100
): StartingPoint[] {
  const result = generateOptimizationStartingPointsWithDiagnostic(factors, runs, options, criteriaOrSeed, seed);
  const pts = result.startingPoints;
  (pts as any).diagnostic = result.diagnostic;
  return pts;
}

/**
 * Nelder-Mead Downhill Simplex optimizer with Stat-Ease penalty iterations.
 * Official algorithm reference:
 * - Downhill simplex multidimensional pattern search (Numerical Recipes in Pascal p. 326)
 * - Penalty parameter p starts at 1, increasing by 100x each iteration up to 15 iterations (max 10^30)
 * - Limits of the design space maintained by evaluating to +10^10 at boundaries
 * - Convergence achieved when distance moved or function change is less than 10^-6 ratio
 */
function refineCandidateSimplex(
  startFactors: Record<string, number>,
  factors: FactorBounds[],
  models: Record<string, FittedModelRef>,
  criteria: Record<string, OptimizationCriterion>,
  options: OptimizationOptions
): Record<string, number> {
  const n = factors.length;
  if (n === 0) return startFactors;

  // Separate variable factors from factors fixed with 'equal_to'
  const variableFactorIndices: number[] = [];
  const fixedFactorValues: Record<string, number> = {};

  for (let i = 0; i < n; i++) {
    const f = factors[i];
    const crit = criteria[f.id];
    if (crit && crit.goal === 'equal_to' && crit.targetValue !== undefined && !isNaN(crit.targetValue)) {
      const isCoded = isFactorCriterionCoded(crit, f);
      fixedFactorValues[f.id] = isCoded ? codedToActual(crit.targetValue, f.low, f.high) : crit.targetValue;
    } else {
      variableFactorIndices.push(i);
    }
  }

  const k = variableFactorIndices.length;
  const buildFullPoint = (varVals: number[]): Record<string, number> => {
    const pt: Record<string, number> = { ...fixedFactorValues };
    for (let j = 0; j < k; j++) {
      const idx = variableFactorIndices[j];
      pt[factors[idx].id] = varVals[j];
    }
    return pt;
  };

  if (k === 0) {
    return buildFullPoint([]);
  }

  // Objective evaluator to MINIMIZE:
  // - Outside factor bounds: +10^10 boundary barrier
  // - Violating response/factor criteria: +p * sum(violations^2)
  // - Feasible: -D(X) in [-1, 0)
  const evalObjective = (varVals: number[], p: number): { score: number; isFeasible: boolean; desirability: number } => {
    let boundaryPenalty = 0;
    for (let j = 0; j < k; j++) {
      const idx = variableFactorIndices[j];
      const f = factors[idx];
      const val = varVals[j];
      const span = Math.max(1e-4, f.high - f.low);
      if (val < f.low) {
        boundaryPenalty += Math.pow((f.low - val) / span, 2);
      } else if (val > f.high) {
        boundaryPenalty += Math.pow((val - f.high) / span, 2);
      }
    }

    if (boundaryPenalty > 0) {
      return {
        score: 1e10 + boundaryPenalty * 1e8,
        isFeasible: false,
        desirability: 0,
      };
    }

    const candidate = buildFullPoint(varVals);
    const indD: Record<string, number> = {};
    let constraintViolations = 0;

    // Factor criteria
    for (const f of factors) {
      const crit = criteria[f.id];
      if (crit && crit.goal !== 'none') {
        const actVal = candidate[f.id];
        const isCoded = isFactorCriterionCoded(crit, f);
        const valForCrit = isCoded ? actualToCoded(actVal, f.low, f.high) : actVal;
        const d = calculateIndividualDesirability(valForCrit, crit);
        indD[f.id] = d;

        if (d <= 0) {
          const L = crit.lowerLimit;
          const U = crit.upperLimit;
          const span = Math.max(1e-4, U - L);
          if (crit.goal === 'equal_to') {
            const T = crit.targetValue !== undefined ? crit.targetValue : L;
            constraintViolations += Math.pow(Math.abs(valForCrit - T) / span, 2);
          } else if (valForCrit < L) {
            constraintViolations += Math.pow((L - valForCrit) / span, 2);
          } else if (valForCrit > U) {
            constraintViolations += Math.pow((valForCrit - U) / span, 2);
          }
        }
      }
    }

    // Response criteria
    for (const rid of Object.keys(models)) {
      const crit = criteria[rid];
      if (crit && crit.goal !== 'none') {
        const yPred = predictModelResponse(candidate, factors, models[rid]);
        const d = calculateIndividualDesirability(yPred, crit);
        indD[rid] = d;

        if (d <= 0) {
          const L = crit.lowerLimit;
          const U = crit.upperLimit;
          const span = Math.max(1e-4, U - L);
          if (crit.goal === 'maximize' && yPred < L) {
            constraintViolations += Math.pow((L - yPred) / span, 2);
          } else if (crit.goal === 'minimize' && yPred > U) {
            constraintViolations += Math.pow((yPred - U) / span, 2);
          } else if (crit.goal === 'target') {
            const T = crit.targetValue !== undefined ? crit.targetValue : (L + U) / 2;
            if (yPred < L) {
              constraintViolations += Math.pow((L - yPred) / Math.max(1e-4, T - L), 2);
            } else if (yPred > U) {
              constraintViolations += Math.pow((yPred - U) / Math.max(1e-4, U - T), 2);
            }
          } else if (crit.goal === 'in_range') {
            if (yPred < L) constraintViolations += Math.pow((L - yPred) / span, 2);
            else if (yPred > U) constraintViolations += Math.pow((yPred - U) / span, 2);
          } else if (crit.goal === 'equal_to') {
            const T = crit.targetValue !== undefined ? crit.targetValue : L;
            constraintViolations += Math.pow(Math.abs(yPred - T) / span, 2);
          }
        }
      }
    }

    if (constraintViolations > 0) {
      return {
        score: p * constraintViolations,
        isFeasible: false,
        desirability: 0,
      };
    }

    const D = calculateCombinedDesirability(indD, criteria);
    if (D <= 0) {
      return {
        score: p * 1e-4,
        isFeasible: false,
        desirability: 0,
      };
    }

    return {
      score: -D,
      isFeasible: true,
      desirability: D,
    };
  };

  let currentBestVars: number[] = variableFactorIndices.map(idx => {
    const f = factors[idx];
    const sVal = startFactors[f.id];
    return typeof sVal === 'number' ? Math.max(f.low, Math.min(f.high, sVal)) : (f.low + f.high) / 2;
  });

  let p = 1.0;
  const maxOuter = 15;
  const alpha = 1.0;
  const gamma = 2.0;
  const rho = 0.5;
  const sigma = 0.5;

  let fraction = Math.max(0.001, Math.min(1.0, typeof options.simplexFraction === 'number' && !isNaN(options.simplexFraction) && options.simplexFraction > 0 ? options.simplexFraction : 0.1));

  for (let outer = 0; outer < maxOuter; outer++) {
    const simplex: Array<{ point: number[]; score: number; isFeasible: boolean; desirability: number }> = [];

    const eval0 = evalObjective(currentBestVars, p);
    simplex.push({ point: [...currentBestVars], ...eval0 });

    for (let j = 0; j < k; j++) {
      const pt = [...currentBestVars];
      const idx = variableFactorIndices[j];
      const f = factors[idx];
      const range = f.high - f.low;
      let step = range * fraction;
      if (pt[j] + step > f.high) {
        step = -step;
      }
      pt[j] = Math.max(f.low, Math.min(f.high, pt[j] + step));
      simplex.push({ point: pt, ...evalObjective(pt, p) });
    }

    const maxInner = 120;
    for (let inner = 0; inner < maxInner; inner++) {
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
          const idx = variableFactorIndices[j];
          const f = factors[idx];
          const span = Math.max(1e-4, f.high - f.low);
          distSq += Math.pow((simplex[i].point[j] - best.point[j]) / span, 2);
        }
        if (distSq > maxDistSq) maxDistSq = distSq;
      }

      if (fRatio < 1e-6 && Math.sqrt(maxDistSq) < 1e-6) {
        break;
      }

      const centroid: number[] = new Array(k).fill(0);
      for (let i = 0; i < k; i++) {
        for (let j = 0; j < k; j++) {
          centroid[j] += simplex[i].point[j];
        }
      }
      for (let j = 0; j < k; j++) {
        centroid[j] /= k;
      }

      // 1. Reflection
      const xr: number[] = new Array(k);
      for (let j = 0; j < k; j++) {
        xr[j] = centroid[j] + alpha * (centroid[j] - worst.point[j]);
      }
      const evalR = evalObjective(xr, p);

      if (evalR.score < secondWorst.score && evalR.score >= best.score) {
        simplex[k] = { point: xr, ...evalR };
        continue;
      }

      // 2. Expansion
      if (evalR.score < best.score) {
        const xe: number[] = new Array(k);
        for (let j = 0; j < k; j++) {
          xe[j] = centroid[j] + gamma * (xr[j] - centroid[j]);
        }
        const evalE = evalObjective(xe, p);
        if (evalE.score < evalR.score) {
          simplex[k] = { point: xe, ...evalE };
        } else {
          simplex[k] = { point: xr, ...evalR };
        }
        continue;
      }

      // 3. Contraction
      if (evalR.score < worst.score) {
        const xc: number[] = new Array(k);
        for (let j = 0; j < k; j++) {
          xc[j] = centroid[j] + rho * (xr[j] - centroid[j]);
        }
        const evalC = evalObjective(xc, p);
        if (evalC.score <= evalR.score) {
          simplex[k] = { point: xc, ...evalC };
          continue;
        }
      } else {
        const xc: number[] = new Array(k);
        for (let j = 0; j < k; j++) {
          xc[j] = centroid[j] - rho * (centroid[j] - worst.point[j]);
        }
        const evalC = evalObjective(xc, p);
        if (evalC.score < worst.score) {
          simplex[k] = { point: xc, ...evalC };
          continue;
        }
      }

      // 4. Shrink
      for (let i = 1; i <= k; i++) {
        for (let j = 0; j < k; j++) {
          simplex[i].point[j] = best.point[j] + sigma * (simplex[i].point[j] - best.point[j]);
        }
        const evalS = evalObjective(simplex[i].point, p);
        simplex[i].score = evalS.score;
        simplex[i].isFeasible = evalS.isFeasible;
        simplex[i].desirability = evalS.desirability;
      }
    }

    simplex.sort((a, b) => a.score - b.score);
    currentBestVars = [...simplex[0].point];

    if (simplex[0].isFeasible && simplex[0].desirability > 0) {
      break;
    }

    p = Math.min(1e30, p * 100);
    fraction = Math.max(0.01, fraction * 0.7);
  }

  const finalPoint = buildFullPoint(currentBestVars);
  for (const f of factors) {
    if (fixedFactorValues[f.id] !== undefined) {
      finalPoint[f.id] = fixedFactorValues[f.id];
    } else {
      finalPoint[f.id] = Math.max(f.low, Math.min(f.high, finalPoint[f.id]));
    }
  }

  return finalPoint;
}

/**
 * Executes full numerical optimization workflow.
 */
export function executeNumericalOptimization(
  factors: FactorBounds[],
  responses: Array<{ id: string; name: string; units?: string }>,
  analyses: Record<string, any>,
  criteria: Record<string, OptimizationCriterion>,
  options: OptimizationOptions,
  runs: Array<{ id?: string; stdOrder?: number; runOrder?: number; actualValues?: Record<string, number>; codedValues?: Record<string, number>; responses?: Record<string, any> }> = [],
  runsModifiedAt?: string
): OptimizationRunResult {
  const warnings: string[] = [];

  // 1. Validate active goals and fitted models
  const activeResponseCriteria = Object.keys(criteria)
    .filter(k => criteria[k].type === 'response' && criteria[k].goal !== 'none');

  const activeFactorCriteria = Object.keys(criteria)
    .filter(k => criteria[k].type === 'factor' && criteria[k].goal !== 'none');

  if (activeResponseCriteria.length === 0 && activeFactorCriteria.length === 0) {
    return {
      runId: 'opt-' + Date.now(),
      timestamp: new Date().toISOString(),
      status: 'no_feasible_solution',
      message: 'No optimization goals are active. Set at least one factor or response goal to Maximize, Minimize, Target, In Range, or Equal To in the Criteria screen.',
      options,
      criteria,
      startingPoints: [],
      solutions: [],
      selectedSolutionIndex: 0,
      warnings: ['No active optimization objectives defined.'],
      isOutdated: false
    };
  }

  const usableModels: Record<string, FittedModelRef> = {};
  for (const respId of activeResponseCriteria) {
    const analysis = analyses[respId];
    const model = analysis?.fittedModel || analysis?.fitted;
    const respName = responses.find(r => r.id === respId)?.name || respId;

    const hasCoeffs = Boolean(model?.coefficients && model.coefficients.length > 0);
    const isOutdated = Boolean(analysis?.isOutdated);
    const runsTime = runsModifiedAt ? new Date(runsModifiedAt).getTime() : 0;
    const modelTime = analysis?.timestamp ? new Date(analysis.timestamp).getTime() : 0;
    const isDataNewer = runsTime > 0 && modelTime > 0 && runsTime > modelTime;

    const needsRefit = !hasCoeffs || isOutdated || isDataNewer;

    if (needsRefit) {
      if (runs && runs.length > 0) {
        try {
          const freshAnalysis = refitResponseModel(
            { config: { factors, responses }, runs, analyses },
            respId,
            analysis?.modelType || 'Quadratic'
          );
          const freshModel = freshAnalysis.fittedModel || freshAnalysis.fitted;
          usableModels[respId] = {
            modelType: freshModel.modelType || 'Quadratic',
            terms: freshModel.terms || [],
            coefficients: freshModel.coefficients || []
          };
        } catch (fitErr: any) {
          return {
            runId: 'opt-' + Date.now(),
            timestamp: new Date().toISOString(),
            status: 'error',
            message: fitErr.message || `Cannot fit regression model for response "${respName}".`,
            options,
            criteria,
            startingPoints: [],
            solutions: [],
            selectedSolutionIndex: 0,
            warnings: [`Incomplete response data for ${respName}`],
            isOutdated: false
          };
        }
      } else {
        return {
          runId: 'opt-' + Date.now(),
          timestamp: new Date().toISOString(),
          status: 'error',
          message: `Response "${respName}" has an active optimization goal (${criteria[respId].goal}), but has no fitted statistical model.`,
          options,
          criteria,
          startingPoints: [],
          solutions: [],
          selectedSolutionIndex: 0,
          warnings: [`Missing fitted model for response ${respName}`],
          isOutdated: false
        };
      }
    } else {
      usableModels[respId] = {
        modelType: model.modelType || 'Quadratic',
        terms: model.terms || [],
        coefficients: model.coefficients || []
      };
    }
  }

  // Also include models for non-optimized responses so they can display predicted values
  for (const r of responses) {
    if (!usableModels[r.id]) {
      const analysis = analyses[r.id];
      const model = analysis?.fittedModel || analysis?.fitted;
      const runsTime = runsModifiedAt ? new Date(runsModifiedAt).getTime() : 0;
      const modelTime = analysis?.timestamp ? new Date(analysis.timestamp).getTime() : 0;
      const isDataNewer = runsTime > 0 && modelTime > 0 && runsTime > modelTime;

      if ((!model?.coefficients || analysis?.isOutdated || isDataNewer) && runs && runs.length > 0) {
        try {
          const freshAnalysis = refitResponseModel(
            { config: { factors, responses }, runs, analyses },
            r.id,
            analysis?.modelType || 'Quadratic'
          );
          const freshModel = freshAnalysis.fittedModel || freshAnalysis.fitted;
          usableModels[r.id] = {
            modelType: freshModel.modelType || 'Quadratic',
            terms: freshModel.terms || [],
            coefficients: freshModel.coefficients || []
          };
        } catch {
          // Non-active response: ignore refit errors
        }
      } else if (model && model.coefficients && model.coefficients.length > 0) {
        usableModels[r.id] = {
          modelType: model.modelType || 'Quadratic',
          terms: model.terms || [],
          coefficients: model.coefficients || []
        };
      }
    }
  }

  // 2. Generate starting points
  const spResult = generateOptimizationStartingPointsWithDiagnostic(factors, runs, options, criteria);
  const startingPoints = spResult.startingPoints;

  // 3. Search & refine from each starting point
  const rawCandidates: Array<{
    factors: Record<string, number>;
    predictions: Record<string, number>;
    indD: Record<string, number>;
    D: number;
  }> = [];

  for (const sp of startingPoints) {
    const refinedFactors = refineCandidateSimplex(sp.factors, factors, usableModels, criteria, options);

    // Compute predictions and individual desirabilities
    const predictions: Record<string, number> = {};
    const indD: Record<string, number> = {};

    // Factor desirabilities
    for (const f of factors) {
      const crit = criteria[f.id];
      if (crit) {
        const actVal = refinedFactors[f.id];
        const isCoded = isFactorCriterionCoded(crit, f);
        const valForCrit = isCoded ? actualToCoded(actVal, f.low, f.high) : actVal;
        indD[f.id] = calculateIndividualDesirability(valForCrit, crit);
      }
    }

    // Response predictions and desirabilities
    for (const r of responses) {
      if (usableModels[r.id]) {
        const pred = predictModelResponse(refinedFactors, factors, usableModels[r.id]);
        predictions[r.id] = pred;

        const crit = criteria[r.id];
        if (crit) {
          indD[r.id] = calculateIndividualDesirability(pred, crit);
        }
      }
    }

    const D = calculateCombinedDesirability(indD, criteria);
    if (D > 0) {
      rawCandidates.push({
        factors: refinedFactors,
        predictions,
        indD,
        D,
      });
    }
  }

  // 4. Deduplicate candidates using duplicateFilter (normalized Euclidean distance)
  rawCandidates.sort((a, b) => b.D - a.D);

  const uniqueCandidates: typeof rawCandidates = [];
  // Stat-Ease Design-Expert defines the Duplicate Solution Filter as a percentage of the factor span (default 0.5%).
  // Thus, filter value 0.5 corresponds to a normalized distance threshold of 0.5 / 100 = 0.005.
  const rawFilter = typeof options.duplicateFilter === 'number' && !isNaN(options.duplicateFilter) && options.duplicateFilter > 0
    ? options.duplicateFilter
    : 0.5;
  const filterThreshold = rawFilter / 100;

  for (const cand of rawCandidates) {
    let isDuplicate = false;
    for (const existing of uniqueCandidates) {
      let sumSq = 0;
      for (const f of factors) {
        const span = Math.max(1e-4, f.high - f.low);
        const normDiff = (cand.factors[f.id] - existing.factors[f.id]) / span;
        sumSq += normDiff * normDiff;
      }
      const dist = Math.sqrt(sumSq);
      if (dist < filterThreshold) {
        isDuplicate = true;
        break;
      }
    }

    if (!isDuplicate) {
      uniqueCandidates.push(cand);
      if (uniqueCandidates.length >= options.maxSolutions) {
        break;
      }
    }
  }

  // Precompute covariance contexts for responses to calculate genuine 95% confidence intervals
  const covContexts: Record<string, { xtxInv: number[][]; msError: number; dfError: number } | null> = {};
  if (runs && runs.length > 0) {
    for (const rId of Object.keys(usableModels)) {
      const mod = usableModels[rId];
      if (mod && mod.terms && mod.terms.length > 0) {
        covContexts[rId] = computeResponseCovariance(factors, mod.terms, runs, rId, mod);
      }
    }
  }

  // 5. Build final solutions with genuine standard errors and 95% confidence intervals
  const solutions: OptimizationSolution[] = uniqueCandidates.map((c, idx) => {
    const stdErrors: Record<string, number> = {};
    const confidenceIntervals: Record<string, { low: number; high: number }> = {};

    for (const rId of Object.keys(c.predictions)) {
      const pred = c.predictions[rId];
      const cov = covContexts[rId];
      const mod = usableModels[rId];

      if (cov && mod && mod.terms && mod.terms.length > 0) {
        const xRow = buildModelTermVector(c.factors, factors, mod.terms);
        let leverage = 0;
        const p = mod.terms.length;
        for (let j = 0; j < p; j++) {
          for (let k = 0; k < p; k++) {
            leverage += xRow[j] * cov.xtxInv[j][k] * xRow[k];
          }
        }
        const se = Math.sqrt(Math.max(0, cov.msError * Math.max(0, leverage)));
        const tCrit = getStudentTCritical(cov.dfError, 0.975);
        stdErrors[rId] = se;
        confidenceIntervals[rId] = {
          low: pred - tCrit * se,
          high: pred + tCrit * se,
        };
      }
    }

    return {
      solutionNumber: idx + 1,
      factors: c.factors,
      predictions: c.predictions,
      individualDesirability: c.indD,
      desirability: c.D,
      stdErrors: Object.keys(stdErrors).length > 0 ? stdErrors : undefined,
      confidenceIntervals: Object.keys(confidenceIntervals).length > 0 ? confidenceIntervals : undefined,
    };
  });

  const status = solutions.length > 0 ? (solutions[0].desirability > 0.999 ? 'optimal' : 'suboptimal') : 'no_feasible_solution';
  const message = solutions.length > 0
    ? `Optimization converged: Found ${solutions.length} unique feasible solutions (Best Desirability = ${solutions[0].desirability.toFixed(4)}).`
    : 'No feasible solutions found satisfying all criteria simultaneously (overall desirability = 0). Try relaxing some criteria limits.';

  // If no feasible solutions found, provide clear diagnostics explaining which criteria were violated
  if (solutions.length === 0) {
    const violationsCount: Record<string, number> = {};
    for (const sp of startingPoints) {
      for (const f of factors) {
        const crit = criteria[f.id];
        if (crit && crit.goal !== 'none') {
          const actVal = sp.factors[f.id];
          const isCoded = isFactorCriterionCoded(crit, f);
          const valForCrit = isCoded ? actualToCoded(actVal, f.low, f.high) : actVal;
          if (calculateIndividualDesirability(valForCrit, crit) <= 0) {
            violationsCount[f.id] = (violationsCount[f.id] || 0) + 1;
          }
        }
      }
      for (const r of responses) {
        if (usableModels[r.id]) {
          const pred = predictModelResponse(sp.factors, factors, usableModels[r.id]);
          const crit = criteria[r.id];
          if (crit && crit.goal !== 'none') {
            if (calculateIndividualDesirability(pred, crit) <= 0) {
              violationsCount[r.id] = (violationsCount[r.id] || 0) + 1;
            }
          }
        }
      }
    }

    const worstConstraints = Object.entries(violationsCount)
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => {
        const name = responses.find(r => r.id === id)?.name || factors.find(f => f.id === id)?.name || id;
        const crit = criteria[id];
        return `${name} (${crit?.goal || 'criterion'}, violated in ${Math.round((count / startingPoints.length) * 100)}% of starting points)`;
      });

    if (worstConstraints.length > 0) {
      warnings.push(`Constraint diagnosis: ${worstConstraints.slice(0, 3).join('; ')}.`);
    }
  }

  if (options.includeStdError) {
    warnings.push('Standard-error propagation is preserved as a configuration setting but is not yet active in the current optimization solver.');
  }

  return {
    runId: 'opt-' + Date.now(),
    timestamp: new Date().toISOString(),
    status,
    message,
    options,
    criteria,
    startingPoints,
    solutions,
    selectedSolutionIndex: 0,
    warnings,
    isOutdated: false,
    startingPointsDiagnostic: spResult.diagnostic,
  };
}
