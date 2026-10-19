import { FactorBounds, FittedModelRef, predictModelResponse, actualToCoded } from './solver';
import { OptimizationCriterion } from './types';

export interface ResponseGraphicalLimit {
  responseId: string;
  responseName: string;
  units?: string;
  isOneSided: boolean;
  oneSidedType: 'lower' | 'upper'; // >= lower or <= upper
  lowerLimit: number;
  upperLimit: number;
  isActive: boolean;
  observedMin: number;
  observedMax: number;
}

export interface OverlayGridResult {
  xValues: number[];
  yValues: number[];
  feasibilityMatrix: number[][]; // 1 = feasible, 0 = infeasible
  responsePredictions: Record<string, number[][]>; // responseId -> [x][y] prediction
  violatedResponsesMatrix: string[][][]; // [x][y] -> array of violated response names
  feasibleCount: number;
  totalCount: number;
  feasiblePercent: number;
  unmetConstraintsSummary: Record<string, number>; // responseName -> count of grid points where violated
  isEmptyFeasible: boolean;
  fX: FactorBounds;
  fY: FactorBounds;
  codingMode: 'actual' | 'coded';
}

export interface SlicedDesignPoint {
  id: string;
  x: number;
  y: number;
  replicateCount: number;
  runOrders: number[];
  stdOrders: number[];
  displayLabel: string;
  inSlice: boolean;
  actualFactors: Record<string, number>;
  codedFactors: Record<string, number>;
  responses: Record<string, any>;
}

/**
 * Initializes graphical limits from design responses, criteria, and runs.
 * Preserves existing saved user limits when present.
 */
export function initializeGraphicalLimits(
  responses: Array<{ id: string; name: string; units?: string }>,
  criteria: Record<string, OptimizationCriterion> = {},
  runs: Array<{ responses?: Record<string, any> }> = [],
  savedLimits?: Record<string, ResponseGraphicalLimit>
): Record<string, ResponseGraphicalLimit> {
  const result: Record<string, ResponseGraphicalLimit> = {};

  for (const resp of responses) {
    // Calculate observed min and max from runs
    const observedValues = runs
      .map(r => r.responses?.[resp.id])
      .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
    const obsMin = observedValues.length > 0 ? Math.min(...observedValues) : 0;
    const obsMax = observedValues.length > 0 ? Math.max(...observedValues) : 100;

    // Check if user has saved limits for this response
    if (savedLimits && savedLimits[resp.id]) {
      result[resp.id] = {
        ...savedLimits[resp.id],
        responseName: resp.name,
        units: resp.units,
        observedMin: obsMin,
        observedMax: obsMax,
      };
      continue;
    }

    // Otherwise derive sensible defaults from optimization criteria
    const crit = criteria[resp.id];
    let isOneSided = false;
    let oneSidedType: 'lower' | 'upper' = 'lower';
    let lowerLimit = obsMin;
    let upperLimit = obsMax;
    let isActive = false;

    if (crit) {
      if (crit.goal === 'maximize') {
        isActive = true;
        isOneSided = true;
        oneSidedType = 'lower';
        lowerLimit = typeof crit.lowerLimit === 'number' ? crit.lowerLimit : obsMin;
        upperLimit = typeof crit.upperLimit === 'number' && crit.upperLimit > lowerLimit ? crit.upperLimit : Math.max(obsMax, lowerLimit * 1.2);
      } else if (crit.goal === 'minimize') {
        isActive = true;
        isOneSided = true;
        oneSidedType = 'upper';
        upperLimit = typeof crit.upperLimit === 'number' ? crit.upperLimit : obsMax;
        lowerLimit = typeof crit.lowerLimit === 'number' && crit.lowerLimit < upperLimit ? crit.lowerLimit : Math.min(obsMin, upperLimit * 0.8);
      } else if (crit.goal === 'target' || crit.goal === 'in_range') {
        isActive = true;
        isOneSided = false;
        lowerLimit = typeof crit.lowerLimit === 'number' ? crit.lowerLimit : obsMin;
        upperLimit = typeof crit.upperLimit === 'number' ? crit.upperLimit : obsMax;
      } else {
        // goal === 'none'
        isActive = false;
        lowerLimit = obsMin;
        upperLimit = obsMax;
      }
    }

    result[resp.id] = {
      responseId: resp.id,
      responseName: resp.name,
      units: resp.units,
      isOneSided,
      oneSidedType,
      lowerLimit,
      upperLimit,
      isActive,
      observedMin: obsMin,
      observedMax: obsMax,
    };
  }

  return result;
}

