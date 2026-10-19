import { describe, test, expect } from 'vitest';
import { executeNumericalOptimization, predictModelResponse, generateOptimizationStartingPoints } from '../lib/optimization/solver';
import { FactorBounds, FittedModelRef } from '../lib/optimization/solver';
import { OptimizationCriterion, DEFAULT_OPTIMIZATION_OPTIONS } from '../lib/optimization/types';

describe('HPLC Optimization Investigation & Defect Verification', () => {
  const factors: FactorBounds[] = [
    { id: 'f1', name: 'Organic', low: 40, high: 60, units: '%' },
    { id: 'f2', name: 'pH', low: 2.5, high: 3.5, units: '' },
    { id: 'f3', name: 'Temperature', low: 30, high: 45, units: 'C' },
  ];

  const responses = [
    { id: 'r1', name: 'Retention Time', units: 'min' },
    { id: 'r2', name: 'Resolution', units: '' },
    { id: 'r3', name: 'Tailing Factor', units: '' },
  ];

  const rtModel: FittedModelRef = {
    modelType: 'Quadratic',
    terms: [
      { name: 'Intercept', type: 'intercept', factors: [] },
      { name: 'f1', type: 'linear', factors: ['f1'] },
      { name: 'f2', type: 'linear', factors: ['f2'] },
      { name: 'f3', type: 'linear', factors: ['f3'] },
      { name: 'f1^2', type: 'quadratic', factors: ['f1'] },
    ],
    coefficients: [6.5, -1.2, 0.3, -0.4, 0.2],
  };

  const resModel: FittedModelRef = {
    modelType: 'Quadratic',
    terms: [
      { name: 'Intercept', type: 'intercept', factors: [] },
      { name: 'f1', type: 'linear', factors: ['f1'] },
      { name: 'f2', type: 'linear', factors: ['f2'] },
      { name: 'f3', type: 'linear', factors: ['f3'] },
      { name: 'f1*f2', type: 'interaction', factors: ['f1', 'f2'] },
      { name: 'f1^2', type: 'quadratic', factors: ['f1'] },
      { name: 'f2^2', type: 'quadratic', factors: ['f2'] },
    ],
    coefficients: [2.4, 0.3, -0.2, 0.1, -0.15, -0.3, -0.2],
  };

  const tfModel: FittedModelRef = {
    modelType: 'Quadratic',
    terms: [
      { name: 'Intercept', type: 'intercept', factors: [] },
      { name: 'f1', type: 'linear', factors: ['f1'] },
      { name: 'f2', type: 'linear', factors: ['f2'] },
      { name: 'f3', type: 'linear', factors: ['f3'] },
      { name: 'f2^2', type: 'quadratic', factors: ['f2'] },
    ],
    coefficients: [1.05, 0.05, -0.08, 0.02, 0.04],
  };

  const analyses = {
    r1: { fittedModel: rtModel },
    r2: { fittedModel: resModel },
    r3: { fittedModel: tfModel },
  };

  test('1. HPLC Optimization converges to feasible solutions with high desirability', () => {
    const criteria: Record<string, OptimizationCriterion> = {
      f1: { id: 'f1', name: 'Organic', type: 'factor', goal: 'in_range', lowerLimit: -1, upperLimit: 1, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f2: { id: 'f2', name: 'pH', type: 'factor', goal: 'in_range', lowerLimit: -1, upperLimit: 1, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f3: { id: 'f3', name: 'Temperature', type: 'factor', goal: 'in_range', lowerLimit: -1, upperLimit: 1, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r1: { id: 'r1', name: 'Retention Time', type: 'response', goal: 'none', lowerLimit: 4, upperLimit: 10, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r2: { id: 'r2', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 1.5, upperLimit: 2.5, lowerWeight: 1, upperWeight: 1, importance: 4 },
      r3: { id: 'r3', name: 'Tailing Factor', type: 'response', goal: 'target', lowerLimit: 0.8, upperLimit: 1.4, targetValue: 1.05, lowerWeight: 1, upperWeight: 1, importance: 5 },
    };

    const result = executeNumericalOptimization(factors, responses, analyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS);
    expect(result.status).not.toBe('no_feasible_solution');
    expect(result.status).not.toBe('error');
    expect(result.solutions.length).toBeGreaterThan(0);
    expect(result.solutions[0].desirability).toBeGreaterThan(0.95);

    // Verify predicted responses are populated and valid
    const best = result.solutions[0];
    expect(best.predictions.r1).toBeGreaterThan(0);
    expect(best.predictions.r2).toBeGreaterThanOrEqual(1.5);
    expect(best.individualDesirability.r1).toBe(1.0); // Goal = 'none' -> 1.0
  });

  test('2. Letter terms vs Factor IDs resolves factor values correctly', () => {
    // Model terms defined using standard letters 'A', 'B', 'C'
    const letterModel: FittedModelRef = {
      modelType: 'Quadratic',
      terms: [
        { name: 'Intercept', type: 'intercept', factors: [] },
        { name: 'A', type: 'linear', factors: ['A'] },
        { name: 'B', type: 'linear', factors: ['B'] },
        { name: 'A*B', type: 'interaction', factors: ['A', 'B'] },
      ],
      coefficients: [10.0, 2.0, -1.5, 0.5],
    };

    // Factors defined with custom IDs ('factor_uuid_1', 'factor_uuid_2')
    const customFactors: FactorBounds[] = [
      { id: 'factor_uuid_1', name: 'Flow Rate', low: 1.0, high: 2.0 },
      { id: 'factor_uuid_2', name: 'Methanol', low: 50, high: 80 },
    ];

    // High factor settings (+1, +1) -> actual: (2.0, 80)
    const predHigh = predictModelResponse({ factor_uuid_1: 2.0, factor_uuid_2: 80 }, customFactors, letterModel);
    // 10 + 2.0(1) - 1.5(1) + 0.5(1) = 11.0
    expect(predHigh).toBeCloseTo(11.0, 2);

    // Center settings (0, 0) -> actual: (1.5, 65)
    const predCenter = predictModelResponse({ factor_uuid_1: 1.5, factor_uuid_2: 65 }, customFactors, letterModel);
    // 10 + 0 = 10.0
    expect(predCenter).toBeCloseTo(10.0, 2);

    // Low factor settings (-1, -1) -> actual: (1.0, 50)
    const predLow = predictModelResponse({ factor_uuid_1: 1.0, factor_uuid_2: 50 }, customFactors, letterModel);
    // 10 + 2(-1) - 1.5(-1) + 0.5(1) = 10 - 2 + 1.5 + 0.5 = 10.0
    expect(predLow).toBeCloseTo(10.0, 2);
  });

  test('3. Factor criteria with Equal To locks starting points and converged solutions', () => {
    const criteria: Record<string, OptimizationCriterion> = {
      // f1 Organic Equal To 0 (coded 0 = 50.0 actual)
      f1: { id: 'f1', name: 'Organic', type: 'factor', goal: 'equal_to', lowerLimit: -1, upperLimit: 1, targetValue: 0, isCoded: true, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f2: { id: 'f2', name: 'pH', type: 'factor', goal: 'in_range', lowerLimit: -1, upperLimit: 1, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f3: { id: 'f3', name: 'Temperature', type: 'factor', goal: 'in_range', lowerLimit: -1, upperLimit: 1, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r2: { id: 'r2', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 1.5, upperLimit: 2.5, lowerWeight: 1, upperWeight: 1, importance: 4 },
    };

    // Check starting points have f1 locked at 50.0
    const sp = generateOptimizationStartingPoints(factors, [], DEFAULT_OPTIMIZATION_OPTIONS, criteria);
    for (const p of sp) {
      expect(p.factors.f1).toBeCloseTo(50.0, 2);
    }

    const result = executeNumericalOptimization(factors, responses, analyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS);
    expect(result.solutions.length).toBeGreaterThan(0);
    for (const sol of result.solutions) {
      expect(sol.factors.f1).toBeCloseTo(50.0, 1);
    }
  });

  test('4. Infeasible criteria produces status no_feasible_solution with diagnostic warning', () => {
    const impossibleCriteria: Record<string, OptimizationCriterion> = {
      f1: { id: 'f1', name: 'Organic', type: 'factor', goal: 'in_range', lowerLimit: -1, upperLimit: 1, lowerWeight: 1, upperWeight: 1, importance: 3 },
      // Resolution model has max output around 2.5; setting lowerLimit = 10.0 is impossible
      r2: { id: 'r2', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 10.0, upperLimit: 15.0, lowerWeight: 1, upperWeight: 1, importance: 5 },
    };

    const result = executeNumericalOptimization(factors, responses, analyses, impossibleCriteria, DEFAULT_OPTIMIZATION_OPTIONS);
    expect(result.status).toBe('no_feasible_solution');
    expect(result.solutions.length).toBe(0);
    expect(result.warnings.length).toBeGreaterThan(0);
    expect(result.warnings.some(w => w.includes('Constraint diagnosis') || w.includes('Resolution'))).toBe(true);
  });
});
