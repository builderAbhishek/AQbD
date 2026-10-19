import { describe, test, expect } from 'vitest';
import {
  actualToCoded,
  codedToActual,
  calculateIndividualDesirability,
  calculateCombinedDesirability,
  predictModelResponse,
  executeNumericalOptimization,
  FactorBounds,
  FittedModelRef
} from '../lib/optimization/solver';
import {
  OptimizationCriterion,
  DEFAULT_OPTIMIZATION_OPTIONS
} from '../lib/optimization/types';
import { refitResponseModel } from '../lib/statistics/rsm/modelFitting';
import { fitModel } from '../lib/statistics/rsm/fitModel';
import { createModelMatrix } from '../lib/statistics/rsm/modelMatrix';

describe('Design-Expert 13 Parity & Universal Regression Suite', () => {

  // =========================================================================
  // 1. STAT-EASE EXACT DESIRABILITY FUNCTION MATHEMATICS
  // =========================================================================
  describe('1. Stat-Ease Myers & Montgomery Desirability Mathematics', () => {

    test('1.1 Maximize goal with linear and non-linear weights', () => {
      const critLinear: OptimizationCriterion = {
        id: 'r1', name: 'Yield', type: 'response', goal: 'maximize',
        lowerLimit: 50, upperLimit: 100, lowerWeight: 1.0, upperWeight: 1.0, importance: 3
      };

      // Below lower limit
      expect(calculateIndividualDesirability(40, critLinear)).toBe(0);
      expect(calculateIndividualDesirability(50, critLinear)).toBe(0);
      // Above upper limit
      expect(calculateIndividualDesirability(100, critLinear)).toBe(1);
      expect(calculateIndividualDesirability(110, critLinear)).toBe(1);
      // Midpoint: (75 - 50)/(100 - 50) = 0.5
      expect(calculateIndividualDesirability(75, critLinear)).toBeCloseTo(0.5, 6);

      // Convex weight s = 2.0 -> (0.5)^2 = 0.25
      const critConvex: OptimizationCriterion = { ...critLinear, lowerWeight: 2.0 };
      expect(calculateIndividualDesirability(75, critConvex)).toBeCloseTo(0.25, 6);

      // Concave weight s = 0.5 -> sqrt(0.5) = 0.707107
      const critConcave: OptimizationCriterion = { ...critLinear, lowerWeight: 0.5 };
      expect(calculateIndividualDesirability(75, critConcave)).toBeCloseTo(Math.sqrt(0.5), 6);
    });

    test('1.2 Minimize goal with linear and non-linear weights', () => {
      const critLinear: OptimizationCriterion = {
        id: 'r2', name: 'Impurity', type: 'response', goal: 'minimize',
        lowerLimit: 0.1, upperLimit: 1.1, lowerWeight: 1.0, upperWeight: 1.0, importance: 3
      };

      // Below lower limit -> d = 1
      expect(calculateIndividualDesirability(0.05, critLinear)).toBe(1);
      expect(calculateIndividualDesirability(0.1, critLinear)).toBe(1);
      // Above upper limit -> d = 0
      expect(calculateIndividualDesirability(1.1, critLinear)).toBe(0);
      expect(calculateIndividualDesirability(1.5, critLinear)).toBe(0);
      // Midpoint: (1.1 - 0.6)/(1.1 - 0.1) = 0.5
      expect(calculateIndividualDesirability(0.6, critLinear)).toBeCloseTo(0.5, 6);

      // Convex weight t = 2.0 -> (0.5)^2 = 0.25
      const critConvex: OptimizationCriterion = { ...critLinear, upperWeight: 2.0 };
      expect(calculateIndividualDesirability(0.6, critConvex)).toBeCloseTo(0.25, 6);
    });

    test('1.3 Target goal ramps up to target and down to upper limit', () => {
      const critTarget: OptimizationCriterion = {
        id: 'r3', name: 'pH', type: 'response', goal: 'target',
        lowerLimit: 6.0, upperLimit: 8.0, targetValue: 7.0,
        lowerWeight: 1.0, upperWeight: 1.0, importance: 3
      };

      // Outside limits
      expect(calculateIndividualDesirability(5.9, critTarget)).toBe(0);
      expect(calculateIndividualDesirability(8.1, critTarget)).toBe(0);
      // Exact target -> d = 1
      expect(calculateIndividualDesirability(7.0, critTarget)).toBe(1);
      // Halfway left: 6.5 -> (6.5 - 6.0)/(7.0 - 6.0) = 0.5
      expect(calculateIndividualDesirability(6.5, critTarget)).toBeCloseTo(0.5, 6);
      // Halfway right: 7.5 -> (8.0 - 7.5)/(8.0 - 7.0) = 0.5
      expect(calculateIndividualDesirability(7.5, critTarget)).toBeCloseTo(0.5, 6);
    });

    test('1.4 In Range and None goals', () => {
      const critRange: OptimizationCriterion = {
        id: 'f1', name: 'Temp', type: 'factor', goal: 'in_range',
        lowerLimit: 20, upperLimit: 40, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      expect(calculateIndividualDesirability(30, critRange)).toBe(1);
      expect(calculateIndividualDesirability(20, critRange)).toBe(1);
      expect(calculateIndividualDesirability(40, critRange)).toBe(1);
      expect(calculateIndividualDesirability(19.9, critRange)).toBe(0);
      expect(calculateIndividualDesirability(40.1, critRange)).toBe(0);

      const critNone: OptimizationCriterion = {
        id: 'r_none', name: 'Ignored', type: 'response', goal: 'none',
        lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 3
      };
      expect(calculateIndividualDesirability(999, critNone)).toBe(1);
      expect(calculateIndividualDesirability(-999, critNone)).toBe(1);
    });

    test('1.5 Critical Stat-Ease Exponent Rule for combined desirability', () => {
      // Documentation: "The d_i for 'in range' are included in the product of the desirability function D,
      // but are not counted in determining sum(r_i) in D = (prod d_i^r_i)^(1/sum r_i)."
      const criteria: Record<string, OptimizationCriterion> = {
        // 3 factors in range, each importance = 3
        f1: { id: 'f1', name: 'A', type: 'factor', goal: 'in_range', lowerLimit: 10, upperLimit: 20, lowerWeight: 1, upperWeight: 1, importance: 3 },
        f2: { id: 'f2', name: 'B', type: 'factor', goal: 'in_range', lowerLimit: 10, upperLimit: 20, lowerWeight: 1, upperWeight: 1, importance: 3 },
        f3: { id: 'f3', name: 'C', type: 'factor', goal: 'in_range', lowerLimit: 10, upperLimit: 20, lowerWeight: 1, upperWeight: 1, importance: 3 },
        // Response 1: maximize, importance 3, d1 = 0.80
        r1: { id: 'r1', name: 'Resp1', type: 'response', goal: 'maximize', lowerLimit: 0, upperLimit: 100, lowerWeight: 1, upperWeight: 1, importance: 3 },
        // Response 2: target, importance 4, d2 = 0.90
        r2: { id: 'r2', name: 'Resp2', type: 'response', goal: 'target', lowerLimit: 0, upperLimit: 100, targetValue: 50, lowerWeight: 1, upperWeight: 1, importance: 4 },
      };

      const indD = {
        f1: 1.0,
        f2: 1.0,
        f3: 1.0,
        r1: 0.80,
        r2: 0.90,
      };

      // Stat-Ease formula:
      // sum(r_i) = 3 + 4 = 7 (f1, f2, f3 excluded from denominator)
      // D = (0.80^3 * 0.90^4)^(1/7) = (0.512 * 0.6561)^(1/7) = 0.3359232^(1/7) = 0.8554904
      const expectedD = Math.pow(Math.pow(0.80, 3) * Math.pow(0.90, 4), 1 / 7);
      const computedD = calculateCombinedDesirability(indD, criteria);

      expect(computedD).toBeCloseTo(expectedD, 6);
      expect(computedD).toBeCloseTo(0.855697, 5);

      // If one in-range factor violates range (d = 0), overall D must be strictly 0
      const violatedIndD = { ...indD, f1: 0.0 };
      expect(calculateCombinedDesirability(violatedIndD, criteria)).toBe(0);

      // If ALL criteria are in-range and all are met, D must be 1.0
      const allRangeCriteria: Record<string, OptimizationCriterion> = {
        f1: criteria.f1,
        f2: criteria.f2,
        f3: criteria.f3,
      };
      expect(calculateCombinedDesirability({ f1: 1, f2: 1, f3: 1 }, allRangeCriteria)).toBe(1.0);
    });
  });

  // =========================================================================
  // 2. RESPONSE SURFACE MODELING & POINT A / POINT B PARITY
  // =========================================================================
  describe('2. Response Surface Modeling & Point A / Point B Verification', () => {
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
    const runs = [
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

    const design = {
      config: { factors, responses },
      runs,
      analyses: {} as Record<string, any>,
    };

    test('2.1 Fits QR least squares models with Type III Partial ANOVA and Fit Statistics', () => {
      const resAnalysis = refitResponseModel(design, 'r1', 'Quadratic');
      const rtAnalysis = refitResponseModel(design, 'r2', 'Quadratic');
      const tfAnalysis = refitResponseModel(design, 'r3', 'Quadratic');

      // Verify Model ANOVA properties
      expect(resAnalysis.anova.length).toBeGreaterThan(5);
      const modelRow = resAnalysis.anova.find(r => r.source === 'Model');
      expect(modelRow).toBeDefined();
      expect(modelRow?.fValue).toBeGreaterThan(100);
      expect(modelRow?.pValue).toBeLessThan(0.0001);

      // Verify Lack-of-Fit estimable from 6 center point replicates
      expect(resAnalysis.lackOfFit.available).toBe(true);
      expect(resAnalysis.lackOfFit.dfPureError).toBe(5); // 6 replicates - 1

      // Verify PRESS and Predicted R²
      expect(resAnalysis.fittedModel.press).toBeGreaterThan(0);
      expect(resAnalysis.fittedModel.predR2).toBeGreaterThan(0.95);
      expect(resAnalysis.fittedModel.adequatePrecision).toBeGreaterThan(4.0); // > 4 is signal adequate
    });

    test('2.2 Point A and Point B predictions match Design-Expert exact values', () => {
      const resAnalysis = refitResponseModel(design, 'r1', 'Quadratic');
      const rtAnalysis = refitResponseModel(design, 'r2', 'Quadratic');
      const tfAnalysis = refitResponseModel(design, 'r3', 'Quadratic');

      const mRes: FittedModelRef = { modelType: 'Quadratic', terms: resAnalysis.fittedModel.terms, coefficients: resAnalysis.fittedModel.coefficients };
      const mRt: FittedModelRef = { modelType: 'Quadratic', terms: rtAnalysis.fittedModel.terms, coefficients: rtAnalysis.fittedModel.coefficients };
      const mTf: FittedModelRef = { modelType: 'Quadratic', terms: tfAnalysis.fittedModel.terms, coefficients: tfAnalysis.fittedModel.coefficients };

      // Point A: Organic Phase = 45, pH = 2.5, Temperature = 35 (Coded: +1, -1, +1)
      const ptA = { f1: 45, f2: 2.5, f3: 35 };
      expect(predictModelResponse(ptA, factors, mRes)).toBeCloseTo(3.0924, 3);
      expect(predictModelResponse(ptA, factors, mRt)).toBeCloseTo(9.1044, 3);
      expect(predictModelResponse(ptA, factors, mTf)).toBeCloseTo(1.1392, 3);

      // Point B: Organic Phase = 41.535, pH = 2.873, Temperature = 31.926 (Coded: +0.307, -0.254, +0.3852)
      const ptB = { f1: 41.535, f2: 2.873, f3: 31.926 };
      expect(predictModelResponse(ptB, factors, mRes)).toBeCloseTo(2.9386, 3);
      expect(predictModelResponse(ptB, factors, mRt)).toBeCloseTo(8.5480, 3);
      expect(predictModelResponse(ptB, factors, mTf)).toBeCloseTo(1.1130, 3);
    });
  });

  // =========================================================================
  // 3. MULTI-DESIGN GENERALITY: BOX-BEHNKEN DESIGN (BBD)
  // =========================================================================
  describe('3. Generality across Designs: Box-Behnken Design (BBD)', () => {
    const bbdFactors: FactorBounds[] = [
      { id: 'f1', name: 'Agitation', low: 100, high: 300, units: 'rpm' },
      { id: 'f2', name: 'Feed Rate', low: 10, high: 30, units: 'g/min' },
      { id: 'f3', name: 'Pressure', low: 1, high: 3, units: 'bar' },
    ];

    const bbdResponses = [
      { id: 'r1', name: 'Conversion', units: '%' },
      { id: 'r2', name: 'Selectivity', units: '%' },
    ];

    // Standard 15-run 3-factor Box-Behnken design matrix
    const bbdRuns = [
      { id: 'b-1', stdOrder: 1, runOrder: 4, actualValues: { f1: 100, f2: 10, f3: 2 }, responses: { r1: 65.2, r2: 82.1 } },
      { id: 'b-2', stdOrder: 2, runOrder: 11, actualValues: { f1: 300, f2: 10, f3: 2 }, responses: { r1: 78.4, r2: 74.3 } },
      { id: 'b-3', stdOrder: 3, runOrder: 1, actualValues: { f1: 100, f2: 30, f3: 2 }, responses: { r1: 71.0, r2: 88.0 } },
      { id: 'b-4', stdOrder: 4, runOrder: 15, actualValues: { f1: 300, f2: 30, f3: 2 }, responses: { r1: 89.5, r2: 79.5 } },
      { id: 'b-5', stdOrder: 5, runOrder: 9, actualValues: { f1: 100, f2: 20, f3: 1 }, responses: { r1: 68.3, r2: 85.2 } },
      { id: 'b-6', stdOrder: 6, runOrder: 2, actualValues: { f1: 300, f2: 20, f3: 1 }, responses: { r1: 83.1, r2: 76.8 } },
      { id: 'b-7', stdOrder: 7, runOrder: 13, actualValues: { f1: 100, f2: 20, f3: 3 }, responses: { r1: 72.4, r2: 86.4 } },
      { id: 'b-8', stdOrder: 8, runOrder: 7, actualValues: { f1: 300, f2: 20, f3: 3 }, responses: { r1: 88.9, r2: 79.0 } },
      { id: 'b-9', stdOrder: 9, runOrder: 8, actualValues: { f1: 200, f2: 10, f3: 1 }, responses: { r1: 72.0, r2: 78.2 } },
      { id: 'b-10', stdOrder: 10, runOrder: 5, actualValues: { f1: 200, f2: 30, f3: 1 }, responses: { r1: 81.3, r2: 84.1 } },
      { id: 'b-11', stdOrder: 11, runOrder: 14, actualValues: { f1: 200, f2: 10, f3: 3 }, responses: { r1: 75.8, r2: 80.5 } },
      { id: 'b-12', stdOrder: 12, runOrder: 6, actualValues: { f1: 200, f2: 30, f3: 3 }, responses: { r1: 86.2, r2: 86.9 } },
      { id: 'b-13', stdOrder: 13, runOrder: 10, actualValues: { f1: 200, f2: 20, f3: 2 }, responses: { r1: 80.1, r2: 83.2 } },
      { id: 'b-14', stdOrder: 14, runOrder: 3, actualValues: { f1: 200, f2: 20, f3: 2 }, responses: { r1: 80.5, r2: 83.0 } },
      { id: 'b-15', stdOrder: 15, runOrder: 12, actualValues: { f1: 200, f2: 20, f3: 2 }, responses: { r1: 80.3, r2: 83.4 } },
    ];

    const bbdDesign = {
      config: { factors: bbdFactors, responses: bbdResponses },
      runs: bbdRuns,
      analyses: {} as Record<string, any>,
    };

    test('3.1 Fits BBD models cleanly and optimizes multiple conflicting responses', () => {
      const convAnalysis = refitResponseModel(bbdDesign, 'r1', 'Quadratic');
      const selAnalysis = refitResponseModel(bbdDesign, 'r2', 'Quadratic');

      expect(convAnalysis.fittedModel.R2).toBeGreaterThan(0.95);
      expect(selAnalysis.fittedModel.R2).toBeGreaterThan(0.95);

      const criteria: Record<string, OptimizationCriterion> = {
        f1: { id: 'f1', name: 'Agitation', type: 'factor', goal: 'in_range', lowerLimit: 100, upperLimit: 300, lowerWeight: 1, upperWeight: 1, importance: 3 },
        f2: { id: 'f2', name: 'Feed Rate', type: 'factor', goal: 'in_range', lowerLimit: 10, upperLimit: 30, lowerWeight: 1, upperWeight: 1, importance: 3 },
        f3: { id: 'f3', name: 'Pressure', type: 'factor', goal: 'in_range', lowerLimit: 1, upperLimit: 3, lowerWeight: 1, upperWeight: 1, importance: 3 },
        r1: { id: 'r1', name: 'Conversion', type: 'response', goal: 'maximize', lowerLimit: 70, upperLimit: 90, lowerWeight: 1, upperWeight: 1, importance: 4 },
        r2: { id: 'r2', name: 'Selectivity', type: 'response', goal: 'maximize', lowerLimit: 75, upperLimit: 88, lowerWeight: 1, upperWeight: 1, importance: 5 },
      };

      const optResult = executeNumericalOptimization(
        bbdFactors,
        bbdResponses,
        { r1: convAnalysis, r2: selAnalysis },
        criteria,
        DEFAULT_OPTIMIZATION_OPTIONS,
        bbdRuns
      );

      expect(optResult.status).not.toBe('no_feasible_solution');
      expect(optResult.status).not.toBe('error');
      expect(['optimal', 'suboptimal']).toContain(optResult.status);
      expect(optResult.solutions.length).toBeGreaterThan(0);
      expect(optResult.solutions[0].desirability).toBeGreaterThan(0.70);

      // Verify solutions respect factor bounds
      for (const sol of optResult.solutions) {
        expect(sol.factors.f1).toBeGreaterThanOrEqual(100 - 1e-4);
        expect(sol.factors.f1).toBeLessThanOrEqual(300 + 1e-4);
        expect(sol.factors.f2).toBeGreaterThanOrEqual(10 - 1e-4);
        expect(sol.factors.f2).toBeLessThanOrEqual(30 + 1e-4);
        expect(sol.factors.f3).toBeGreaterThanOrEqual(1 - 1e-4);
        expect(sol.factors.f3).toBeLessThanOrEqual(3 + 1e-4);
      }
    });
  });

  // =========================================================================
  // 4. RANK DEFICIENCY, COLLINEARITY & ROBUST ERROR HANDLING
  // =========================================================================
  describe('4. Rank Deficiency & Boundary Robustness', () => {
    test('4.1 Insufficient runs vs degrees of freedom cleanly caught', () => {
      // 3 factors Quadratic requires 10 terms. Providing only 5 runs.
      const fewRuns = [
        { id: '1', f1: 0, f2: 0, f3: 0, y: 10 },
        { id: '2', f1: 1, f2: 1, f3: 1, y: 20 },
        { id: '3', f1: -1, f2: -1, f3: -1, y: 15 },
        { id: '4', f1: 1, f2: -1, f3: 1, y: 18 },
        { id: '5', f1: -1, f2: 1, f3: -1, y: 12 },
      ];
      const modelMatrix = createModelMatrix(
        fewRuns.map(r => ({ f1: r.f1, f2: r.f2, f3: r.f3 })),
        ['f1', 'f2', 'f3'],
        'Quadratic'
      );
      expect(() => fitModel(modelMatrix, fewRuns.map(r => r.y))).toThrow(/cannot be estimated from the available data/);
    });

    test('4.2 Perfectly collinear predictors detected by QR decomposition', () => {
      // 10 runs but factor 2 is perfectly identical to factor 1 (f2 = f1)
      const collinearRuns = Array.from({ length: 12 }, (_, i) => {
        const v = -1 + (2 * i) / 11;
        return { f1: v, f2: v, f3: (i % 2 === 0 ? 1 : -1), y: 10 + 2 * v };
      });
      const modelMatrix = createModelMatrix(
        collinearRuns.map(r => ({ f1: r.f1, f2: r.f2, f3: r.f3 })),
        ['f1', 'f2', 'f3'],
        'Quadratic'
      );
      expect(() => fitModel(modelMatrix, collinearRuns.map(r => r.y))).toThrow(/rank deficiency|singular|aliased/);
    });
  });
});