/**
 * Checks whether a single point is feasible against all active graphical limits and factor bounds.
 */
export function evaluatePointLimitsFeasibility(
  pointFactors: Record<string, number>,
  factorBounds: FactorBounds[],
  usableModels: Record<string, FittedModelRef>,
  limits: Record<string, ResponseGraphicalLimit>
): { isFeasible: boolean; predictions: Record<string, number>; violatedResponses: string[] } {
  const predictions: Record<string, number> = {};
  const violatedResponses: string[] = [];

  // Check factor bounds
  for (const fb of factorBounds) {
    const val = pointFactors[fb.id];
    if (val !== undefined && (val < fb.low - 1e-6 || val > fb.high + 1e-6)) {
      violatedResponses.push(`${fb.name} Out of Bounds`);
    }
  }

  // Check each active response limit
  for (const respId of Object.keys(limits)) {
    const lim = limits[respId];
    if (!lim || !lim.isActive) continue;

    const model = usableModels[respId];
    if (!model) continue;

    const pred = predictModelResponse(pointFactors, factorBounds, model);
    predictions[respId] = pred;

    let satisfied = true;
    if (lim.isOneSided) {
      if (lim.oneSidedType === 'lower') {
        if (pred < lim.lowerLimit - 1e-6) satisfied = false;
      } else {
        if (pred > lim.upperLimit + 1e-6) satisfied = false;
      }
    } else {
      if (pred < lim.lowerLimit - 1e-6 || pred > lim.upperLimit + 1e-6) {
        satisfied = false;
      }
    }

    if (!satisfied) {
      violatedResponses.push(lim.responseName);
    }
  }

  return {
    isFeasible: violatedResponses.length === 0,
    predictions,
    violatedResponses,
  };
}

/**
 * Evaluates the 2D factor grid for the Overlay Plot.
 */
export function calculateOverlayGrid(
  fX: FactorBounds,
  fY: FactorBounds,
  heldValues: Record<string, number>,
  allFactors: FactorBounds[],
  responses: Array<{ id: string; name: string; units?: string }>,
  usableModels: Record<string, FittedModelRef>,
  limits: Record<string, ResponseGraphicalLimit>,
  resolution: number = 45,
  codingMode: 'actual' | 'coded' = 'actual'
): OverlayGridResult {
  const minX = fX.low;
  const maxX = fX.high;
  const minY = fY.low;
  const maxY = fY.high;

  const xStep = (maxX - minX) / Math.max(1, resolution - 1);
  const yStep = (maxY - minY) / Math.max(1, resolution - 1);

  const xActualVals: number[] = [];
  const yActualVals: number[] = [];
  for (let i = 0; i < resolution; i++) {
    xActualVals.push(minX + i * xStep);
    yActualVals.push(minY + i * yStep);
  }

  const xDisplayVals = codingMode === 'coded'
    ? xActualVals.map(x => actualToCoded(x, fX.low, fX.high))
    : xActualVals;
  const yDisplayVals = codingMode === 'coded'
    ? yActualVals.map(y => actualToCoded(y, fY.low, fY.high))
    : yActualVals;

  const feasibilityMatrix: number[][] = Array.from({ length: resolution }, () => new Array(resolution).fill(0));
  const violatedResponsesMatrix: string[][][] = Array.from({ length: resolution }, () => 
    Array.from({ length: resolution }, () => [])
  );
  const responsePredictions: Record<string, number[][]> = {};
  for (const r of responses) {
    if (usableModels[r.id]) {
      responsePredictions[r.id] = Array.from({ length: resolution }, () => new Array(resolution).fill(0));
    }
  }

  let feasibleCount = 0;
  const unmetConstraintsSummary: Record<string, number> = {};

  for (let i = 0; i < resolution; i++) {
    for (let j = 0; j < resolution; j++) {
      const pt: Record<string, number> = { ...heldValues };
      pt[fX.id] = xActualVals[i];
      pt[fY.id] = yActualVals[j];

      const evalRes = evaluatePointLimitsFeasibility(pt, allFactors, usableModels, limits);

      for (const rId of Object.keys(evalRes.predictions)) {
        if (responsePredictions[rId]) {
          responsePredictions[rId][i][j] = evalRes.predictions[rId];
        }
      }

      if (evalRes.isFeasible) {
        feasibilityMatrix[i][j] = 1;
        feasibleCount++;
      } else {
        feasibilityMatrix[i][j] = 0;
        violatedResponsesMatrix[i][j] = evalRes.violatedResponses;
        for (const vName of evalRes.violatedResponses) {
          unmetConstraintsSummary[vName] = (unmetConstraintsSummary[vName] || 0) + 1;
        }
      }
    }
  }

  const totalCount = resolution * resolution;
  const feasiblePercent = totalCount > 0 ? (feasibleCount / totalCount) * 100 : 0;

  return {
    xValues: xDisplayVals,
    yValues: yDisplayVals,
    feasibilityMatrix,
    responsePredictions,
    violatedResponsesMatrix,
    feasibleCount,
    totalCount,
    feasiblePercent,
    unmetConstraintsSummary,
    isEmptyFeasible: feasibleCount === 0,
    fX,
    fY,
    codingMode,
  };
}

