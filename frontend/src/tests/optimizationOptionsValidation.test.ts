import { describe, test, expect } from 'vitest';
import { 
  OptimizationOptions, 
  DEFAULT_OPTIMIZATION_OPTIONS, 
  validateOptimizationOptions 
} from '../lib/optimization/types';
import { executeNumericalOptimization, FactorBounds } from '../lib/optimization/solver';
import { refitResponseModel } from '../lib/statistics/rsm/modelFitting';

describe('AQbD Studio V1 — Numerical Optimization Options Validation & Parity', () => {

  describe('1. Exact Bug Reproduction & Resolution: 0.5 duplicate filter and 0.1 simplex fraction', () => {
    test('accepts Duplicate solution filter = 0.5 and Simplex fraction = 0.1 without validation error', () => {
      const options: OptimizationOptions = {
        randomStartingPoints: 100,
        numberDesignPoints: 50,
        duplicateFilter: 0.5,
        simplexFraction: 0.1,
        maxSolutions: 100,
        includeStdError: false,
      };

      const errors = validateOptimizationOptions(options);
      expect(errors.duplicateFilter).toBeUndefined();
      expect(errors.simplexFraction).toBeUndefined();
      expect(Object.keys(errors)).toHaveLength(0);
    });

    test('accepts the previously nearest valid values (0.451, 0.501) and (0.06, 0.11)', () => {
      const optionsA: OptimizationOptions = {
        ...DEFAULT_OPTIMIZATION_OPTIONS,
        duplicateFilter: 0.451,
        simplexFraction: 0.06,
      };
      const errorsA = validateOptimizationOptions(optionsA);
      expect(errorsA.duplicateFilter).toBeUndefined();
      expect(errorsA.simplexFraction).toBeUndefined();

      const optionsB: OptimizationOptions = {
        ...DEFAULT_OPTIMIZATION_OPTIONS,
        duplicateFilter: 0.501,
        simplexFraction: 0.11,
      };
      const errorsB = validateOptimizationOptions(optionsB);
      expect(errorsB.duplicateFilter).toBeUndefined();
      expect(errorsB.simplexFraction).toBeUndefined();
    });
  });

  describe('2. Comprehensive Option Boundaries and Decimal Inputs', () => {
    test('validates duplicateFilter boundaries and invalid decimal inputs', () => {
      // Valid positive decimals
      const validFilters = [0.0001, 0.001, 0.01, 0.05, 0.1, 0.25, 0.5, 0.75, 1.0, 2.5];
      for (const df of validFilters) {
        const errs = validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, duplicateFilter: df });
        expect(errs.duplicateFilter, `Filter ${df} should be valid`).toBeUndefined();
      }

      // Invalid zero, negative, or NaN
      const invalidFilters = [0, -0.001, -0.05, -0.5, -1, NaN, Infinity, -Infinity];
      for (const df of invalidFilters) {
        const errs = validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, duplicateFilter: df });
        expect(errs.duplicateFilter, `Filter ${df} should be rejected`).toBeDefined();
        expect(errs.duplicateFilter).toContain('positive number > 0');
      }
    });

    test('validates simplexFraction boundaries and invalid decimal inputs', () => {
      // Valid fractions in (0, 1]
      const validFractions = [0.001, 0.01, 0.05, 0.06, 0.1, 0.11, 0.2, 0.5, 0.75, 0.99, 1.0];
      for (const sf of validFractions) {
        const errs = validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, simplexFraction: sf });
        expect(errs.simplexFraction, `Simplex fraction ${sf} should be valid`).toBeUndefined();
      }

      // Invalid: <= 0 or > 1 or NaN
      const invalidFractions = [0, -0.01, -0.1, 1.0001, 1.05, 1.5, 2.0, NaN, Infinity];
      for (const sf of invalidFractions) {
        const errs = validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, simplexFraction: sf });
        expect(errs.simplexFraction, `Simplex fraction ${sf} should be rejected`).toBeDefined();
        expect(errs.simplexFraction).toContain('between 0 and 1');
      }
    });

    test('validates randomStartingPoints and numberDesignPoints constraints', () => {
      // Integers >= 0 are valid
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, randomStartingPoints: 0, numberDesignPoints: 50 }).randomStartingPoints).toBeUndefined();
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, randomStartingPoints: 50, numberDesignPoints: 0 }).numberDesignPoints).toBeUndefined();
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, randomStartingPoints: 200 }).randomStartingPoints).toBeUndefined();

      // Negative numbers rejected
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, randomStartingPoints: -1 }).randomStartingPoints).toBeDefined();
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, numberDesignPoints: -1 }).numberDesignPoints).toBeDefined();

      // Decimals rejected for point counts
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, randomStartingPoints: 10.5 }).randomStartingPoints).toBeDefined();
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, numberDesignPoints: 25.2 }).numberDesignPoints).toBeDefined();

      // Both zero rejected
      const bothZero = validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, randomStartingPoints: 0, numberDesignPoints: 0 });
      expect(bothZero.randomStartingPoints).toBeDefined();
      expect(bothZero.randomStartingPoints).toContain('At least one starting point must be selected');
    });

    test('validates maxSolutions constraints', () => {
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, maxSolutions: 1 }).maxSolutions).toBeUndefined();
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, maxSolutions: 500 }).maxSolutions).toBeUndefined();

      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, maxSolutions: 0 }).maxSolutions).toBeDefined();
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, maxSolutions: -10 }).maxSolutions).toBeDefined();
      expect(validateOptimizationOptions({ ...DEFAULT_OPTIMIZATION_OPTIONS, maxSolutions: 20.5 }).maxSolutions).toBeDefined();
    });
  });

  describe('3. Optimizer Passes Saved Settings Unchanged & Enforces Configured Thresholds', () => {
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

    const alpha = 1.681792830507429;
    const initialRuns = [
      { id: 'r-1', stdOrder: 1, runOrder: 9, codedValues: { f1: -1, f2: -1, f3: -1 }, actualValues: { f1: 35, f2: 2.5, f3: 25 }, responses: { r1: 2.00, r2: 8.75, r3: 1.265 } },
      { id: 'r-2', stdOrder: 2, runOrder: 12, codedValues: { f1: 1, f2: -1, f3: -1 }, actualValues: { f1: 45, f2: 2.5, f3: 25 }, responses: { r1: 2.59, r2: 9.15, r3: 1.125 } },
      { id: 'r-3', stdOrder: 3, runOrder: 20, codedValues: { f1: -1, f2: 1, f3: -1 }, actualValues: { f1: 35, f2: 3.5, f3: 25 }, responses: { r1: 2.02, r2: 9.20, r3: 1.285 } },
      { id: 'r-4', stdOrder: 4, runOrder: 11, codedValues: { f1: 1, f2: 1, f3: -1 }, actualValues: { f1: 45, f2: 3.5, f3: 25 }, responses: { r1: 2.04, r2: 10.50, r3: 1.205 } },
      { id: 'r-5', stdOrder: 5, runOrder: 10, codedValues: { f1: -1, f2: -1, f3: 1 }, actualValues: { f1: 35, f2: 2.5, f3: 35 }, responses: { r1: 2.17, r2: 8.23, r3: 1.315 } },
      { id: 'r-6', stdOrder: 6, runOrder: 1, codedValues: { f1: 1, f2: -1, f3: 1 }, actualValues: { f1: 45, f2: 2.5, f3: 35 }, responses: { r1: 3.08, r2: 9.07, r3: 1.135 } },
      { id: 'r-7', stdOrder: 7, runOrder: 7, codedValues: { f1: -1, f2: 1, f3: 1 }, actualValues: { f1: 35, f2: 3.5, f3: 35 }, responses: { r1: 2.00, r2: 8.28, r3: 1.375 } },
      { id: 'r-8', stdOrder: 8, runOrder: 19, codedValues: { f1: 1, f2: 1, f3: 1 }, actualValues: { f1: 45, f2: 3.5, f3: 35 }, responses: { r1: 2.35, r2: 10.02, r3: 1.295 } },
      { id: 'r-9', stdOrder: 9, runOrder: 16, codedValues: { f1: -alpha, f2: 0, f3: 0 }, actualValues: { f1: 31.591, f2: 3.0, f3: 30 }, responses: { r1: 1.777, r2: 8.439, r3: 1.394 } },
      { id: 'r-10', stdOrder: 10, runOrder: 4, codedValues: { f1: alpha, f2: 0, f3: 0 }, actualValues: { f1: 48.409, f2: 3.0, f3: 30 }, responses: { r1: 2.588, r2: 10.258, r3: 1.186 } },
      { id: 'r-11', stdOrder: 11, runOrder: 5, codedValues: { f1: 0, f2: -alpha, f3: 0 }, actualValues: { f1: 40, f2: 2.1591, f3: 30 }, responses: { r1: 2.604, r2: 8.527, r3: 1.176 } },
      { id: 'r-12', stdOrder: 12, runOrder: 2, codedValues: { f1: 0, f2: alpha, f3: 0 }, actualValues: { f1: 40, f2: 3.8409, f3: 30 }, responses: { r1: 1.968, r2: 9.604, r3: 1.290 } },
      { id: 'r-13', stdOrder: 13, runOrder: 14, codedValues: { f1: 0, f2: 0, f3: -alpha }, actualValues: { f1: 40, f2: 3.0, f3: 21.591 }, responses: { r1: 2.259, r2: 9.345, r3: 1.164 } },
      { id: 'r-14', stdOrder: 14, runOrder: 6, codedValues: { f1: 0, f2: 0, f3: alpha }, actualValues: { f1: 40, f2: 3.0, f3: 38.409 }, responses: { r1: 2.682, r2: 8.604, r3: 1.245 } },
      { id: 'r-15', stdOrder: 15, runOrder: 3, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.53, r3: 1.12 } },
      { id: 'r-16', stdOrder: 16, runOrder: 18, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.78, r2: 8.45, r3: 1.12 } },
      { id: 'r-17', stdOrder: 17, runOrder: 17, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.42, r3: 1.11 } },
      { id: 'r-18', stdOrder: 18, runOrder: 15, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.55, r3: 1.11 } },
      { id: 'r-19', stdOrder: 19, runOrder: 13, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.40, r3: 1.14 } },
      { id: 'r-20', stdOrder: 20, runOrder: 8, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.80, r2: 8.58, r3: 1.13 } },
    ];

    const designTemplate = { config: { factors, responses }, runs: initialRuns, analyses: {} };
    const resAnalysis = refitResponseModel(designTemplate, 'r1', 'Quadratic');
    const rtAnalysis = refitResponseModel(designTemplate, 'r2', 'Quadratic');
    const tfAnalysis = refitResponseModel(designTemplate, 'r3', 'Quadratic');
    const analyses = { r1: resAnalysis, r2: rtAnalysis, r3: tfAnalysis };

    const criteria = {
      f1: { id: 'f1', name: 'Organic Phase', type: 'factor' as const, goal: 'in_range' as const, lowerLimit: 35, upperLimit: 45, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f2: { id: 'f2', name: 'pH', type: 'factor' as const, goal: 'in_range' as const, lowerLimit: 2.5, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      f3: { id: 'f3', name: 'Temperature', type: 'factor' as const, goal: 'in_range' as const, lowerLimit: 25, upperLimit: 35, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r1: { id: 'r1', name: 'Resolution', type: 'response' as const, goal: 'maximize' as const, lowerLimit: 2.0, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r2: { id: 'r2', name: 'Retention Time', type: 'response' as const, goal: 'none' as const, lowerLimit: 8.0, upperLimit: 11.0, lowerWeight: 1, upperWeight: 1, importance: 3 },
      r3: { id: 'r3', name: 'Tailing Factor', type: 'response' as const, goal: 'none' as const, lowerLimit: 1.0, upperLimit: 1.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
    };

    test('optimizes with duplicateFilter = 0.5 and enforces strict 0.5 distance threshold', () => {
      const customOptions: OptimizationOptions = {
        randomStartingPoints: 100,
        numberDesignPoints: 50,
        duplicateFilter: 0.5,
        simplexFraction: 0.1,
        maxSolutions: 100,
        includeStdError: false,
      };

      const result = executeNumericalOptimization(factors, responses, analyses, criteria, customOptions, initialRuns);
      expect(['optimal', 'suboptimal']).toContain(result.status);
      expect(result.options.duplicateFilter).toBe(0.5);
      expect(result.options.simplexFraction).toBe(0.1);

      // Stat-Ease Design-Expert defines duplicateFilter = 0.5 as 0.5% (0.005) of factor span
      const minDistance = 0.5 / 100;
      const span1 = 45 - 35;
      const span2 = 3.5 - 2.5;
      const span3 = 35 - 25;
      for (let i = 0; i < result.solutions.length; i++) {
        for (let j = i + 1; j < result.solutions.length; j++) {
          const d1 = (result.solutions[i].factors.f1 - result.solutions[j].factors.f1) / span1;
          const d2 = (result.solutions[i].factors.f2 - result.solutions[j].factors.f2) / span2;
          const d3 = (result.solutions[i].factors.f3 - result.solutions[j].factors.f3) / span3;
          const dist = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3);
          expect(dist).toBeGreaterThanOrEqual(minDistance - 1e-6);
        }
      }
    });

    test('optimizes with simplexFraction = 0.1 and preserves setting in result', () => {
      const customOptions: OptimizationOptions = {
        ...DEFAULT_OPTIMIZATION_OPTIONS,
        simplexFraction: 0.1,
      };

      const result = executeNumericalOptimization(factors, responses, analyses, criteria, customOptions, initialRuns);
      expect(['optimal', 'suboptimal']).toContain(result.status);
      expect(result.options.simplexFraction).toBe(0.1);
      expect(result.solutions.length).toBeGreaterThan(0);
      expect(result.solutions[0].desirability).toBeGreaterThan(0.7);
    });

    test('saved settings survive serialization and reopening simulation', () => {
      const savedOptions: OptimizationOptions = {
        randomStartingPoints: 120,
        numberDesignPoints: 40,
        duplicateFilter: 0.5,
        simplexFraction: 0.1,
        maxSolutions: 50,
        includeStdError: true,
      };

      // Simulate JSON serialization to database
      const json = JSON.stringify({ optimization: { options: savedOptions } });
      const reloaded = JSON.parse(json);

      expect(reloaded.optimization.options.duplicateFilter).toBe(0.5);
      expect(reloaded.optimization.options.simplexFraction).toBe(0.1);
      expect(reloaded.optimization.options.randomStartingPoints).toBe(120);
      expect(reloaded.optimization.options.maxSolutions).toBe(50);
      expect(reloaded.optimization.options.includeStdError).toBe(true);

      // Verify reloaded options pass validation without errors
      const errors = validateOptimizationOptions(reloaded.optimization.options);
      expect(Object.keys(errors)).toHaveLength(0);
    });
  });
});
