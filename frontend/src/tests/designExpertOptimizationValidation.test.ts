import { describe, test, expect } from 'vitest';
import {
  actualToCoded,
  codedToActual,
  calculateIndividualDesirability,
  calculateCombinedDesirability,
  predictModelResponse,
  executeNumericalOptimization,
  generateOptimizationStartingPointsWithDiagnostic,
  generateOptimizationStartingPoints,
  FactorBounds,
  FittedModelRef
} from '../lib/optimization/solver';
import {
  OptimizationCriterion,
  DEFAULT_OPTIMIZATION_OPTIONS
} from '../lib/optimization/types';
import { refitResponseModel } from '../lib/statistics/rsm/modelFitting';
import { exportOptimizationDiagnosticReport } from '../lib/projectIO';

describe('AQbD Studio — Design-Expert 13 Numerical Optimization Validation Suite', () => {

  // =========================================================================
  // 1. ALL FIVE RESPONSE GOALS + FACTOR GOALS
  // =========================================================================
  describe('1. Individual Desirability Goals & Functions', () => {

    test('1.1 Response Goal: None (Excluded from optimization)', () => {
      const critNone: OptimizationCriterion = {
        id: 'r_none', name: 'Ignored', type: 'response', goal: 'none',
        lowerLimit: 10, upperLimit: 50, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      // For goal 'none', individual desirability is 1, and it is excluded from combined D
      expect(calculateIndividualDesirability(5, critNone)).toBe(1);
      expect(calculateIndividualDesirability(30, critNone)).toBe(1);
      expect(calculateIndividualDesirability(100, critNone)).toBe(1);

      // Verify combined desirability completely ignores 'none' criteria
      const activeCrit: Record<string, OptimizationCriterion> = {
        r1: { id: 'r1', name: 'Yield', type: 'response', goal: 'maximize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r_none: critNone
      };
      const D = calculateCombinedDesirability({ r1: 0.8, r_none: 1.0 }, activeCrit);
      expect(D).toBeCloseTo(0.8, 6);
    });

    test('1.2 Response Goal: Maximize (Boundaries and Weights)', () => {
      const critLinear: OptimizationCriterion = {
        id: 'r_max', name: 'Purity', type: 'response', goal: 'maximize',
        lowerLimit: 80, upperLimit: 100, lowerWeight: 1.0, upperWeight: 1.0, importance: 3
      };

      // Boundary handling
      expect(calculateIndividualDesirability(70, critLinear)).toBe(0);
      expect(calculateIndividualDesirability(80, critLinear)).toBe(0);
      expect(calculateIndividualDesirability(100, critLinear)).toBe(1);
      expect(calculateIndividualDesirability(110, critLinear)).toBe(1);

      // Linear ramp: at y = 90 (halfway), d = 0.5
      expect(calculateIndividualDesirability(90, critLinear)).toBeCloseTo(0.5, 6);

      // Convex weight s = 2.0: d = (0.5)^2 = 0.25
      const critConvex: OptimizationCriterion = { ...critLinear, lowerWeight: 2.0 };
      expect(calculateIndividualDesirability(90, critConvex)).toBeCloseTo(0.25, 6);

      // Concave weight s = 0.5: d = sqrt(0.5) = 0.707107
      const critConcave: OptimizationCriterion = { ...critLinear, lowerWeight: 0.5 };
      expect(calculateIndividualDesirability(90, critConcave)).toBeCloseTo(Math.sqrt(0.5), 6);
    });

    test('1.3 Response Goal: Minimize (Boundaries and Weights)', () => {
      const critLinear: OptimizationCriterion = {
        id: 'r_min', name: 'Impurity', type: 'response', goal: 'minimize',
        lowerLimit: 0.5, upperLimit: 2.5, lowerWeight: 1.0, upperWeight: 1.0, importance: 3
      };

      // Boundary handling
      expect(calculateIndividualDesirability(0.2, critLinear)).toBe(1);
      expect(calculateIndividualDesirability(0.5, critLinear)).toBe(1);
      expect(calculateIndividualDesirability(2.5, critLinear)).toBe(0);
      expect(calculateIndividualDesirability(3.0, critLinear)).toBe(0);

      // Linear ramp: at y = 1.5 (halfway), d = (2.5 - 1.5)/2 = 0.5
      expect(calculateIndividualDesirability(1.5, critLinear)).toBeCloseTo(0.5, 6);

      // Convex weight t = 2.0: d = (0.5)^2 = 0.25
      const critConvex: OptimizationCriterion = { ...critLinear, upperWeight: 2.0 };
      expect(calculateIndividualDesirability(1.5, critConvex)).toBeCloseTo(0.25, 6);

      // Concave weight t = 0.5: d = sqrt(0.5) = 0.707107
      const critConcave: OptimizationCriterion = { ...critLinear, upperWeight: 0.5 };
      expect(calculateIndividualDesirability(1.5, critConcave)).toBeCloseTo(Math.sqrt(0.5), 6);
    });

    test('1.4 Response Goal: Target (Ramps, Target Peak, and Weights)', () => {
      const critTarget: OptimizationCriterion = {
        id: 'r_tgt', name: 'Viscosity', type: 'response', goal: 'target',
        lowerLimit: 10, upperLimit: 30, targetValue: 20,
        lowerWeight: 1.0, upperWeight: 1.0, importance: 3
      };

      // Outside limits -> d = 0
      expect(calculateIndividualDesirability(9.9, critTarget)).toBe(0);
      expect(calculateIndividualDesirability(30.1, critTarget)).toBe(0);

      // Exact target -> d = 1
      expect(calculateIndividualDesirability(20.0, critTarget)).toBe(1);

      // Left ramp: at y = 15, (15 - 10)/(20 - 10) = 0.5
      expect(calculateIndividualDesirability(15.0, critTarget)).toBeCloseTo(0.5, 6);

      // Right ramp: at y = 25, (30 - 25)/(30 - 20) = 0.5
      expect(calculateIndividualDesirability(25.0, critTarget)).toBeCloseTo(0.5, 6);

      // Asymmetric weights: lowerWeight = 2 (convex left), upperWeight = 0.5 (concave right)
      const critAsym: OptimizationCriterion = { ...critTarget, lowerWeight: 2.0, upperWeight: 0.5 };
      expect(calculateIndividualDesirability(15.0, critAsym)).toBeCloseTo(0.25, 6);
      expect(calculateIndividualDesirability(25.0, critAsym)).toBeCloseTo(Math.sqrt(0.5), 6);
    });

    test('1.5 Response Goal: In Range (Step Function & Exponent Rule)', () => {
      const critRange: OptimizationCriterion = {
        id: 'r_range', name: 'pH', type: 'response', goal: 'in_range',
        lowerLimit: 6.5, upperLimit: 7.5, lowerWeight: 1, upperWeight: 1, importance: 3
      };

      // Step function inside [6.5, 7.5]
      expect(calculateIndividualDesirability(6.49, critRange)).toBe(0);
      expect(calculateIndividualDesirability(6.50, critRange)).toBe(1);
      expect(calculateIndividualDesirability(7.00, critRange)).toBe(1);
      expect(calculateIndividualDesirability(7.50, critRange)).toBe(1);
      expect(calculateIndividualDesirability(7.51, critRange)).toBe(0);
    });

    test('1.6 Factor Goal: Equal To (Exact Value Locking)', () => {
      const factorBounds = { low: 20, high: 40 };
      const critExactActual: OptimizationCriterion = {
        id: 'f_temp', name: 'Temperature', type: 'factor', goal: 'equal_to',
        lowerLimit: 20, upperLimit: 40, targetValue: 30.0,
        lowerWeight: 1, upperWeight: 1, importance: 3
      };

      // Exact target is 1.0
      expect(calculateIndividualDesirability(30.0, critExactActual)).toBe(1.0);
      // Small deviation within strict tolerance (0.2% of 20 = 0.04)
      expect(calculateIndividualDesirability(30.03, critExactActual)).toBe(1.0);
      // Large deviation decays
      expect(calculateIndividualDesirability(35.0, critExactActual)).toBe(0);
    });
  });

  // =========================================================================
  // 2. WEIGHT VS IMPORTANCE SEPARATION & COMBINED DESIRABILITY
  // =========================================================================
  describe('2. Weight vs Importance Separation & Combined Desirability D', () => {

    test('2.1 Importance alters power in geometric mean without affecting individual d_i', () => {
      const critR1_imp1: OptimizationCriterion = {
        id: 'r1', name: 'R1', type: 'response', goal: 'maximize',
        lowerLimit: 0, upperLimit: 100, lowerWeight: 1.0, upperWeight: 1.0, importance: 1
      };
      const critR1_imp5: OptimizationCriterion = {
        id: 'r1', name: 'R1', type: 'response', goal: 'maximize',
        lowerLimit: 0, upperLimit: 100, lowerWeight: 1.0, upperWeight: 1.0, importance: 5
      };

      // Individual desirability at y = 50 is identical (0.5) regardless of importance
      expect(calculateIndividualDesirability(50, critR1_imp1)).toBe(0.5);
      expect(calculateIndividualDesirability(50, critR1_imp5)).toBe(0.5);

      // Now combine with R2 (d2 = 0.9, imp = 3)
      const critR2: OptimizationCriterion = {
        id: 'r2', name: 'R2', type: 'response', goal: 'maximize',
        lowerLimit: 0, upperLimit: 100, lowerWeight: 1.0, upperWeight: 1.0, importance: 3
      };

      // Case A: R1 importance = 1, R2 importance = 3 -> sum(r) = 4
      // D = (0.5^1 * 0.9^3)^(1/4) = (0.5 * 0.729)^0.25 = 0.3645^0.25 = 0.77747
      const D_A = calculateCombinedDesirability(
        { r1: 0.5, r2: 0.9 },
        { r1: critR1_imp1, r2: critR2 }
      );
      expect(D_A).toBeCloseTo(Math.pow(0.5 * Math.pow(0.9, 3), 1 / 4), 6);

      // Case B: R1 importance = 5, R2 importance = 3 -> sum(r) = 8
      // D = (0.5^5 * 0.9^3)^(1/8) = (0.03125 * 0.729)^0.125 = 0.02278125^0.125 = 0.62254
      const D_B = calculateCombinedDesirability(
        { r1: 0.5, r2: 0.9 },
        { r1: critR1_imp5, r2: critR2 }
      );
      expect(D_B).toBeCloseTo(Math.pow(Math.pow(0.5, 5) * Math.pow(0.9, 3), 1 / 8), 6);
      expect(D_B).toBeLessThan(D_A); // Heavy importance on low d1 pulls D down
    });

    test('2.2 Zero desirability absorption: if any d_i = 0, combined D is strictly 0', () => {
      const criteria: Record<string, OptimizationCriterion> = {
        r1: { id: 'r1', name: 'R1', type: 'response', goal: 'maximize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 5 },
        r2: { id: 'r2', name: 'R2', type: 'response', goal: 'maximize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 1 },
      };

      expect(calculateCombinedDesirability({ r1: 1.0, r2: 0.0 }, criteria)).toBe(0);
      expect(calculateCombinedDesirability({ r1: 0.0, r2: 1.0 }, criteria)).toBe(0);
    });

    test('2.3 Stat-Ease Exponent Rule: In-Range criteria excluded from root denominator sum(r_i)', () => {
      const criteria: Record<string, OptimizationCriterion> = {
        f1: { id: 'f1', name: 'Temp', type: 'factor', goal: 'in_range', lowerLimit: 20, upperLimit: 40, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r1: { id: 'r1', name: 'Yield', type: 'response', goal: 'maximize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 4 },
      };

      // f1 is in range (d = 1.0), r1 has d = 0.8
      // Stat-Ease rule: f1 importance (3) is NOT added to denominator: sum(r) = 4 (not 7)
      // D = (1.0^3 * 0.8^4)^(1/4) = (0.8^4)^(1/4) = 0.80
      const D = calculateCombinedDesirability({ f1: 1.0, r1: 0.8 }, criteria);
      expect(D).toBeCloseTo(0.80, 6);

      // If in-range factor is violated (d = 0.0), D must collapse to 0
      const D_violated = calculateCombinedDesirability({ f1: 0.0, r1: 0.8 }, criteria);
      expect(D_violated).toBe(0);
    });
  });

  // =========================================================================
  // 3. STARTING POINTS 5-STAGE PIPELINE & 121 VS 109 PARITY RESOLUTION
  // =========================================================================
  describe('3. Starting Points 5-Stage Pipeline Parity (121 vs 109)', () => {
    const factors: FactorBounds[] = [
      { id: 'f1', name: 'Organic Phase', low: 35, high: 45, units: '%' },
      { id: 'f2', name: 'pH', low: 2.5, high: 3.5, units: 'pH' },
      { id: 'f3', name: 'Temperature', low: 25, high: 35, units: '°C' },
    ];

    const alpha = 1.681792830507429;
    const ccdRuns = [
      // 8 Factorial points (Std 1-8): All within bounds [35, 45], [2.5, 3.5], [25, 35]
      { actualValues: { f1: 35, f2: 2.5, f3: 25 } },
      { actualValues: { f1: 45, f2: 2.5, f3: 25 } },
      { actualValues: { f1: 35, f2: 3.5, f3: 25 } },
      { actualValues: { f1: 45, f2: 3.5, f3: 25 } },
      { actualValues: { f1: 35, f2: 2.5, f3: 35 } },
      { actualValues: { f1: 45, f2: 2.5, f3: 35 } },
      { actualValues: { f1: 35, f2: 3.5, f3: 35 } },
      { actualValues: { f1: 45, f2: 3.5, f3: 35 } },
      // 6 Axial points (Std 9-14): ALL 6 LIE OUTSIDE FACTOR BOUNDS
      { actualValues: { f1: 31.591, f2: 3.0, f3: 30 } }, // f1 < 35 -> OUT OF BOUNDS
      { actualValues: { f1: 48.409, f2: 3.0, f3: 30 } }, // f1 > 45 -> OUT OF BOUNDS
      { actualValues: { f1: 40, f2: 2.1591, f3: 30 } }, // f2 < 2.5 -> OUT OF BOUNDS
      { actualValues: { f1: 40, f2: 3.8409, f3: 30 } }, // f2 > 3.5 -> OUT OF BOUNDS
      { actualValues: { f1: 40, f2: 3.0, f3: 21.591 } }, // f3 < 25 -> OUT OF BOUNDS
      { actualValues: { f1: 40, f2: 3.0, f3: 38.409 } }, // f3 > 35 -> OUT OF BOUNDS
      // 6 Center points (Std 15-20): All at (40, 3.0, 30) -> IDENTICAL TO MIDPOINT
      { actualValues: { f1: 40, f2: 3.0, f3: 30 } },
      { actualValues: { f1: 40, f2: 3.0, f3: 30 } },
      { actualValues: { f1: 40, f2: 3.0, f3: 30 } },
      { actualValues: { f1: 40, f2: 3.0, f3: 30 } },
      { actualValues: { f1: 40, f2: 3.0, f3: 30 } },
      { actualValues: { f1: 40, f2: 3.0, f3: 30 } },
    ];

    test('3.1 Generates exactly 109 starting points for CCD with complete 5-stage diagnostic', () => {
      const { startingPoints, diagnostic } = generateOptimizationStartingPointsWithDiagnostic(
        factors,
        ccdRuns,
        DEFAULT_OPTIMIZATION_OPTIONS
      );

      // Verify exact stage counts
      expect(diagnostic.initialDesignCandidates).toBe(21); // 1 midpoint + 20 runs
      expect(diagnostic.rejectedOutOfBounds).toBe(6); // 6 axial runs outside bounds
      expect(diagnostic.rejectedDuplicates).toBe(6); // 6 center runs duplicating midpoint
      expect(diagnostic.acceptedDesignPoints).toBe(9); // 1 midpoint + 8 factorial corners
      expect(diagnostic.randomPointsGenerated).toBe(100); // 100 random starts
      expect(diagnostic.totalStartingPoints).toBe(109); // Exactly 109!
      expect(startingPoints).toHaveLength(109);

      // Verify sources and statuses
      expect(startingPoints[0].source).toBe('midpoint');
      for (let i = 1; i < 9; i++) {
        expect(startingPoints[i].source).toBe('design_point');
      }
      for (let i = 9; i < 109; i++) {
        expect(startingPoints[i].source).toBe('random');
      }

      // Verify all 109 points strictly obey factor bounds
      for (const sp of startingPoints) {
        expect(sp.factors.f1).toBeGreaterThanOrEqual(35 - 1e-4);
        expect(sp.factors.f1).toBeLessThanOrEqual(45 + 1e-4);
        expect(sp.factors.f2).toBeGreaterThanOrEqual(2.5 - 1e-4);
        expect(sp.factors.f2).toBeLessThanOrEqual(3.5 + 1e-4);
        expect(sp.factors.f3).toBeGreaterThanOrEqual(25 - 1e-4);
        expect(sp.factors.f3).toBeLessThanOrEqual(35 + 1e-4);
      }
    });

    test('3.2 Diagnostic report export includes full 5-stage breakdown and solutions', () => {
      const mockResult = {
        runId: 'opt-test-109',
        timestamp: '2026-10-17T04:30:00Z',
        status: 'optimal',
        message: 'Converged to global optima',
        startingPoints: [
          { pointNumber: 1, source: 'midpoint', status: 'accepted', factors: { f1: 40, f2: 3.0, f3: 30 } }
        ],
        solutions: [
          {
            solutionNumber: 1,
            factors: { f1: 41.535, f2: 2.873, f3: 31.926 },
            predictions: { r1: 2.9386 },
            individualDesirability: { r1: 0.95 },
            desirability: 0.95
          }
        ],
        startingPointsDiagnostic: {
          initialDesignCandidates: 21,
          rejectedOutOfBounds: 6,
          rejectedDuplicates: 6,
          acceptedDesignPoints: 9,
          randomPointsGenerated: 100,
          rejectedInvalidPredictions: 0,
          totalStartingPoints: 109,
          stageDetails: {
            stage1_initialCandidates: 21,
            stage2_rejectedOutOfBounds: 6,
            stage3_rejectedDuplicates: 6,
            stage4_randomPoints: 100,
            stage5_rejectedInvalidPredictions: 0,
            stage6_finalStartingPoints: 109,
          }
        }
      };

      const csv = exportOptimizationDiagnosticReport(mockResult, factors, [{ id: 'r1', name: 'Resolution' }]);
      expect(csv).toContain('[SECTION 1: OPTIMIZATION RUN SUMMARY]');
      expect(csv).toContain('[SECTION 2: 5-STAGE STARTING POINTS PIPELINE DIAGNOSTIC]');
      expect(csv).toContain('Stage 1,Initial Candidate Pool,21');
      expect(csv).toContain('Stage 2,Rejected Out-of-Bounds,6');
      expect(csv).toContain('Stage 3,Rejected Duplicates,6');
      expect(csv).toContain('Stage 4,Accepted Design Starts,9');
      expect(csv).toContain('Stage 5,Random Starts Generated,100');
      expect(csv).toContain('Stage 6,Final Starting Points Used,109');
      expect(csv).toContain('[SECTION 4: OPTIMIZATION SOLUTIONS]');
      expect(csv).toContain('41.535');
    });
  });

  // =========================================================================
  // 4. RESPONSE SURFACE PREDICTION ACCURACY & REGRESSION INTEGRITY
  // =========================================================================
  describe('4. Complete Optimization Pipeline & Invalidation Refresh', () => {
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
    const hplcRuns = [
      { id: 'r-1', stdOrder: 1, runOrder: 9, actualValues: { f1: 35, f2: 2.5, f3: 25 }, responses: { r1: 2.00, r2: 8.75, r3: 1.265 } },
      { id: 'r-2', stdOrder: 2, runOrder: 12, actualValues: { f1: 45, f2: 2.5, f3: 25 }, responses: { r1: 2.59, r2: 9.15, r3: 1.125 } },
      { id: 'r-3', stdOrder: 3, runOrder: 20, actualValues: { f1: 35, f2: 3.5, f3: 25 }, responses: { r1: 2.02, r2: 9.20, r3: 1.285 } },
      { id: 'r-4', stdOrder: 4, runOrder: 11, actualValues: { f1: 45, f2: 3.5, f3: 25 }, responses: { r1: 2.04, r2: 10.50, r3: 1.205 } },
      { id: 'r-5', stdOrder: 5, runOrder: 10, actualValues: { f1: 35, f2: 2.5, f3: 35 }, responses: { r1: 2.17, r2: 8.23, r3: 1.315 } },
      { id: 'r-6', stdOrder: 6, runOrder: 1, actualValues: { f1: 45, f2: 2.5, f3: 35 }, responses: { r1: 3.08, r2: 9.07, r3: 1.135 } },
      { id: 'r-7', stdOrder: 7, runOrder: 7, actualValues: { f1: 35, f2: 3.5, f3: 35 }, responses: { r1: 2.00, r2: 8.28, r3: 1.375 } },
      { id: 'r-8', stdOrder: 8, runOrder: 19, actualValues: { f1: 45, f2: 3.5, f3: 35 }, responses: { r1: 2.35, r2: 10.02, r3: 1.295 } },
      { id: 'r-9', stdOrder: 9, runOrder: 16, actualValues: { f1: 31.591, f2: 3.0, f3: 30 }, responses: { r1: 1.777, r2: 8.439, r3: 1.394 } },
      { id: 'r-10', stdOrder: 10, runOrder: 4, actualValues: { f1: 48.409, f2: 3.0, f3: 30 }, responses: { r1: 2.588, r2: 10.258, r3: 1.186 } },
      { id: 'r-11', stdOrder: 11, runOrder: 5, actualValues: { f1: 40, f2: 2.1591, f3: 30 }, responses: { r1: 2.604, r2: 8.527, r3: 1.176 } },
      { id: 'r-12', stdOrder: 12, runOrder: 2, actualValues: { f1: 40, f2: 3.8409, f3: 30 }, responses: { r1: 1.968, r2: 9.604, r3: 1.290 } },
      { id: 'r-13', stdOrder: 13, runOrder: 14, actualValues: { f1: 40, f2: 3.0, f3: 21.591 }, responses: { r1: 2.259, r2: 9.345, r3: 1.164 } },
      { id: 'r-14', stdOrder: 14, runOrder: 6, actualValues: { f1: 40, f2: 3.0, f3: 38.409 }, responses: { r1: 2.682, r2: 8.604, r3: 1.245 } },
      { id: 'r-15', stdOrder: 15, runOrder: 3, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.53, r3: 1.12 } },
      { id: 'r-16', stdOrder: 16, runOrder: 18, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.78, r2: 8.45, r3: 1.12 } },
      { id: 'r-17', stdOrder: 17, runOrder: 17, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.42, r3: 1.11 } },
      { id: 'r-18', stdOrder: 18, runOrder: 15, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.55, r3: 1.11 } },
      { id: 'r-19', stdOrder: 19, runOrder: 13, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.40, r3: 1.14 } },
      { id: 'r-20', stdOrder: 20, runOrder: 8, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.80, r2: 8.58, r3: 1.13 } },
    ];

    test('4.1 Fits models and converges to solutions with startingPointsDiagnostic attached', () => {
      const design = {
        config: { factors, responses },
        runs: hplcRuns,
        analyses: {} as Record<string, any>,
      };

      const resAnalysis = refitResponseModel(design, 'r1', 'Quadratic');
      const rtAnalysis = refitResponseModel(design, 'r2', 'Quadratic');
      const tfAnalysis = refitResponseModel(design, 'r3', 'Quadratic');

      const criteria: Record<string, OptimizationCriterion> = {
        f1: { id: 'f1', name: 'Organic', type: 'factor', goal: 'in_range', lowerLimit: 35, upperLimit: 45, lowerWeight: 1, upperWeight: 1, importance: 3 },
        f2: { id: 'f2', name: 'pH', type: 'factor', goal: 'in_range', lowerLimit: 2.5, upperLimit: 3.5, lowerWeight: 1, upperWeight: 1, importance: 3 },
        f3: { id: 'f3', name: 'Temperature', type: 'factor', goal: 'in_range', lowerLimit: 25, upperLimit: 35, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r1: { id: 'r1', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 2.0, upperLimit: 3.0, lowerWeight: 1, upperWeight: 1, importance: 4 },
        r2: { id: 'r2', name: 'Retention Time', type: 'response', goal: 'minimize', lowerLimit: 8.0, upperLimit: 10.0, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r3: { id: 'r3', name: 'Tailing Factor', type: 'response', goal: 'target', lowerLimit: 1.0, upperLimit: 1.3, targetValue: 1.15, lowerWeight: 1, upperWeight: 1, importance: 3 },
      };

      const result = executeNumericalOptimization(
        factors,
        responses,
        { r1: resAnalysis, r2: rtAnalysis, r3: tfAnalysis },
        criteria,
        DEFAULT_OPTIMIZATION_OPTIONS,
        hplcRuns
      );

      expect(['optimal', 'suboptimal']).toContain(result.status);
      expect(result.startingPoints).toHaveLength(109);
      expect(result.startingPointsDiagnostic?.totalStartingPoints).toBe(109);
      expect(result.startingPointsDiagnostic?.rejectedOutOfBounds).toBe(6);
      expect(result.startingPointsDiagnostic?.rejectedDuplicates).toBe(6);
      expect(result.solutions.length).toBeGreaterThan(0);
      expect(result.solutions[0].desirability).toBeGreaterThan(0.70);
    });

    test('4.2 Stale model is automatically invalidated and refitted when response data changes', () => {
      const design = {
        config: { factors, responses },
        runs: hplcRuns,
        analyses: {} as Record<string, any>,
      };

      // Fit initial model at T0
      const initialAnalysis = refitResponseModel(design, 'r1', 'Quadratic');
      const initialCoeff = initialAnalysis.fittedModel.coefficients[0]; // Intercept

      // Modify Run 15 response from 2.79 to 5.00 at T1
      const modifiedRuns = hplcRuns.map(r => {
        if (r.id === 'r-15') {
          return { ...r, responses: { ...r.responses, r1: 5.00 } };
        }
        return r;
      });

      // Mark analysis outdated by setting timestamp to past and runsModifiedAt to now
      const staleAnalysis = {
        ...initialAnalysis,
        timestamp: new Date(Date.now() - 60000).toISOString(),
        isOutdated: true,
      };

      const criteria: Record<string, OptimizationCriterion> = {
        f1: { id: 'f1', name: 'Organic', type: 'factor', goal: 'in_range', lowerLimit: 35, upperLimit: 45, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r1: { id: 'r1', name: 'Resolution', type: 'response', goal: 'maximize', lowerLimit: 2.0, upperLimit: 5.0, lowerWeight: 1, upperWeight: 1, importance: 4 },
      };

      const now = new Date().toISOString();
      const result = executeNumericalOptimization(
        factors,
        responses,
        { r1: staleAnalysis },
        criteria,
        DEFAULT_OPTIMIZATION_OPTIONS,
        modifiedRuns,
        now
      );

      // Verify solver refitted the model using modified data
      expect(result.solutions.length).toBeGreaterThan(0);
      const refittedPred = result.solutions[0].predictions.r1;
      expect(refittedPred).toBeGreaterThan(2.0);
    });
  });
});