/**
 * Slices design runs and clusters coincident replicate points for clean visualization.
 */
export function sliceDesignPoints(
  runs: Array<{
    id?: string;
    stdOrder?: number;
    runOrder?: number;
    actualValues?: Record<string, number>;
    codedValues?: Record<string, number>;
    responses?: Record<string, any>;
  }>,
  fX: FactorBounds,
  fY: FactorBounds,
  heldValues: Record<string, number>,
  allFactors: FactorBounds[],
  codingMode: 'actual' | 'coded' = 'actual',
  sliceToleranceRatio: number = 0.05
): SlicedDesignPoint[] {
  if (!runs || runs.length === 0) return [];

  const heldFactors = allFactors.filter(f => f.id !== fX.id && f.id !== fY.id);

  // Determine whether each run matches the held slice
  const processedRuns: Array<{
    run: typeof runs[0];
    x: number;
    y: number;
    inSlice: boolean;
  }> = [];

  for (const r of runs) {
    const actuals = r.actualValues || {};
    const actX = actuals[fX.id] ?? (fX.low + fX.high) / 2;
    const actY = actuals[fY.id] ?? (fY.low + fY.high) / 2;

    const xVal = codingMode === 'coded' ? actualToCoded(actX, fX.low, fX.high) : actX;
    const yVal = codingMode === 'coded' ? actualToCoded(actY, fY.low, fY.high) : actY;

    // Check held slice tolerance
    let inSlice = true;
    for (const hf of heldFactors) {
      const heldVal = heldValues[hf.id] ?? (hf.low + hf.high) / 2;
      const runVal = actuals[hf.id] ?? heldVal;
      const span = Math.max(1e-4, hf.high - hf.low);
      const diff = Math.abs(runVal - heldVal);
      if (diff / span > sliceToleranceRatio) {
        inSlice = false;
        break;
      }
    }

    processedRuns.push({
      run: r,
      x: xVal,
      y: yVal,
      inSlice,
    });
  }

  // Cluster points with near-identical coordinates into replicate groups
  const clusters: SlicedDesignPoint[] = [];
  const coordTol = codingMode === 'coded' ? 0.05 : Math.max(1e-3, (fX.high - fX.low) * 0.005);

  for (const item of processedRuns) {
    const existing = clusters.find(
      c => Math.abs(c.x - item.x) <= coordTol && Math.abs(c.y - item.y) <= coordTol && c.inSlice === item.inSlice
    );

    if (existing) {
      existing.replicateCount++;
      if (item.run.runOrder) existing.runOrders.push(item.run.runOrder);
      if (item.run.stdOrder) existing.stdOrders.push(item.run.stdOrder);
      existing.displayLabel = `${existing.replicateCount}`;
    } else {
      const runOrder = item.run.runOrder ?? 1;
      const stdOrder = item.run.stdOrder ?? runOrder;
      clusters.push({
        id: item.run.id || `pt-${clusters.length + 1}`,
        x: item.x,
        y: item.y,
        replicateCount: 1,
        runOrders: [runOrder],
        stdOrders: [stdOrder],
        displayLabel: `${stdOrder}`,
        inSlice: item.inSlice,
        actualFactors: item.run.actualValues || {},
        codedFactors: item.run.codedValues || {},
        responses: item.run.responses || {},
      });
    }
  }

  return clusters;
}
