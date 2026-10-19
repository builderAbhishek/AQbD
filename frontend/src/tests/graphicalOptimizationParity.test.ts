import { describe, test, expect } from 'vitest';
import {
  initializeGraphicalLimits,
  evaluatePointLimitsFeasibility,
  calculateOverlayGrid,
  sliceDesignPoints,
  ResponseGraphicalLimit,
} from '../lib/optimization/graphicalOptimization';
import { FactorBounds, FittedModelRef, actualToCoded, codedToActual } from '../lib/optimization/solver';
import { OptimizationCriterion } from '../lib/optimization/types';
import { refitResponseModel } from '../lib/statistics/rsm/modelFitting';

describe('AQbD Studio — Graphical Optimization Parity with Design-Expert 13', () => {
  // 1. Synthetic setup for deterministic mathematical verification
  const testFactors: FactorBounds[] = [
    { id: 'fA', name: 'Factor A', low: 10, high: 20, units: 'mM' },
    { id: 'fB', name: 'Factor B', low: 0, high: 10, units: 'pH' },
    { id: 'fC', name: 'Factor C', low: 20, high: 40, units: '°C' },
  ];

  // Synthetic Linear Model: y = 2*fA + 3*fB - 1*fC
  // Model terms operate on coded values: x_coded = (actual - center) / halfRange
  const testModelLinear: FittedModelRef = {
    modelType: 'Linear',
    terms: [
      { name: 'Intercept', type: 'intercept', factors: [] },
      { name: 'fA', type: 'linear', factors: ['fA'] },
      { name: 'fB', type: 'linear', factors: ['fB'] },
      { name: 'fC', type: 'linear', factors: ['fC'] },
    ],
    coefficients: [50, 10, 15, -5], // Intercept=50, A_coded=+10, B_coded=+15, C_coded=-5
  };

  const testResponses = [
    { id: 'resp1', name: 'Yield', units: '%' },
    { id: 'resp2', name: 'Purity', units: '%' },
  ];

  describe('1. Axes Mapping & Factor Coding Modes', () => {
    test('scales grid across configured actual factor limits', () => {
      const fX = testFactors[0]; // 10 to 20
      const fY = testFactors[1]; // 0 to 10
      const held = { fC: 30 };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        held,
        testFactors,
        testResponses,
        { resp1: testModelLinear },
        {},
        11,
        'actual'
      );

      expect(grid.xValues.length).toBe(11);
      expect(grid.yValues.length).toBe(11);
      expect(grid.xValues[0]).toBeCloseTo(10, 5);
      expect(grid.xValues[10]).toBeCloseTo(20, 5);
      expect(grid.yValues[0]).toBeCloseTo(0, 5);
      expect(grid.yValues[10]).toBeCloseTo(10, 5);
    });

    test('scales grid in coded coordinates (-1 to +1) when coded mode is active', () => {
      const fX = testFactors[0];
      const fY = testFactors[1];
      const held = { fC: 30 };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        held,
        testFactors,
        testResponses,
        { resp1: testModelLinear },
        {},
        11,
        'coded'
      );

      expect(grid.xValues[0]).toBeCloseTo(-1.0, 5);
      expect(grid.xValues[5]).toBeCloseTo(0.0, 5);
      expect(grid.xValues[10]).toBeCloseTo(1.0, 5);
      expect(grid.yValues[0]).toBeCloseTo(-1.0, 5);
      expect(grid.yValues[10]).toBeCloseTo(1.0, 5);
    });
  });

  describe('2. Design Points Slicing & Replicate Aggregation', () => {
    // 20-run HPLC Central Composite Design setup
    const alpha = 1.681792830507429;
    const hplcFactors: FactorBounds[] = [
      { id: 'f1', name: 'Organic Phase', low: 35, high: 45, units: '%' },
      { id: 'f2', name: 'pH', low: 2.5, high: 3.5, units: 'pH' },
      { id: 'f3', name: 'Temperature', low: 25, high: 35, units: '°C' },
    ];

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
      // 6 Center runs at (40, 3.0, 30)
      { id: 'r-15', stdOrder: 15, runOrder: 3, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.53, r3: 1.12 } },
      { id: 'r-16', stdOrder: 16, runOrder: 18, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.78, r2: 8.45, r3: 1.12 } },
      { id: 'r-17', stdOrder: 17, runOrder: 17, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.42, r3: 1.11 } },
      { id: 'r-18', stdOrder: 18, runOrder: 15, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.81, r2: 8.55, r3: 1.11 } },
      { id: 'r-19', stdOrder: 19, runOrder: 13, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.79, r2: 8.40, r3: 1.14 } },
      { id: 'r-20', stdOrder: 20, runOrder: 8, actualValues: { f1: 40, f2: 3.0, f3: 30 }, responses: { r1: 2.80, r2: 8.58, r3: 1.13 } },
    ];

    test('aggregates 6 center replicates into a single cluster labeled "6" when C=30', () => {
      const fX = hplcFactors[0]; // f1: Organic Phase
      const fY = hplcFactors[1]; // f2: pH
      const heldValues = { f3: 30 }; // Temperature = 30

      const sliced = sliceDesignPoints(hplcRuns, fX, fY, heldValues, hplcFactors, 'actual', 0.05);

      // Find the center cluster at (40, 3.0)
      const centerCluster = sliced.find(
        p => Math.abs(p.x - 40) < 0.1 && Math.abs(p.y - 3.0) < 0.1 && p.inSlice
      );

      expect(centerCluster).toBeDefined();
      expect(centerCluster!.replicateCount).toBe(6);
      expect(centerCluster!.displayLabel).toBe('6');
      expect(centerCluster!.inSlice).toBe(true);
      expect(centerCluster!.stdOrders).toEqual([15, 16, 17, 18, 19, 20]);
    });

    test('marks factorial runs as inSlice when held factor is shifted to C=25', () => {
      const fX = hplcFactors[0];
      const fY = hplcFactors[1];
      const heldValues = { f3: 25 }; // Shift held temperature to 25

      const sliced = sliceDesignPoints(hplcRuns, fX, fY, heldValues, hplcFactors, 'actual', 0.05);

      // Runs 1 to 4 should be in slice
      const inSliceRuns = sliced.filter(p => p.inSlice);
      expect(inSliceRuns.length).toBe(4);
      const stdOrders = inSliceRuns.flatMap(p => p.stdOrders).sort((a, b) => a - b);
      expect(stdOrders).toEqual([1, 2, 3, 4]);

      // Center point (C=30) should be marked out of slice
      const centerCluster = sliced.find(
        p => Math.abs(p.x - 40) < 0.1 && Math.abs(p.y - 3.0) < 0.1
      );
      expect(centerCluster?.inSlice).toBe(false);
    });
  });

  describe('3. Response Goals, Feasibility & Sweet Spot Boundary', () => {
    test('Maximize goal (one-sided lower limit) correctly partitions feasible space', () => {
      const fX = testFactors[0]; // 10 to 20 (center 15)
      const fY = testFactors[1]; // 0 to 10 (center 5)
      const held = { fC: 30 }; // C_coded = 0

      // At center (fA=15, fB=5, fC=30), coded=(0,0,0) -> y = 50
      // If lowerLimit = 50, exactly half the plane where 10*A_coded + 15*B_coded >= 0 is feasible
      const limits: Record<string, ResponseGraphicalLimit> = {
        resp1: {
          responseId: 'resp1',
          responseName: 'Yield',
          isOneSided: true,
          oneSidedType: 'lower',
          lowerLimit: 50,
          upperLimit: Infinity,
          isActive: true,
          observedMin: 20,
          observedMax: 80,
        },
      };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        held,
        testFactors,
        testResponses,
        { resp1: testModelLinear },
        limits,
        21,
        'actual'
      );

      expect(grid.isEmptyFeasible).toBe(false);
      // Roughly half of the grid should be feasible
      expect(grid.feasiblePercent).toBeGreaterThan(40);
      expect(grid.feasiblePercent).toBeLessThan(60);

      // Corner (fA=20, fB=10) has coded=(1, 1) -> y = 50 + 10 + 15 = 75 >= 50 -> Feasible
      const cornerMaxIdx = grid.feasibilityMatrix.length - 1;
      expect(grid.feasibilityMatrix[cornerMaxIdx][cornerMaxIdx]).toBe(1);

      // Corner (fA=10, fB=0) has coded=(-1, -1) -> y = 50 - 10 - 15 = 25 < 50 -> Infeasible
      expect(grid.feasibilityMatrix[0][0]).toBe(0);
    });

    test('Minimize goal (one-sided upper limit) constrains high response values', () => {
      const fX = testFactors[0];
      const fY = testFactors[1];
      const held = { fC: 30 };

      // Upper limit = 50
      const limits: Record<string, ResponseGraphicalLimit> = {
        resp1: {
          responseId: 'resp1',
          responseName: 'Yield',
          isOneSided: true,
          oneSidedType: 'upper',
          lowerLimit: -Infinity,
          upperLimit: 50,
          isActive: true,
          observedMin: 20,
          observedMax: 80,
        },
      };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        held,
        testFactors,
        testResponses,
        { resp1: testModelLinear },
        limits,
        21,
        'actual'
      );

      // Corner (fA=10, fB=0) has y = 25 <= 50 -> Feasible
      expect(grid.feasibilityMatrix[0][0]).toBe(1);

      // Corner (fA=20, fB=10) has y = 75 > 50 -> Infeasible
      const cornerMaxIdx = grid.feasibilityMatrix.length - 1;
      expect(grid.feasibilityMatrix[cornerMaxIdx][cornerMaxIdx]).toBe(0);
    });

    test('Two-sided interval [lower, upper] constrains response to intermediate strip', () => {
      const fX = testFactors[0];
      const fY = testFactors[1];
      const held = { fC: 30 };

      // Range [45, 55] around center (y=50)
      const limits: Record<string, ResponseGraphicalLimit> = {
        resp1: {
          responseId: 'resp1',
          responseName: 'Yield',
          isOneSided: false,
          oneSidedType: 'lower',
          lowerLimit: 45,
          upperLimit: 55,
          isActive: true,
          observedMin: 20,
          observedMax: 80,
        },
      };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        held,
        testFactors,
        testResponses,
        { resp1: testModelLinear },
        limits,
        21,
        'actual'
      );

      expect(grid.isEmptyFeasible).toBe(false);
      // Center point (index 10, 10 in 21x21 grid) has y = 50 -> Feasible
      expect(grid.feasibilityMatrix[10][10]).toBe(1);
      // Extreme corners are both out of range
      expect(grid.feasibilityMatrix[0][0]).toBe(0); // y=25 < 45
      expect(grid.feasibilityMatrix[20][20]).toBe(0); // y=75 > 55
    });

    test('Unconstrained (inactive / goal=none) response does not restrict sweet spot', () => {
      const fX = testFactors[0];
      const fY = testFactors[1];
      const held = { fC: 30 };

      const limits: Record<string, ResponseGraphicalLimit> = {
        resp1: {
          responseId: 'resp1',
          responseName: 'Yield',
          isOneSided: false,
          oneSidedType: 'lower',
          lowerLimit: 100, // Impossibly high if active
          upperLimit: 200,
          isActive: false, // INACTIVE
          observedMin: 20,
          observedMax: 80,
        },
      };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        held,
        testFactors,
        testResponses,
        { resp1: testModelLinear },
        limits,
        15,
        'actual'
      );

      // Should be 100% feasible since resp1 is inactive
      expect(grid.feasiblePercent).toBe(100);
      expect(grid.isEmptyFeasible).toBe(false);
    });

    test('Empty feasible region is detected and summarizes unmet constraints', () => {
      const fX = testFactors[0];
      const fY = testFactors[1];
      const held = { fC: 30 };

      // Require Yield >= 1000 (impossible since max is ~75)
      const limits: Record<string, ResponseGraphicalLimit> = {
        resp1: {
          responseId: 'resp1',
          responseName: 'Yield',
          isOneSided: true,
          oneSidedType: 'lower',
          lowerLimit: 1000,
          upperLimit: Infinity,
          isActive: true,
          observedMin: 20,
          observedMax: 80,
        },
      };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        held,
        testFactors,
        testResponses,
        { resp1: testModelLinear },
        limits,
        15,
        'actual'
      );

      expect(grid.feasibleCount).toBe(0);
      expect(grid.feasiblePercent).toBe(0);
      expect(grid.isEmptyFeasible).toBe(true);
      expect(grid.unmetConstraintsSummary['Yield']).toBe(15 * 15);
    });
  });

  describe('4. HPLC CCD Design-Expert 13 Overlay Verification', () => {
    const hplcFactors: FactorBounds[] = [
      { id: 'f1', name: 'Organic Phase', low: 35, high: 45, units: '%' },
      { id: 'f2', name: 'pH', low: 2.5, high: 3.5, units: 'pH' },
      { id: 'f3', name: 'Temperature', low: 25, high: 35, units: '°C' },
    ];

    const hplcResponses = [
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

    const designTemplate = { config: { factors: hplcFactors, responses: hplcResponses }, runs: initialRuns, analyses: {} };
    const r1Analysis = refitResponseModel(designTemplate, 'r1', 'Quadratic');
    const r2Analysis = refitResponseModel(designTemplate, 'r2', 'Quadratic');
    const r3Analysis = refitResponseModel(designTemplate, 'r3', 'Quadratic');
    const analyses = { r1: r1Analysis, r2: r2Analysis, r3: r3Analysis };

    test('reproduces Design-Expert Screenshot 1: Resolution >= 2.0 at C=30 produces yellow sweet spot', () => {
      const fX = hplcFactors[0]; // A: Organic Phase
      const fY = hplcFactors[1]; // B: pH
      const heldValues = { f3: 30 }; // C: Temperature = 30

      // In Design-Expert Screenshot 1: Only Resolution has active criterion (>= 2.0)
      const limits: Record<string, ResponseGraphicalLimit> = {
        r1: {
          responseId: 'r1',
          responseName: 'Resolution',
          isOneSided: true,
          oneSidedType: 'lower',
          lowerLimit: 2.0,
          upperLimit: Infinity,
          isActive: true,
          observedMin: 1.777,
          observedMax: 3.08,
        },
        r2: {
          responseId: 'r2',
          responseName: 'Retention Time',
          isOneSided: false,
          oneSidedType: 'lower',
          lowerLimit: 8.0,
          upperLimit: 12.0,
          isActive: false, // inactive in screenshot 1
          observedMin: 8.23,
          observedMax: 10.5,
        },
        r3: {
          responseId: 'r3',
          responseName: 'Tailing Factor',
          isOneSided: false,
          oneSidedType: 'lower',
          lowerLimit: 1.0,
          upperLimit: 1.5,
          isActive: false, // inactive in screenshot 1
          observedMin: 1.11,
          observedMax: 1.394,
        },
      };

      const usableModels = {
        r1: r1Analysis.fittedModel!,
        r2: r2Analysis.fittedModel!,
        r3: r3Analysis.fittedModel!,
      };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        heldValues,
        hplcFactors,
        hplcResponses,
        usableModels,
        limits,
        35,
        'actual'
      );

      // In Screenshot 1, at C=30, the entire square [35, 45] x [2.5, 3.5] is yellow!
      expect(grid.isEmptyFeasible).toBe(false);
      expect(grid.feasiblePercent).toBeGreaterThan(95);

      // Verify that the center point (40, 3.0) predicts Resolution ~ 2.80 >= 2.0
      const centerEval = evaluatePointLimitsFeasibility(
        { f1: 40, f2: 3.0, f3: 30 },
        hplcFactors,
        usableModels,
        limits
      );
      expect(centerEval.isFeasible).toBe(true);
      expect(centerEval.predictions.r1).toBeCloseTo(2.7967, 3);
    });

    test('tightening constraints restricts overlay to optimal operating window', () => {
      const fX = hplcFactors[0];
      const fY = hplcFactors[1];
      const heldValues = { f3: 30 };

      // Apply tight multi-response constraints:
      // Resolution >= 2.6, Retention Time <= 8.8, Tailing Factor <= 1.20
      const limits: Record<string, ResponseGraphicalLimit> = {
        r1: {
          responseId: 'r1',
          responseName: 'Resolution',
          isOneSided: true,
          oneSidedType: 'lower',
          lowerLimit: 2.6,
          upperLimit: Infinity,
          isActive: true,
          observedMin: 1.777,
          observedMax: 3.08,
        },
        r2: {
          responseId: 'r2',
          responseName: 'Retention Time',
          isOneSided: true,
          oneSidedType: 'upper',
          lowerLimit: -Infinity,
          upperLimit: 8.8,
          isActive: true,
          observedMin: 8.23,
          observedMax: 10.5,
        },
        r3: {
          responseId: 'r3',
          responseName: 'Tailing Factor',
          isOneSided: true,
          oneSidedType: 'upper',
          lowerLimit: -Infinity,
          upperLimit: 1.20,
          isActive: true,
          observedMin: 1.11,
          observedMax: 1.394,
        },
      };

      const usableModels = {
        r1: r1Analysis.fittedModel!,
        r2: r2Analysis.fittedModel!,
        r3: r3Analysis.fittedModel!,
      };

      const grid = calculateOverlayGrid(
        fX,
        fY,
        heldValues,
        hplcFactors,
        hplcResponses,
        usableModels,
        limits,
        35,
        'actual'
      );

      // Feasible area should now be a localized sweet spot, not 100%
      expect(grid.isEmptyFeasible).toBe(false);
      expect(grid.feasiblePercent).toBeGreaterThan(0);
      expect(grid.feasiblePercent).toBeLessThan(70);

      // Center point (40, 3.0, 30) should be feasible: R1=2.80>=2.6, R2=8.49<=8.8, R3=1.12<=1.20
      const centerEval = evaluatePointLimitsFeasibility(
        { f1: 40, f2: 3.0, f3: 30 },
        hplcFactors,
        usableModels,
        limits
      );
      expect(centerEval.isFeasible).toBe(true);

      // Corner (35, 2.5, 30) should be infeasible
      const cornerEval = evaluatePointLimitsFeasibility(
        { f1: 35, f2: 2.5, f3: 30 },
        hplcFactors,
        usableModels,
        limits
      );
      expect(cornerEval.isFeasible).toBe(false);
      expect(cornerEval.violatedResponses.length).toBeGreaterThan(0);
    });
  });

  describe('5. Limits Initialization & Synchronization', () => {
    test('initializes default limits from active optimization criteria', () => {
      const criteria: Record<string, OptimizationCriterion> = {
        r1: {
          id: 'r1',
          name: 'Resolution',
          type: 'response',
          goal: 'maximize',
          lowerLimit: 2.2,
          upperLimit: 3.5,
          lowerWeight: 1,
          upperWeight: 1,
          importance: 3,
        },
        r2: {
          id: 'r2',
          name: 'Retention Time',
          type: 'response',
          goal: 'none',
          lowerLimit: 8.0,
          upperLimit: 12.0,
          lowerWeight: 1,
          upperWeight: 1,
          importance: 3,
        },
      };

      const runs = [
        { responses: { r1: 1.8, r2: 8.5 } },
        { responses: { r1: 3.0, r2: 10.5 } },
      ];

      const responses = [
        { id: 'r1', name: 'Resolution', units: '' },
        { id: 'r2', name: 'Retention Time', units: 'min' },
      ];

      const limits = initializeGraphicalLimits(responses, criteria, runs);

      // r1 should be active and one-sided lower limit
      expect(limits.r1.isActive).toBe(true);
      expect(limits.r1.isOneSided).toBe(true);
      expect(limits.r1.oneSidedType).toBe('lower');
      expect(limits.r1.lowerLimit).toBe(2.2);

      // r2 should be inactive since goal is none
      expect(limits.r2.isActive).toBe(false);
      expect(limits.r2.observedMin).toBe(8.5);
      expect(limits.r2.observedMax).toBe(10.5);
    });
  });
});
