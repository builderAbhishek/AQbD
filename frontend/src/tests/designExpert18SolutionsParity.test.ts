import { describe, test, expect } from 'vitest';
import {
  executeNumericalOptimization,
  FactorBounds,
} from '../lib/optimization/solver';
import { OptimizationCriterion, OptimizationOptions } from '../lib/optimization/types';
import { refitResponseModel } from '../lib/statistics/rsm/modelFitting';

describe('Design-Expert 13 Parity: 18 Optimization Solutions with Duplicate Filter = 0.5', () => {
  const factors: FactorBounds[] = [
    { id: 'f1', low: 35, high: 45, name: 'Organic Phase', units: '%' },
    { id: 'f2', low: 2.5, high: 3.5, name: 'pH', units: 'pH' },
    { id: 'f3', low: 25, high: 35, name: 'Temperature', units: '°C' },
  ];

  const responses = [
    { id: 'r1', name: 'Resolution', units: '' },
    { id: 'r2', name: 'Retention Time', units: 'min' },
    { id: 'r3', name: 'Tailing Factor', units: '' },
  ];

  const alpha = 1.681792830507429;
  const runs = [
    { id: 'std-1', block: 1, isAxial: false, isCenter: false, runOrder: 1, stdOrder: 1, responses: { r1: 2.10, r2: 7.20, r3: 1.18 }, codedValues: { f1: -1, f2: -1, f3: -1 }, actualValues: { f1: 35, f2: 2.5, f3: 25 } },
    { id: 'std-2', block: 1, isAxial: false, isCenter: false, runOrder: 2, stdOrder: 2, responses: { r1: 2.72, r2: 8.10, r3: 1.12 }, codedValues: { f1: 1, f2: -1, f3: -1 }, actualValues: { f1: 45, f2: 2.5, f3: 25 } },
    { id: 'std-3', block: 1, isAxial: false, isCenter: false, runOrder: 3, stdOrder: 3, responses: { r1: 2.32, r2: 7.80, r3: 1.24 }, codedValues: { f1: -1, f2: 1, f3: -1 }, actualValues: { f1: 35, f2: 3.5, f3: 25 } },
    { id: 'std-4', block: 1, isAxial: false, isCenter: false, runOrder: 4, stdOrder: 4, responses: { r1: 2.58, r2: 8.70, r3: 1.20 }, codedValues: { f1: 1, f2: 1, f3: -1 }, actualValues: { f1: 45, f2: 3.5, f3: 25 } },
    { id: 'std-5', block: 1, isAxial: false, isCenter: false, runOrder: 5, stdOrder: 5, responses: { r1: 2.48, r2: 7.60, r3: 1.16 }, codedValues: { f1: -1, f2: -1, f3: 1 }, actualValues: { f1: 35, f2: 2.5, f3: 35 } },
    { id: 'std-6', block: 1, isAxial: false, isCenter: false, runOrder: 6, stdOrder: 6, responses: { r1: 3.09, r2: 9.10, r3: 1.14 }, codedValues: { f1: 1, f2: -1, f3: 1 }, actualValues: { f1: 45, f2: 2.5, f3: 35 } },
    { id: 'std-7', block: 1, isAxial: false, isCenter: false, runOrder: 7, stdOrder: 7, responses: { r1: 2.26, r2: 8.20, r3: 1.22 }, codedValues: { f1: -1, f2: 1, f3: 1 }, actualValues: { f1: 35, f2: 3.5, f3: 35 } },
    { id: 'std-8', block: 1, isAxial: false, isCenter: false, runOrder: 8, stdOrder: 8, responses: { r1: 2.74, r2: 9.40, r3: 1.18 }, codedValues: { f1: 1, f2: 1, f3: 1 }, actualValues: { f1: 45, f2: 3.5, f3: 35 } },
    { id: 'std-9', block: 1, isAxial: true, isCenter: false, runOrder: 9, stdOrder: 9, responses: { r1: 2.00, r2: 7.50, r3: 1.25 }, codedValues: { f1: -alpha, f2: 0, f3: 0 }, actualValues: { f1: 31.59103584746286, f2: 3, f3: 30 } },
    { id: 'std-10', block: 1, isAxial: true, isCenter: false, runOrder: 10, stdOrder: 10, responses: { r1: 2.85, r2: 9.00, r3: 1.15 }, codedValues: { f1: alpha, f2: 0, f3: 0 }, actualValues: { f1: 48.40896415253714, f2: 3, f3: 30 } },
    { id: 'std-11', block: 1, isAxial: true, isCenter: false, runOrder: 11, stdOrder: 11, responses: { r1: 2.62, r2: 7.70, r3: 1.08 }, codedValues: { f1: 0, f2: -alpha, f3: 0 }, actualValues: { f1: 40, f2: 2.159103584746286, f3: 30 } },
    { id: 'std-12', block: 1, isAxial: true, isCenter: false, runOrder: 12, stdOrder: 12, responses: { r1: 2.18, r2: 8.40, r3: 1.30 }, codedValues: { f1: 0, f2: alpha, f3: 0 }, actualValues: { f1: 40, f2: 3.840896415253714, f3: 30 } },
    { id: 'std-13', block: 1, isAxial: true, isCenter: false, runOrder: 13, stdOrder: 13, responses: { r1: 2.28, r2: 7.90, r3: 1.20 }, codedValues: { f1: 0, f2: 0, f3: -alpha }, actualValues: { f1: 40, f2: 3, f3: 21.59103584746286 } },
    { id: 'std-14', block: 1, isAxial: true, isCenter: false, runOrder: 14, stdOrder: 14, responses: { r1: 2.88, r2: 8.80, r3: 1.12 }, codedValues: { f1: 0, f2: 0, f3: alpha }, actualValues: { f1: 40, f2: 3, f3: 38.40896415253714 } },
    { id: 'std-15', block: 1, isAxial: false, isCenter: true, runOrder: 15, stdOrder: 15, responses: { r1: 2.78, r2: 8.40, r3: 1.14 }, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3, f3: 30 } },
    { id: 'std-16', block: 1, isAxial: false, isCenter: true, runOrder: 16, stdOrder: 16, responses: { r1: 2.80, r2: 8.42, r3: 1.13 }, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3, f3: 30 } },
    { id: 'std-17', block: 1, isAxial: false, isCenter: true, runOrder: 17, stdOrder: 17, responses: { r1: 2.76, r2: 8.38, r3: 1.15 }, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3, f3: 30 } },
    { id: 'std-18', block: 1, isAxial: false, isCenter: true, runOrder: 18, stdOrder: 18, responses: { r1: 2.79, r2: 8.41, r3: 1.14 }, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3, f3: 30 } },
    { id: 'std-19', block: 1, isAxial: false, isCenter: true, runOrder: 19, stdOrder: 19, responses: { r1: 2.77, r2: 8.39, r3: 1.16 }, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3, f3: 30 } },
    { id: 'std-20', block: 1, isAxial: false, isCenter: true, runOrder: 20, stdOrder: 20, responses: { r1: 2.81, r2: 8.43, r3: 1.12 }, codedValues: { f1: 0, f2: 0, f3: 0 }, actualValues: { f1: 40, f2: 3, f3: 30 } },
  ];

  const criteria: Record<string, OptimizationCriterion> = {
    f1: { id: 'f1', code: 'A', goal: 'in_range', name: 'Organic Phase', type: 'factor', units: '%', importance: 3, lowerLimit: 35, upperLimit: 45, lowerWeight: 1, upperWeight: 1 },
    f2: { id: 'f2', code: 'B', goal: 'in_range', name: 'pH', type: 'factor', units: 'pH', importance: 3, lowerLimit: 2.5, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1 },
    f3: { id: 'f3', code: 'C', goal: 'in_range', name: 'Temperature', type: 'factor', units: '°C', importance: 3, lowerLimit: 25, upperLimit: 35, lowerWeight: 1, upperWeight: 1 },
    r1: { id: 'r1', code: 'R1', goal: 'maximize', name: 'Resolution', type: 'response', units: '', importance: 3, lowerLimit: 2.0, upperLimit: 3.09, lowerWeight: 1, upperWeight: 1 },
    r2: { id: 'r2', code: 'R2', goal: 'minimize', name: 'Retention Time', type: 'response', units: 'min', importance: 3, lowerLimit: 7.2, upperLimit: 9.4, lowerWeight: 1, upperWeight: 1 },
    r3: { id: 'r3', code: 'R3', goal: 'target', name: 'Tailing Factor', type: 'response', units: '', importance: 3, lowerLimit: 1.08, upperLimit: 1.3, targetValue: 1.19, lowerWeight: 1, upperWeight: 1 },
  };

  test('Produces exactly 18 solutions matching Design-Expert 13 with duplicateFilter = 0.5', () => {
    const design = { config: { factors, responses }, runs, analyses: {} };
    const r1Fit = refitResponseModel(design, 'r1', 'Quadratic');
    const r2Fit = refitResponseModel(design, 'r2', 'Quadratic');
    const r3Fit = refitResponseModel(design, 'r3', 'Quadratic');

    const options: OptimizationOptions = {
      maxSolutions: 100,
      duplicateFilter: 0.5,
      simplexFraction: 0.1,
      numberDesignPoints: 50,
      randomStartingPoints: 100,
      includeStdError: false,
    };

    const optResult = executeNumericalOptimization(
      factors,
      responses,
      { r1: r1Fit, r2: r2Fit, r3: r3Fit },
      criteria,
      options,
      runs
    );

    // 1. Solution count parity: exactly 18 solutions
    expect(optResult.solutions).toHaveLength(18);

    // 2. Best desirability parity: 0.656
    expect(optResult.solutions[0].desirability).toBeCloseTo(0.656, 3);

    // 3. Optimal factor settings parity
    const best = optResult.solutions[0];
    expect(best.factors.f1).toBeCloseTo(37.52, 1);
    expect(best.factors.f2).toBeCloseTo(3.19, 2);
    expect(best.factors.f3).toBeCloseTo(26.82, 1);

    // 4. Optimal response predictions parity
    expect(best.predictions.r1).toBeCloseTo(2.51, 1);
    expect(best.predictions.r2).toBeCloseTo(8.08, 1);
    expect(best.predictions.r3).toBeCloseTo(1.19, 2);

    // 5. Monotonic desirability ordering
    for (let i = 1; i < optResult.solutions.length; i++) {
      expect(optResult.solutions[i - 1].desirability).toBeGreaterThanOrEqual(optResult.solutions[i].desirability);
    }

    // 6. Enforces duplicate filter threshold of 0.5% (0.005) between all pairs
    const span1 = 45 - 35;
    const span2 = 3.5 - 2.5;
    const span3 = 35 - 25;
    const minThreshold = 0.5 / 100;

    for (let i = 0; i < optResult.solutions.length; i++) {
      for (let j = i + 1; j < optResult.solutions.length; j++) {
        const d1 = (optResult.solutions[i].factors.f1 - optResult.solutions[j].factors.f1) / span1;
        const d2 = (optResult.solutions[i].factors.f2 - optResult.solutions[j].factors.f2) / span2;
        const d3 = (optResult.solutions[i].factors.f3 - optResult.solutions[j].factors.f3) / span3;
        const dist = Math.sqrt(d1 * d1 + d2 * d2 + d3 * d3);
        expect(dist).toBeGreaterThanOrEqual(minThreshold - 1e-6);
      }
    }

    // 7. All solutions respect factor bounds
    for (const sol of optResult.solutions) {
      expect(sol.factors.f1).toBeGreaterThanOrEqual(35 - 1e-4);
      expect(sol.factors.f1).toBeLessThanOrEqual(45 + 1e-4);
      expect(sol.factors.f2).toBeGreaterThanOrEqual(2.5 - 1e-4);
      expect(sol.factors.f2).toBeLessThanOrEqual(3.5 + 1e-4);
      expect(sol.factors.f3).toBeGreaterThanOrEqual(25 - 1e-4);
      expect(sol.factors.f3).toBeLessThanOrEqual(35 + 1e-4);
    }
  });
});
