import { describe, test, expect } from 'vitest';
import {
  DEFAULT_OPTIMIZATION_OPTIONS,
  initializeDesignCriteria,
  validateCriterion,
  validateOptimizationOptions,
  isFactorCriterionCoded,
  OptimizationCriterion,
  OptimizationOptions,
} from './types';
import {
  predictModelResponse,
  calculateIndividualDesirability,
  calculateCombinedDesirability,
  generateOptimizationStartingPoints,
  executeNumericalOptimization,
  actualToCoded,
  codedToActual,
  FactorBounds,
  FittedModelRef,
} from './solver';

describe('Optimization Module - Criteria & Options', () => {
  describe('validateCriterion', () => {
    test('passes for valid in_range factor criterion within factor bounds', () => {
      const criterion: OptimizationCriterion = {
        id: 'factor-1',
        name: 'Temperature',
        code: 'A',
        type: 'factor',
        units: 'degC',
        goal: 'in_range',
        lowerLimit: 50,
        upperLimit: 100,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const factorBounds = { low: 50, high: 100 };
      const errors = validateCriterion(criterion, factorBounds);
      expect(errors).toHaveLength(0);
    });

    test('ignores validation when goal is none', () => {
      const criterion: OptimizationCriterion = {
        id: 'resp-1',
        name: 'Yield',
        code: 'R1',
        type: 'response',
        goal: 'none',
        lowerLimit: 100,
        upperLimit: 50,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const errors = validateCriterion(criterion);
      expect(errors).toHaveLength(0);
    });

    test('detects contradictory lower >= upper limits', () => {
      const criterion: OptimizationCriterion = {
        id: 'resp-1',
        name: 'Yield',
        code: 'R1',
        type: 'response',
        goal: 'maximize',
        lowerLimit: 85,
        upperLimit: 80,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const errors = validateCriterion(criterion);
      expect(errors.some(e => e.field === 'lowerLimit')).toBe(true);
      expect(errors[0].message).toContain('strictly less than');
    });

    test('detects limits exceeding factor bounds', () => {
      const criterion: OptimizationCriterion = {
        id: 'factor-1',
        name: 'Time',
        code: 'B',
        type: 'factor',
        goal: 'maximize',
        lowerLimit: 5,
        upperLimit: 65,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const factorBounds = { low: 10, high: 60 };
      const errors = validateCriterion(criterion, factorBounds);
      expect(errors.some(e => e.field === 'lowerLimit')).toBe(true);
      expect(errors.some(e => e.field === 'upperLimit')).toBe(true);
    });

    test('validates target value for target goal', () => {
      const criterion: OptimizationCriterion = {
        id: 'resp-1',
        name: 'Purity',
        code: 'R1',
        type: 'response',
        goal: 'target',
        lowerLimit: 90,
        upperLimit: 100,
        targetValue: 105,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 4,
      };

      const errors = validateCriterion(criterion);
      expect(errors.some(e => e.field === 'targetValue')).toBe(true);
      expect(errors.find(e => e.field === 'targetValue')?.message).toContain('between the lower and upper');
    });

    test('validates weights must be between 0.1 and 10 for maximize, minimize, and target', () => {
      // 1. Maximize validates lowerWeight (s)
      const maxCrit: OptimizationCriterion = {
        id: 'resp-1',
        name: 'Yield',
        code: 'R1',
        type: 'response',
        goal: 'maximize',
        lowerLimit: 10,
        upperLimit: 50,
        lowerWeight: 15,
        upperWeight: 1.0,
        importance: 3,
      };
      const maxErrors = validateCriterion(maxCrit);
      expect(maxErrors.some(e => e.field === 'lowerWeight')).toBe(true);

      // 2. Minimize validates upperWeight (t)
      const minCrit: OptimizationCriterion = {
        id: 'resp-2',
        name: 'Cost',
        code: 'R2',
        type: 'response',
        goal: 'minimize',
        lowerLimit: 10,
        upperLimit: 50,
        lowerWeight: 1.0,
        upperWeight: 0.05,
        importance: 3,
      };
      const minErrors = validateCriterion(minCrit);
      expect(minErrors.some(e => e.field === 'upperWeight')).toBe(true);

      // 3. Target validates both weights
      const tgtCrit: OptimizationCriterion = {
        id: 'resp-3',
        name: 'Purity',
        code: 'R3',
        type: 'response',
        goal: 'target',
        lowerLimit: 10,
        upperLimit: 50,
        targetValue: 30,
        lowerWeight: 0.01,
        upperWeight: 20,
        importance: 3,
      };
      const tgtErrors = validateCriterion(tgtCrit);
      expect(tgtErrors.some(e => e.field === 'lowerWeight')).toBe(true);
      expect(tgtErrors.some(e => e.field === 'upperWeight')).toBe(true);
    });

    test('validates equal_to requires targetValue within factor bounds', () => {
      const criterion: OptimizationCriterion = {
        id: 'factor-1',
        name: 'Catalyst',
        code: 'C',
        type: 'factor',
        goal: 'equal_to',
        lowerLimit: 1,
        upperLimit: 5,
        targetValue: 8,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const errors = validateCriterion(criterion, { low: 1, high: 5 });
      expect(errors.some(e => e.field === 'targetValue')).toBe(true);
    });

    test('coded factor criterion with target 0 is valid against actual factor bounds [10, 20]', () => {
      const codedCrit: OptimizationCriterion = {
        id: 'factor-A',
        name: 'Factor A',
        code: 'A',
        type: 'factor',
        goal: 'equal_to',
        lowerLimit: -1,
        upperLimit: 1,
        targetValue: 0,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const factorBounds = { low: 10, high: 20 };
      expect(isFactorCriterionCoded(codedCrit, factorBounds)).toBe(true);

      const errors = validateCriterion(codedCrit, factorBounds);
      expect(errors).toHaveLength(0);
    });

    test('coded factor criterion with target 2 fails validation against coded bounds [-1, +1]', () => {
      const codedCrit: OptimizationCriterion = {
        id: 'factor-A',
        name: 'Factor A',
        code: 'A',
        type: 'factor',
        goal: 'equal_to',
        lowerLimit: -1,
        upperLimit: 1,
        targetValue: 2,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const factorBounds = { low: 10, high: 20 };
      const errors = validateCriterion(codedCrit, factorBounds);
      expect(errors.some(e => e.field === 'targetValue')).toBe(true);
      expect(errors.find(e => e.field === 'targetValue')?.message).toContain('coded factor range [-1, +1]');
    });

    test('actual factor criterion with target 15 passes against actual factor bounds [10, 20]', () => {
      const actualCrit: OptimizationCriterion = {
        id: 'factor-A',
        name: 'Factor A',
        code: 'A',
        type: 'factor',
        goal: 'equal_to',
        lowerLimit: 10,
        upperLimit: 20,
        targetValue: 15,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const factorBounds = { low: 10, high: 20 };
      expect(isFactorCriterionCoded(actualCrit, factorBounds)).toBe(false);

      const errors = validateCriterion(actualCrit, factorBounds);
      expect(errors).toHaveLength(0);
    });

    test('legacy criterion with saved limits [10, 20] but goal equal_to and target 0 is treated as coded and normalized to [-1, 1]', () => {
      const legacyCrit: OptimizationCriterion = {
        id: 'fA',
        name: 'Factor A',
        code: 'A',
        type: 'factor',
        goal: 'equal_to',
        lowerLimit: 10,
        upperLimit: 20,
        targetValue: 0,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
      };

      const factorBounds = { low: 10, high: 20 };
      expect(isFactorCriterionCoded(legacyCrit, factorBounds)).toBe(true);

      const errors = validateCriterion(legacyCrit, factorBounds);
      expect(errors).toHaveLength(0);

      // Verify normalization upon initialization
      const normalized = initializeDesignCriteria(
        [{ id: 'fA', name: 'Factor A', low: 10, high: 20 }],
        [],
        [],
        { fA: legacyCrit }
      );
      expect(normalized.fA.lowerLimit).toBe(10);
      expect(normalized.fA.upperLimit).toBe(20);
      expect(normalized.fA.targetValue).toBe(15);
      expect(normalized.fA.isCoded).toBe(false);
      expect(normalized.fA.unitType).toBe('actual');
    });
  });

  describe('validateOptimizationOptions', () => {
    test('passes default options', () => {
      const errors = validateOptimizationOptions(DEFAULT_OPTIMIZATION_OPTIONS);
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('validates numeric constraints', () => {
      const invalidOptions: OptimizationOptions = {
        randomStartingPoints: -10,
        numberDesignPoints: -5,
        duplicateFilter: -0.1,
        simplexFraction: 1.5,
        maxSolutions: 0,
        includeStdError: true,
      };

      const errors = validateOptimizationOptions(invalidOptions);
      expect(errors.randomStartingPoints).toBeDefined();
      expect(errors.numberDesignPoints).toBeDefined();
      expect(errors.duplicateFilter).toBeDefined();
      expect(errors.simplexFraction).toBeDefined();
      expect(errors.maxSolutions).toBeDefined();
    });
  });

  describe('initializeDesignCriteria', () => {
    test('initializes factors to in_range and responses to none', () => {
      const factors = [
        { id: 'f1', name: 'Temperature', low: 20, high: 80, units: 'C' },
        { id: 'f2', name: 'Pressure', low: 1, high: 5, units: 'bar' },
      ];
      const responses = [
        { id: 'r1', name: 'Yield', units: '%' },
      ];
      const runs = [
        { responses: { r1: 65.5 } },
        { responses: { r1: 92.0 } },
        { responses: { r1: 78.2 } },
      ];

      const criteria = initializeDesignCriteria(factors, responses, runs);

      expect(criteria['f1'].code).toBe('A');
      expect(criteria['f1'].goal).toBe('in_range');
      expect(criteria['f1'].lowerLimit).toBe(20);
      expect(criteria['f1'].upperLimit).toBe(80);
      expect(criteria['f1'].targetValue).toBe(50);
      expect(criteria['f1'].unitType).toBe('actual');
      expect(criteria['f1'].isCoded).toBe(false);

      expect(criteria['f2'].code).toBe('B');
      expect(criteria['f2'].goal).toBe('in_range');
      expect(criteria['f2'].lowerLimit).toBe(1);
      expect(criteria['f2'].upperLimit).toBe(5);
      expect(criteria['f2'].targetValue).toBe(3);
      expect(criteria['f2'].unitType).toBe('actual');
      expect(criteria['f2'].isCoded).toBe(false);

      expect(criteria['r1'].code).toBe('R1');
      expect(criteria['r1'].goal).toBe('none');
      expect(criteria['r1'].lowerLimit).toBe(65.5);
      expect(criteria['r1'].upperLimit).toBe(92.0);
    });

    test('preserves existing configured criteria while updating metadata', () => {
      const factors = [{ id: 'f1', name: 'Temperature', low: 20, high: 80, units: 'C' }];
      const responses = [{ id: 'r1', name: 'Yield', units: '%' }];

      const existingCriteria: Record<string, OptimizationCriterion> = {
        r1: {
          id: 'r1',
          name: 'Old Yield Name',
          code: 'R1',
          type: 'response',
          goal: 'maximize',
          lowerLimit: 70,
          upperLimit: 95,
          lowerWeight: 2.0,
          upperWeight: 1.5,
          importance: 5,
        },
      };

      const criteria = initializeDesignCriteria(factors, responses, [], existingCriteria);

      expect(criteria['r1'].goal).toBe('maximize');
      expect(criteria['r1'].lowerLimit).toBe(70);
      expect(criteria['r1'].upperLimit).toBe(95);
      expect(criteria['r1'].importance).toBe(5);
      expect(criteria['r1'].name).toBe('Yield');
    });

    test('initializes and preserves hideOnReport and selectedAnalysisId', () => {
      const factors = [{ id: 'f1', name: 'A', low: 10, high: 20 }];
      const responses = [{ id: 'r1', name: 'Yield' }, { id: 'r2', name: 'Impurity' }];
      const analyses = {
        r1: { fittedModel: { modelType: 'Quadratic', R2: 0.98 } }
      };

      const criteria = initializeDesignCriteria(factors, responses, [], undefined, analyses);
      expect(criteria['r1'].selectedAnalysisId).toBe('r1');
      expect(criteria['r1'].hideOnReport).toBe(false);
      expect(criteria['r2'].selectedAnalysisId).toBeUndefined();

      // Update and preserve
      criteria['r2'].hideOnReport = true;
      const reloaded = initializeDesignCriteria(factors, responses, [], criteria, analyses);
      expect(reloaded['r2'].hideOnReport).toBe(true);
    });
  });

  describe('Mathematical Solver & Desirability Functions', () => {
    test('actualToCoded and codedToActual conversions', () => {
      expect(actualToCoded(50, 20, 80)).toBeCloseTo(0, 5);
      expect(actualToCoded(20, 20, 80)).toBeCloseTo(-1, 5);
      expect(actualToCoded(80, 20, 80)).toBeCloseTo(1, 5);

      expect(codedToActual(0, 20, 80)).toBeCloseTo(50, 5);
      expect(codedToActual(-1, 20, 80)).toBeCloseTo(20, 5);
      expect(codedToActual(1, 20, 80)).toBeCloseTo(80, 5);
    });

    test('predictModelResponse correctly evaluates intercept, linear, interaction, and quadratic terms', () => {
      // Model: Y = 50 + 10*A - 5*B + 4*A*B - 8*A^2
      const factors: FactorBounds[] = [
        { id: 'fA', name: 'A', low: 0, high: 10 }, // center=5, range=5
        { id: 'fB', name: 'B', low: 100, high: 200 }, // center=150, range=50
      ];

      const model: FittedModelRef = {
        modelType: 'Quadratic',
        terms: [
          { name: 'Intercept', type: 'intercept', factors: [] },
          { name: 'fA', type: 'linear', factors: ['fA'] },
          { name: 'fB', type: 'linear', factors: ['fB'] },
          { name: 'fA*fB', type: 'interaction', factors: ['fA', 'fB'] },
          { name: 'fA^2', type: 'quadratic', factors: ['fA'] },
        ],
        coefficients: [50, 10, -5, 4, -8],
      };

      // At center point: coded A=0, coded B=0 => Y = 50
      expect(predictModelResponse({ fA: 5, fB: 150 }, factors, model)).toBeCloseTo(50, 4);

      // At coded A=1 (act A=10), coded B=0 (act B=150): Y = 50 + 10(1) - 8(1)^2 = 52
      expect(predictModelResponse({ fA: 10, fB: 150 }, factors, model)).toBeCloseTo(52, 4);

      // At coded A=1 (act A=10), coded B=1 (act B=200): Y = 50 + 10(1) - 5(1) + 4(1)(1) - 8(1)^2 = 51
      expect(predictModelResponse({ fA: 10, fB: 200 }, factors, model)).toBeCloseTo(51, 4);
    });

    test('calculateIndividualDesirability for all goals', () => {
      // 1. Maximize: L=10, U=50, weight=1
      const maxCrit: OptimizationCriterion = {
        id: 'c1', name: 'C1', type: 'response', goal: 'maximize',
        lowerLimit: 10, upperLimit: 50, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      expect(calculateIndividualDesirability(5, maxCrit)).toBe(0);
      expect(calculateIndividualDesirability(10, maxCrit)).toBe(0);
      expect(calculateIndividualDesirability(30, maxCrit)).toBeCloseTo(0.5, 4);
      expect(calculateIndividualDesirability(50, maxCrit)).toBe(1);
      expect(calculateIndividualDesirability(60, maxCrit)).toBe(1);

      // 1b. Maximize with lowerWeight = 2 (s = 2, quadratic curvature)
      const maxCritQuad: OptimizationCriterion = {
        ...maxCrit,
        lowerWeight: 2.0
      };
      expect(calculateIndividualDesirability(30, maxCritQuad)).toBeCloseTo(0.25, 4); // (0.5)^2 = 0.25

      // 2. Minimize: L=10, U=50, weight=1
      const minCrit: OptimizationCriterion = {
        id: 'c2', name: 'C2', type: 'response', goal: 'minimize',
        lowerLimit: 10, upperLimit: 50, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      expect(calculateIndividualDesirability(5, minCrit)).toBe(1);
      expect(calculateIndividualDesirability(10, minCrit)).toBe(1);
      expect(calculateIndividualDesirability(30, minCrit)).toBeCloseTo(0.5, 4);
      expect(calculateIndividualDesirability(50, minCrit)).toBe(0);
      expect(calculateIndividualDesirability(60, minCrit)).toBe(0);

      // 2b. Minimize with upperWeight = 2 (t = 2, quadratic curvature)
      const minCritQuad: OptimizationCriterion = {
        ...minCrit,
        upperWeight: 2.0
      };
      expect(calculateIndividualDesirability(30, minCritQuad)).toBeCloseTo(0.25, 4); // (0.5)^2 = 0.25

      // 3. Target: L=10, U=50, target=30
      const tgtCrit: OptimizationCriterion = {
        id: 'c3', name: 'C3', type: 'response', goal: 'target',
        lowerLimit: 10, upperLimit: 50, targetValue: 30, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      expect(calculateIndividualDesirability(5, tgtCrit)).toBe(0);
      expect(calculateIndividualDesirability(30, tgtCrit)).toBe(1);
      expect(calculateIndividualDesirability(20, tgtCrit)).toBeCloseTo(0.5, 4);
      expect(calculateIndividualDesirability(40, tgtCrit)).toBeCloseTo(0.5, 4);
      expect(calculateIndividualDesirability(55, tgtCrit)).toBe(0);

      // 4. In Range: L=10, U=50
      const rangeCrit: OptimizationCriterion = {
        id: 'c4', name: 'C4', type: 'factor', goal: 'in_range',
        lowerLimit: 10, upperLimit: 50, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      expect(calculateIndividualDesirability(25, rangeCrit)).toBe(1);
      expect(calculateIndividualDesirability(5, rangeCrit)).toBe(0);
      expect(calculateIndividualDesirability(55, rangeCrit)).toBe(0);

      // 5. None
      const noneCrit: OptimizationCriterion = {
        id: 'c5', name: 'C5', type: 'response', goal: 'none',
        lowerLimit: 10, upperLimit: 50, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      expect(calculateIndividualDesirability(100, noneCrit)).toBe(1);
    });

    test('calculateCombinedDesirability weighted geometric mean and zero propagation', () => {
      const criteria: Record<string, OptimizationCriterion> = {
        r1: { id: 'r1', name: 'R1', type: 'response', goal: 'maximize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r2: { id: 'r2', name: 'R2', type: 'response', goal: 'minimize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 3 },
      };

      // Equal desirabilities: D = (0.64 * 0.64)^(1/2) = 0.64
      expect(calculateCombinedDesirability({ r1: 0.64, r2: 0.64 }, criteria)).toBeCloseTo(0.64, 4);

      // Zero propagation: if any active criterion has d = 0, D must be 0
      expect(calculateCombinedDesirability({ r1: 0.95, r2: 0 }, criteria)).toBe(0);

      // Perfect desirability: D = 1
      expect(calculateCombinedDesirability({ r1: 1, r2: 1 }, criteria)).toBeCloseTo(1.0, 5);
    });
  });

  describe('executeNumericalOptimization Search', () => {
    test('finds optimal solution for quadratic response surface', () => {
      // Model: Y = 90 - 5*(A - 5)^2 - 2*(B - 150)^2
      // Optimum at A=5, B=150 where Y = 90
      const factors: FactorBounds[] = [
        { id: 'fA', name: 'Temperature', low: 0, high: 10, units: 'C' },
        { id: 'fB', name: 'Pressure', low: 100, high: 200, units: 'bar' },
      ];

      const responses = [{ id: 'r1', name: 'Yield', units: '%' }];

      // In coded space: A center=5, halfRange=5; B center=150, halfRange=50
      // Y = 90 - 5*(5 * codedA)^2 - 2*(50 * codedB)^2 = 90 - 125 * codedA^2 - 5000 * codedB^2
      const analyses = {
        r1: {
          fittedModel: {
            modelType: 'Quadratic',
            terms: [
              { name: 'Intercept', type: 'intercept', factors: [] },
              { name: 'fA', type: 'linear', factors: ['fA'] },
              { name: 'fB', type: 'linear', factors: ['fB'] },
              { name: 'fA^2', type: 'quadratic', factors: ['fA'] },
              { name: 'fB^2', type: 'quadratic', factors: ['fB'] },
            ],
            coefficients: [90, 0, 0, -125, -5000],
          },
        },
      };

      const criteria: Record<string, OptimizationCriterion> = {
        fA: { id: 'fA', name: 'Temperature', type: 'factor', goal: 'in_range', lowerLimit: 0, upperLimit: 10, lowerWeight: 1, upperWeight: 1, importance: 3 },
        fB: { id: 'fB', name: 'Pressure', type: 'factor', goal: 'in_range', lowerLimit: 100, upperLimit: 200, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r1: { id: 'r1', name: 'Yield', type: 'response', goal: 'maximize', lowerLimit: 50, upperLimit: 90, lowerWeight: 1, upperWeight: 1, importance: 5 },
      };

      const options: OptimizationOptions = {
        randomStartingPoints: 50,
        numberDesignPoints: 10,
        duplicateFilter: 0.1,
        simplexFraction: 0.1,
        maxSolutions: 10,
        includeStdError: false,
      };

      const runs = [
        { actualValues: { fA: 5, fB: 150 } },
        { actualValues: { fA: 2, fB: 120 } },
      ];

      const result = executeNumericalOptimization(factors, responses, analyses, criteria, options, runs);

      expect(result.status).toBe('optimal');
      expect(result.solutions.length).toBeGreaterThan(0);

      const best = result.solutions[0];
      // Optimum temperature should be near 5
      expect(best.factors.fA).toBeCloseTo(5, 1);
      // Optimum pressure should be near 150
      expect(best.factors.fB).toBeCloseTo(150, 1);
      // Predicted yield should be near 90
      expect(best.predictions.r1).toBeCloseTo(90, 1);
      // Combined desirability should be near 1.0
      expect(best.desirability).toBeGreaterThan(0.95);
      // Solutions must be sorted descending
      for (let i = 1; i < result.solutions.length; i++) {
        expect(result.solutions[i - 1].desirability).toBeGreaterThanOrEqual(result.solutions[i].desirability);
      }
    });

    test('returns error status when active response has no fitted model', () => {
      const factors: FactorBounds[] = [{ id: 'fA', name: 'A', low: 0, high: 10 }];
      const responses = [{ id: 'r1', name: 'Unmodeled Response' }];
      const analyses = {}; // empty!
      const criteria: Record<string, OptimizationCriterion> = {
        r1: { id: 'r1', name: 'Unmodeled Response', type: 'response', goal: 'maximize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 3 },
      };

      const result = executeNumericalOptimization(factors, responses, analyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS);
      expect(result.status).toBe('error');
      expect(result.message).toContain('no fitted statistical model');
      expect(result.solutions).toHaveLength(0);
    });

    test('returns no_feasible_solution when constraints cannot be satisfied', () => {
      const factors: FactorBounds[] = [{ id: 'fA', name: 'A', low: 0, high: 10 }];
      const responses = [{ id: 'r1', name: 'Yield' }];
      // Model produces max 50
      const analyses = {
        r1: {
          fittedModel: {
            modelType: 'Linear',
            terms: [{ name: 'Intercept', type: 'intercept', factors: [] }],
            coefficients: [50],
          },
        },
      };

      // Infeasible criterion: require Yield between 90 and 100
      const criteria: Record<string, OptimizationCriterion> = {
        r1: { id: 'r1', name: 'Yield', type: 'response', goal: 'target', lowerLimit: 90, upperLimit: 100, targetValue: 95, lowerWeight: 1, upperWeight: 1, importance: 3 },
      };

      const result = executeNumericalOptimization(factors, responses, analyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS);
      expect(result.status).toBe('no_feasible_solution');
      expect(result.solutions).toHaveLength(0);
    });

    test('starting points generation is reproducible with seed', () => {
      const factors: FactorBounds[] = [
        { id: 'f1', name: 'A', low: 10, high: 50 },
        { id: 'f2', name: 'B', low: 0.1, high: 0.9 },
      ];
      const pts1 = generateOptimizationStartingPoints(factors, [], DEFAULT_OPTIMIZATION_OPTIONS, 12345);
      const pts2 = generateOptimizationStartingPoints(factors, [], DEFAULT_OPTIMIZATION_OPTIONS, 12345);

      expect(pts1).toHaveLength(pts2.length);
      expect(pts1[0].factors.f1).toBe(pts2[0].factors.f1);
      expect(pts1[0].factors.f2).toBe(pts2[0].factors.f2);
      expect(pts1[10].factors.f1).toBe(pts2[10].factors.f1);
    });

    test('solves numerical optimization with coded factor criterion and actual bounds [10, 20]', () => {
      const factors: FactorBounds[] = [{ id: 'fA', name: 'A', low: 10, high: 20 }];
      const responses = [{ id: 'r1', name: 'Yield' }];
      const analyses = {
        r1: {
          fittedModel: {
            modelType: 'Linear',
            terms: [
              { name: 'Intercept', type: 'intercept', factors: [] },
              { name: 'A', type: 'linear', factors: ['fA'] },
            ],
            coefficients: [50, 10], // Yield = 50 + 10 * coded_A
          },
        },
      };

      // Factor criterion: coded equal_to 0 (center point, actual = 15)
      const criteria: Record<string, OptimizationCriterion> = {
        fA: {
          id: 'fA',
          name: 'A',
          type: 'factor',
          goal: 'equal_to',
          lowerLimit: -1,
          upperLimit: 1,
          targetValue: 0,
          lowerWeight: 1,
          upperWeight: 1,
          importance: 3,
        },
        r1: {
          id: 'r1',
          name: 'Yield',
          type: 'response',
          goal: 'in_range',
          lowerLimit: 40,
          upperLimit: 60,
          lowerWeight: 1,
          upperWeight: 1,
          importance: 3,
        },
      };

      const result = executeNumericalOptimization(factors, responses, analyses, criteria, DEFAULT_OPTIMIZATION_OPTIONS);
      expect(result.status).toBe('optimal');
      expect(result.solutions.length).toBeGreaterThan(0);
      const topSol = result.solutions[0];
      // Actual factor value should be close to 15 (which corresponds to coded 0)
      expect(topSol.factors.fA).toBeCloseTo(15, 1);
      expect(topSol.individualDesirability.fA).toBeCloseTo(1, 2);
    });

    test('solves numerical optimization with actual factor limits dynamically and matches coded equivalent', () => {
      // Dynamic factors as requested by user
      const factors: FactorBounds[] = [
        { id: 'f_org', name: 'Organic Phase', low: 31.591, high: 48.409, units: '%' },
        { id: 'f_ph', name: 'pH', low: 2.1591, high: 3.8409, units: 'pH' },
        { id: 'f_temp', name: 'Temperature', low: 21.591, high: 38.409, units: '°C' },
      ];

      const responses = [{ id: 'r1', name: 'Resolution', units: '' }];
      const analyses = {
        r1: {
          fittedModel: {
            modelType: 'Quadratic',
            terms: [
              { name: 'Intercept', type: 'intercept', factors: [] },
              { name: 'A', type: 'linear', factors: ['f_org'] },
              { name: 'B', type: 'linear', factors: ['f_ph'] },
              { name: 'C', type: 'linear', factors: ['f_temp'] },
            ],
            coefficients: [2.0, 0.4, -0.3, 0.2],
          },
        },
      };

      // 1. Verify dynamic initialization assigns actual bounds directly
      const criteria = initializeDesignCriteria(factors, responses);
      expect(criteria.f_org.lowerLimit).toBeCloseTo(31.591, 3);
      expect(criteria.f_org.upperLimit).toBeCloseTo(48.409, 3);
      expect(criteria.f_org.targetValue).toBeCloseTo((31.591 + 48.409) / 2, 3);
      expect(criteria.f_org.unitType).toBe('actual');
      expect(criteria.f_org.isCoded).toBe(false);

      expect(criteria.f_ph.lowerLimit).toBeCloseTo(2.1591, 4);
      expect(criteria.f_ph.upperLimit).toBeCloseTo(3.8409, 4);
      expect(criteria.f_ph.targetValue).toBeCloseTo((2.1591 + 3.8409) / 2, 4);

      expect(criteria.f_temp.lowerLimit).toBeCloseTo(21.591, 3);
      expect(criteria.f_temp.upperLimit).toBeCloseTo(38.409, 3);
      expect(criteria.f_temp.targetValue).toBeCloseTo((21.591 + 38.409) / 2, 3);

      // 2. Verify validation against actual range
      const validEdit = { ...criteria.f_org, lowerLimit: 35.0, upperLimit: 45.0 };
      expect(validateCriterion(validEdit, factors[0])).toHaveLength(0);

      const invalidLower = { ...criteria.f_org, lowerLimit: 25.0, upperLimit: 45.0 };
      const errLower = validateCriterion(invalidLower, factors[0]);
      expect(errLower.some(e => e.field === 'lowerLimit' && e.message.includes('31.591'))).toBe(true);

      const invalidUpper = { ...criteria.f_org, lowerLimit: 35.0, upperLimit: 55.0 };
      const errUpper = validateCriterion(invalidUpper, factors[0]);
      expect(errUpper.some(e => e.field === 'upperLimit' && e.message.includes('48.409'))).toBe(true);

      // 3. Verify Equal To with actual target
      const eqCrit = {
        ...criteria.f_org,
        goal: 'equal_to' as const,
        targetValue: 40.0,
      };
      expect(validateCriterion(eqCrit, factors[0])).toHaveLength(0);

      // 4. Verify optimization execution with actual factor criteria
      const runCriteria: Record<string, OptimizationCriterion> = {
        f_org: { ...criteria.f_org, goal: 'in_range' },
        f_ph: { ...criteria.f_ph, goal: 'in_range' },
        f_temp: { ...criteria.f_temp, goal: 'equal_to', targetValue: 30.0 },
        r1: { id: 'r1', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 1.5, upperLimit: 2.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      };

      const result = executeNumericalOptimization(factors, responses, analyses, runCriteria, DEFAULT_OPTIMIZATION_OPTIONS);
      expect(result.status).toBe('optimal');
      expect(result.solutions.length).toBeGreaterThan(0);
      const best = result.solutions[0];
      expect(best.factors.f_temp).toBeCloseTo(30.0, 1);
      expect(best.factors.f_org).toBeGreaterThanOrEqual(31.591 - 0.1);
      expect(best.factors.f_org).toBeLessThanOrEqual(48.409 + 0.1);
    });
  });
});
