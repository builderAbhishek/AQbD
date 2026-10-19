import { describe, test, expect } from 'vitest';
import {
  executeNumericalOptimization,
  predictModelResponse,
  actualToCoded,
  codedToActual,
  calculateIndividualDesirability,
  calculateCombinedDesirability,
  FactorBounds,
  FittedModelRef
} from '../lib/optimization/solver';
import {
  OptimizationCriterion,
  DEFAULT_OPTIMIZATION_OPTIONS,
  isFactorCriterionCoded
} from '../lib/optimization/types';
import {
  refitResponseModel,
  validateResponseObservationsComplete,
  ensureAllResponseModelsCurrent
} from '../lib/statistics/rsm/modelFitting';

describe('AQbD Studio Optimization Parity, Invalidation & Numerical Accuracy', () => {
  // Reference 20-run CCD dataset factors
  const factors: FactorBounds[] = [
    { id: 'f1', name: 'Organic Phase', low: 35, high: 45, units: '%' },
    { id: 'f2', name: 'pH', low: 2.5, high: 3.5, units: 'pH' },
    { id: 'f3', name: 'Temperature', low: 25, high: 35, units: '°C' },
  ];

  const responses = [
    { id: 'r1', name: 'Resolution', units: '' },
    { id: 'r2', name: 'Retention Time', units: 'min' },
    { id: 'r3', name: 'Tailing Factor', units: '' },
  ];

  // Exact 20 runs from CCD experimental matrix
  const alpha = 1.681792830507429;
  const initialRuns = [
    // 8 Factorial points
    { id: 'r-1', stdOrder: 1, runOrder: 9, codedValues: { f1: -1, f2: -1, f3: -1 }, actualValues: { f1: 35, f2: 2.5, f3: 25 }, responses: { r1: 2.00, r2: 8.75, r3: 1.265 } },
    { id: 'r-2', stdOrder: 2, runOrder: 12, codedValues: { f1: 1, f2: -1, f3: -1 }, actualValues: { f1: 45, f2: 2.5, f3: 25 }, responses: { r1: 2.59, r2: 9.15, r3: 1.125 } },
    { id: 'r-3', stdOrder: 3, runOrder: 20, codedValues: { f1: -1, f2: 1, f3: -1 }, actualValues: { f1: 35, f2: 3.5, f3: 25 }, responses: { r1: 2.02, r2: 9.20, r3: 1.285 } },
    { id: 'r-4', stdOrder: 4, runOrder: 11, codedValues: { f1: 1, f2: 1, f3: -1 }, actualValues: { f1: 45, f2: 3.5, f3: 25 }, responses: { r1: 2.04, r2: 10.50, r3: 1.205 } },
    { id: 'r-5', stdOrder: 5, runOrder: 10, codedValues: { f1: -1, f2: -1, f3: 1 }, actualValues: { f1: 35, f2: 2.5, f3: 35 }, responses: { r1: 2.17, r2: 8.23, r3: 1.315 } },
    { id: 'r-6', stdOrder: 6, runOrder: 1, codedValues: { f1: 1, f2: -1, f3: 1 }, actualValues: { f1: 45, f2: 2.5, f3: 35 }, responses: { r1: 3.08, r2: 9.07, r3: 1.135 } },
    { id: 'r-7', stdOrder: 7, runOrder: 7, codedValues: { f1: -1, f2: 1, f3: 1 }, actualValues: { f1: 35, f2: 3.5, f3: 35 }, responses: { r1: 2.00, r2: 8.28, r3: 1.375 } },
    { id: 'r-8', stdOrder: 8, runOrder: 19, codedValues: { f1: 1, f2: 1, f3: 1 }, actualValues: { f1: 45, f2: 3.5, f3: 35 }, responses: { r1: 2.35, r2: 10.02, r3: 1.295 } },
    // 6 Axial points
    { id: 'r-9', stdOrder: 9, runOrder: 16, codedValues: { f1: -alpha, f2: 0, f3: 0 }, actualValues: { f1: 31.591, f2: 3.0, f3: 30 }, responses: { r1: 1.777, r2: 8.439, r3: 1.394 } },
    { id: 'r-10', stdOrder: 10, runOrder: 4, codedValues: { f1: alpha, f2: 0, f3: 0 }, actualValues: { f1: 48.409, f2: 3.0, f3: 30 }, responses: { r1: 2.588, r2: 10.258, r3: 1.186 } },
    { id: 'r-11', stdOrder: 11, runOrder: 5, codedValues: { f1: 0, f2: -alpha, f3: 0 }, actualValues: { f1: 40, f2: 2.1591, f3: 30 }, responses: { r1: 2.604, r2: 8.527, r3: 1.176 } },
    { id: 'r-12', stdOrder: 12, runOrder: 2, codedValues: { f1: 0, f2: alpha, f3: 0 }, actualValues: { f1: 40, f2: 3.8409, f3: 30 }, responses: { r1: 1.968, r2: 9.604, r3: 1.290 } },
    { id: 'r-13', stdOrder: 13, runOrder: 14, codedValues: { f1: 0, f2: 0, f3: -alpha }, actualValues: { f1: 40, f2: 3.0, f3: 21.591 }, responses: { r1: 2.259, r2: 9.345, r3: 1.164 } },
    { id: 'r-14', stdOrder: 14, runOrder: 6, codedValues: { f1: 0, f2: 0, f3: alpha }, actualValues: { f1: 40, f2: 3.0, f3: 38.409 }, responses: { r1: 2.682, r2: 8.604, r3: 1.245 } },
    // 6 Center points
    { id: 'r-15', stdOrder: 15, runOrder: 3, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.53, r3: 1.12 } },
    { id: 'r-16', stdOrder: 16, runOrder: 18, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.78, r2: 8.45, r3: 1.12 } },
    { id: 'r-17', stdOrder: 17, runOrder: 17, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.42, r3: 1.11 } },
    { id: 'r-18', stdOrder: 18, runOrder: 15, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.55, r3: 1.11 } },
    { id: 'r-19', stdOrder: 19, runOrder: 13, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.40, r3: 1.14 } },
    { id: 'r-20', stdOrder: 20, runOrder: 8, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.80, r2: 8.58, r3: 1.13 } },
  ];

  const designTemplate = {
    config: { factors, responses },
    runs: initialRuns,
    analyses: {} as Record<string, any>,
  };

  test('1. Response models fit with high accuracy on 20-run CCD dataset', () => {
    const resAnalysis = refitResponseModel(designTemplate, 'r1', 'Quadratic');
    const rtAnalysis = refitResponseModel(designTemplate, 'r2', 'Quadratic');
    const tfAnalysis = refitResponseModel(designTemplate, 'r3', 'Quadratic');

    // Resolution R2 > 0.999
    expect(resAnalysis.fittedModel.R2).toBeGreaterThan(0.999);
    // Retention Time R2 > 0.995
    expect(rtAnalysis.fittedModel.R2).toBeGreaterThan(0.995);
    // Tailing Factor R2 > 0.990
    expect(tfAnalysis.fittedModel.R2).toBeGreaterThan(0.990);
  });

  test('2. Point 1 and Point 2 predictions match exact mathematical model values', () => {
    const resAnalysis = refitResponseModel(designTemplate, 'r1', 'Quadratic');
    const rtAnalysis = refitResponseModel(designTemplate, 'r2', 'Quadratic');
    const tfAnalysis = refitResponseModel(designTemplate, 'r3', 'Quadratic');

    const usableResModel: FittedModelRef = {
      modelType: resAnalysis.modelType,
      terms: resAnalysis.fittedModel.terms,
      coefficients: resAnalysis.fittedModel.coefficients,
    };
    const usableRtModel: FittedModelRef = {
      modelType: rtAnalysis.modelType,
      terms: rtAnalysis.fittedModel.terms,
      coefficients: rtAnalysis.fittedModel.coefficients,
    };
    const usableTfModel: FittedModelRef = {
      modelType: tfAnalysis.modelType,
      terms: tfAnalysis.fittedModel.terms,
      coefficients: tfAnalysis.fittedModel.coefficients,
    };

    // Point 1: Organic Phase = 45, pH = 2.5, Temperature = 35 (Coded: +1, -1, +1)
    const pt1 = { f1: 45, f2: 2.5, f3: 35 };
    const p1_r1 = predictModelResponse(pt1, factors, usableResModel);
    const p1_r2 = predictModelResponse(pt1, factors, usableRtModel);
    const p1_r3 = predictModelResponse(pt1, factors, usableTfModel);

    expect(p1_r1).toBeCloseTo(3.0924, 3);
    expect(p1_r2).toBeCloseTo(9.1044, 3);
    expect(p1_r3).toBeCloseTo(1.1392, 3);

    // Point 2: Organic Phase = 41.535, pH = 2.873, Temperature = 31.926 (Coded: +0.307, -0.254, +0.3852)
    const pt2 = { f1: 41.535, f2: 2.873, f3: 31.926 };
    const p2_r1 = predictModelResponse(pt2, factors, usableResModel);
    const p2_r2 = predictModelResponse(pt2, factors, usableRtModel);
    const p2_r3 = predictModelResponse(pt2, factors, usableTfModel);

    expect(p2_r1).toBeCloseTo(2.9386, 3);
    expect(p2_r2).toBeCloseTo(8.5480, 3);
    expect(p2_r3).toBeCloseTo(1.1130, 3);
  });

  test('3. Response data edit invalidates cached models and produces updated optimization results', () => {
    // Initial criteria
    const criteria: Record<string, OptimizationCriterion> = {
      f1: { id: 'f1', name: 'Organic Phase', type: 'factor', goal: 'in_range', lowerLimit: 35, upperLimit: 45, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f2: { id: 'f2', name: 'pH', type: 'factor', goal: 'in_range', lowerLimit: 2.5, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f3: { id: 'f3', name: 'Temperature', type: 'factor', goal: 'in_range', lowerLimit: 25, upperLimit: 35, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r1: { id: 'r1', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 2.0, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r2: { id: 'r2', name: 'Retention Time', type: 'response', goal: 'none', lowerLimit: 8.0, upperLimit: 11.0, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r3: { id: 'r3', name: 'Tailing Factor', type: 'response', goal: 'none', lowerLimit: 1.0, upperLimit: 1.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
    };

    const initialResAnalysis = refitResponseModel(designTemplate, 'r1', 'Quadratic');
    const initialAnalyses = { r1: initialResAnalysis };

    const initialOpt = executeNumericalOptimization(factors, responses, initialAnalyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS, initialRuns);
    expect(initialOpt.solutions.length).toBeGreaterThan(0);
    const initialBestPred = initialOpt.solutions[0].predictions.r1;

    // Simulate editing run 6 (Std 6, which was 3.08) to 4.50
    const modifiedRuns = initialRuns.map(r => {
      if (r.stdOrder === 6) {
        return { ...r, responses: { ...r.responses, r1: 4.50 } };
      }
      return r;
    });

    const modifiedDesign = {
      ...designTemplate,
      runs: modifiedRuns,
      analyses: {
        r1: { ...initialResAnalysis, isOutdated: true }, // marked outdated
      },
      runsModifiedAt: new Date().toISOString(),
    };

    // Run ensureAllResponseModelsCurrent
    const { updatedAnalyses, didRefit } = ensureAllResponseModelsCurrent(modifiedDesign, criteria);
    expect(didRefit).toBe(true);
    expect(updatedAnalyses.r1.isOutdated).toBe(false);

    // Run optimization with updated analyses
    const updatedOpt = executeNumericalOptimization(factors, responses, updatedAnalyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS, modifiedRuns);
    expect(updatedOpt.solutions.length).toBeGreaterThan(0);
    const updatedBestPred = updatedOpt.solutions[0].predictions.r1;

    // Verify predictions changed noticeably
    expect(updatedBestPred).not.toEqual(initialBestPred);
    expect(Math.abs(updatedBestPred - initialBestPred)).toBeGreaterThan(0.2);
  });

  test('4. Incomplete response data blocks optimization with descriptive error', () => {
    const incompleteRuns = initialRuns.map(r => {
      if (r.stdOrder === 6) {
        return { ...r, responses: { ...r.responses, r1: null as any } };
      }
      return r;
    });

    const check = validateResponseObservationsComplete(incompleteRuns, 'r1', 'Resolution');
    expect(check.isComplete).toBe(false);
    expect(check.missingRuns.length).toBe(1);
    expect(check.missingRuns[0]).toContain('Std 6');

    const designWithMissing = {
      config: { factors, responses },
      runs: incompleteRuns,
      analyses: {
        r1: { isOutdated: true },
      },
    };

    expect(() => {
      refitResponseModel(designWithMissing, 'r1', 'Quadratic');
    }).toThrowError(/Response "Resolution" has missing or non-numeric values/);
  });

  test('5. Goal "none" does not pull combined desirability to zero or distort other criteria', () => {
    const criteria: Record<string, OptimizationCriterion> = {
      f1: { id: 'f1', name: 'Organic Phase', type: 'factor', goal: 'in_range', lowerLimit: 35, upperLimit: 45, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f2: { id: 'f2', name: 'pH', type: 'factor', goal: 'in_range', lowerLimit: 2.5, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f3: { id: 'f3', name: 'Temperature', type: 'factor', goal: 'in_range', lowerLimit: 25, upperLimit: 35, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r1: { id: 'r1', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 2.0, upperLimit: 3.0, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r2: { id: 'r2', name: 'Retention Time', type: 'response', goal: 'none', lowerLimit: 8.0, upperLimit: 11.0, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r3: { id: 'r3', name: 'Tailing Factor', type: 'response', goal: 'none', lowerLimit: 1.0, upperLimit: 1.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
    };

    const dValues: Record<string, number> = {
      f1: 1.0,
      f2: 1.0,
      f3: 1.0,
      r1: 0.85,
      r2: 1.0, // goal 'none'
      r3: 1.0, // goal 'none'
    };

    // Calculate individual desirability for goal 'none'
    expect(calculateIndividualDesirability(999, criteria.r2)).toBe(1.0);
    expect(calculateIndividualDesirability(-999, criteria.r3)).toBe(1.0);

    const D = calculateCombinedDesirability(dValues, criteria);
    // Overall D should be (1^3 * 1^3 * 1^3 * 0.85^3)^(1/12) = 0.85^(3/12) = 0.85^0.25
    expect(D).toBeGreaterThan(0.8);
    expect(D).toBeLessThanOrEqual(1.0);
  });

  test('6. Coded to actual coordinate conversion is mathematically exact', () => {
    // Factor Organic Phase [35, 45] -> center 40, halfRange 5
    expect(actualToCoded(40, 35, 45)).toBe(0);
    expect(actualToCoded(45, 35, 45)).toBe(1);
    expect(actualToCoded(35, 35, 45)).toBe(-1);
    expect(actualToCoded(48.409, 35, 45)).toBeCloseTo(1.6818, 3);
    expect(actualToCoded(31.591, 35, 45)).toBeCloseTo(-1.6818, 3);

    expect(codedToActual(0, 35, 45)).toBe(40);
    expect(codedToActual(1, 35, 45)).toBe(45);
    expect(codedToActual(-1, 35, 45)).toBe(35);
    expect(codedToActual(1.68179283, 35, 45)).toBeCloseTo(48.409, 3);
  });

  test('7. Optimization solutions are deduplicated and sorted by desirability descending', () => {
    const criteria: Record<string, OptimizationCriterion> = {
      f1: { id: 'f1', name: 'Organic Phase', type: 'factor', goal: 'in_range', lowerLimit: 35, upperLimit: 45, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f2: { id: 'f2', name: 'pH', type: 'factor', goal: 'in_range', lowerLimit: 2.5, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f3: { id: 'f3', name: 'Temperature', type: 'factor', goal: 'in_range', lowerLimit: 25, upperLimit: 35, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r1: { id: 'r1', name: 'Resolution', type: 'response', goal: 'none', lowerLimit: 1.777, upperLimit: 3.08, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r2: { id: 'r2', name: 'Retention Time', type: 'response', goal: 'none', lowerLimit: 8.23, upperLimit: 10.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r3: { id: 'r3', name: 'Tailing Factor', type: 'response', goal: 'none', lowerLimit: 1.1, upperLimit: 1.394, lowerWeight: 1, upperWeight: 1, importance: 3 },
    };

    const resAnalysis = refitResponseModel(designTemplate, 'r1', 'Quadratic');
    const rtAnalysis = refitResponseModel(designTemplate, 'r2', 'Quadratic');
    const tfAnalysis = refitResponseModel(designTemplate, 'r3', 'Quadratic');

    const analyses = {
      r1: resAnalysis,
      r2: rtAnalysis,
      r3: tfAnalysis,
    };

    const opt = executeNumericalOptimization(factors, responses, analyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS, initialRuns);
    expect(opt.status).toBe('optimal');
    expect(opt.solutions.length).toBeGreaterThan(0);

    // Verify descending order
    for (let i = 1; i < opt.solutions.length; i++) {
      expect(opt.solutions[i - 1].desirability).toBeGreaterThanOrEqual(opt.solutions[i].desirability);
    }

    // Verify deduplication: no two solutions closer than duplicateFilter threshold
    const span1 = 45 - 35;
    const span2 = 3.5 - 2.5;
    const span3 = 35 - 25;
    for (let i = 0; i < opt.solutions.length; i++) {
      for (let j = i + 1; j < opt.solutions.length; j++) {
        const d1 = (opt.solutions[i].factors.f1 - opt.solutions[j].factors.f1) / span1;
        const d2 = (opt.solutions[i].factors.f2 - opt.solutions[j].factors.f2) / span2;
        const d3 = (opt.solutions[i].factors.f3 - opt.solutions[j].factors.f3) / span3;
        const dist = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3);
        expect(dist).toBeGreaterThanOrEqual(0.005);
      }
    }
  });
});
