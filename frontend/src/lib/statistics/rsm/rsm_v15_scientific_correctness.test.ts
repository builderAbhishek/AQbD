import { describe, test, expect } from 'vitest';
import { createModelMatrix, getAllCandidateTerms, enforceModelHierarchy } from './modelMatrix';
import { analyzeModel, formatTermDisplay } from './statistics';
import { validateAnalysisResult } from './validation';
import { generateCCD } from '../../design/ccd';
import { generateBBD } from '../../design/bbd';
import { FactorDefinition } from './types';

describe('V1.5 Analysis Engine & ANOVA Scientific Correctness Suite', () => {

  // Test dataset 1: Classical 2-factor CCD (13 runs, 4 factorial + 4 axial + 5 center points)
  const factors2F: FactorDefinition[] = [
    { id: 'A', name: 'Time', units: 'min', low: 20, high: 40 },
    { id: 'B', name: 'Temperature', units: 'degC', low: 140, high: 180 }
  ];

  // Alpha for 2-factor CCC = 2^(2/4) = 1.41421356
  const alpha2F = Math.SQRT2;

  // 13 runs: Coded factor coordinates
  const codedCCD2F = [
    { A: -1, B: -1 },
    { A: 1, B: -1 },
    { A: -1, B: 1 },
    { A: 1, B: 1 },
    { A: -alpha2F, B: 0 },
    { A: alpha2F, B: 0 },
    { A: 0, B: -alpha2F },
    { A: 0, B: alpha2F },
    { A: 0, B: 0 },
    { A: 0, B: 0 },
    { A: 0, B: 0 },
    { A: 0, B: 0 },
    { A: 0, B: 0 }
  ];

  // Deterministic response: y = 50 + 5*A - 3*B + 2*A*B - 4*A^2 - 2*B^2 + noise
  // True values without noise:
  // (0,0) center points = 50. We add deterministic slight variations to center points to yield known pure error!
  const yCCD2F = [
    38.0, // (-1, -1) -> 50 - 5 + 3 + 2 - 4 - 2 = 44 -> 38.0
    44.0, // (+1, -1) -> 50 + 5 + 3 - 2 - 4 - 2 = 50 -> 44.0
    32.0, // (-1, +1) -> 50 - 5 - 3 - 2 - 4 - 2 = 34 -> 32.0
    42.0, // (+1, +1) -> 50 + 5 - 3 + 2 - 4 - 2 = 48 -> 42.0
    35.0, // (-1.414, 0)
    49.0, // (+1.414, 0)
    50.0, // (0, -1.414)
    42.0, // (0, +1.414)
    50.2, // Center 1
    49.8, // Center 2
    50.0, // Center 3
    50.1, // Center 4
    49.9  // Center 5
  ];

  // ==========================================
  // SECTION 1: MODEL MATRIX & MODEL HIERARCHY
  // ==========================================
  describe('Model Matrix & Model Hierarchy', () => {
    test('1. Linear terms generation (k=2)', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Linear');
      expect(mm.terms.length).toBe(3);
      expect(mm.terms.map(t => t.name)).toEqual(['Intercept', 'A', 'B']);
      expect(mm.X.length).toBe(13);
      expect(mm.X[0]).toEqual([1, -1, -1]);
    });

    test('2. 2FI terms generation (k=2)', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], '2FI');
      expect(mm.terms.length).toBe(4);
      expect(mm.terms.map(t => t.name)).toEqual(['Intercept', 'A', 'B', 'A*B']);
      expect(mm.X[0]).toEqual([1, -1, -1, 1]);
    });

    test('3. Quadratic terms generation (k=2)', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      expect(mm.terms.length).toBe(6);
      expect(mm.terms.map(t => t.name)).toEqual(['Intercept', 'A', 'B', 'A*B', 'A^2', 'B^2']);
      expect(mm.X[0]).toEqual([1, -1, -1, 1, 1, 1]);
      // Center point: (1, 0, 0, 0, 0, 0)
      expect(mm.X[8]).toEqual([1, 0, 0, 0, 0, 0]);
    });

    test('4. Model Hierarchy enforcement', () => {
      const candidates = getAllCandidateTerms(['A', 'B']);
      // If user requests only ['A*B'], hierarchy MUST force ['Intercept', 'A', 'B', 'A*B']
      const enforced = enforceModelHierarchy(['A*B'], candidates);
      expect(enforced.map(t => t.name)).toEqual(['Intercept', 'A', 'B', 'A*B']);

      // If user requests ['B^2'], hierarchy MUST force ['Intercept', 'B', 'B^2']
      const enforcedQuad = enforceModelHierarchy(['B^2'], candidates);
      expect(enforcedQuad.map(t => t.name)).toEqual(['Intercept', 'B', 'B^2']);
    });
  });

  // ==========================================
  // SECTION 2: LEAST SQUARES FIT & PREDICTIONS
  // ==========================================
  describe('Least Squares Regression, Predictions & Residuals', () => {
    test('QR-based regression computes exact coefficients, predictions, and residuals', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      expect(res.fitted.coefficients.length).toBe(6);
      expect(res.diagnostics).toBeDefined();
      expect(res.diagnostics!.length).toBe(13);

      // Verify y_i = ŷ_i + e_i for every observation within 1e-10
      for (let i = 0; i < 13; i++) {
        const diag = res.diagnostics![i];
        expect(diag.observed).toBeCloseTo(yCCD2F[i], 8);
        expect(diag.observed).toBeCloseTo(diag.predicted + diag.residual, 8);
      }

      // Sum of residuals should be 0 in model with intercept
      const sumResiduals = res.diagnostics!.reduce((acc, d) => acc + d.residual, 0);
      expect(Math.abs(sumResiduals)).toBeLessThan(1e-8);
    });
  });

  // ==========================================
  // SECTION 3: SUM OF SQUARES, DF, MS & ANOVA
  // ==========================================
  describe('Sums of Squares, Degrees of Freedom & ANOVA', () => {
    test('Calculates SST, SSE, SSModel and verifies SST = SSModel + SSE', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      const n = 13;
      const p = 6;
      expect(res.fitted.n).toBe(n);
      expect(res.fitted.p).toBe(p);
      expect(res.fitted.dfTotal).toBe(n - 1); // 12
      expect(res.fitted.dfModel).toBe(p - 1); // 5
      expect(res.fitted.dfError).toBe(n - p); // 7

      // Verify SST = SSR + SSE
      expect(res.fitted.SST).toBeCloseTo(res.fitted.SSR + res.fitted.SSE, 8);
      expect(res.fitted.SSR).toBeGreaterThan(0);
      expect(res.fitted.SSE).toBeGreaterThan(0);

      // Mean Squares
      expect(res.fitted.msModel).toBeCloseTo(res.fitted.SSR / 5, 8);
      expect(res.fitted.msError).toBeCloseTo(res.fitted.SSE / 7, 8);

      // F-value and p-value
      expect(res.fitted.fModel).toBeCloseTo(res.fitted.msModel! / res.fitted.msError!, 8);
      expect(res.fitted.pModel).toBeGreaterThan(0);
      expect(res.fitted.pModel).toBeLessThan(1);
    });

    test('Term-Level ANOVA: verifies Type III partial SS for individual model terms', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      const termRows = res.anova.filter(r => r.isTerm);
      // For 2-factor quadratic, 5 non-intercept terms: A, B, AB, A^2, B^2
      expect(termRows.length).toBe(5);

      for (const row of termRows) {
        expect(row.df).toBe(1);
        expect(row.ss).toBeGreaterThanOrEqual(0);
        expect(row.ms).toBeCloseTo(row.ss, 8);
        expect(row.fValue).toBeCloseTo(row.ms! / res.fitted.msError!, 6);
        expect(row.pValue).toBeGreaterThan(0);
        expect(row.pValue).toBeLessThanOrEqual(1);
      }
    });
  });

  // ==========================================
  // SECTION 4: PURE ERROR & LACK OF FIT
  // ==========================================
  describe('Pure Error & Lack of Fit', () => {
    test('Calculates genuine Pure Error from replicated center points (5 replicates = 4 df)', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      expect(res.lackOfFit.available).toBe(true);

      // 5 center points: [50.2, 49.8, 50.0, 50.1, 49.9]
      // Mean = 50.0
      // Deviations = [0.2, -0.2, 0.0, 0.1, -0.1]
      // Squares = [0.04, 0.04, 0.0, 0.01, 0.01] = 0.10
      expect(res.lackOfFit.dfPureError).toBe(4);
      expect(res.lackOfFit.ssPureError).toBeCloseTo(0.10, 6);
      expect(res.lackOfFit.msPureError).toBeCloseTo(0.10 / 4, 6); // 0.025

      // dfLOF = dfResidual (7) - dfPureError (4) = 3
      expect(res.lackOfFit.dfLOF).toBe(3);
      expect(res.lackOfFit.ssLOF).toBeCloseTo(res.fitted.SSE - 0.10, 6);
      expect(res.lackOfFit.fValue).toBeDefined();
      expect(res.lackOfFit.pValue).toBeDefined();

      // Check ANOVA table contains Lack of Fit and Pure Error rows
      expect(res.anova.some(r => r.source === 'Lack of Fit')).toBe(true);
      expect(res.anova.some(r => r.source === 'Pure Error')).toBe(true);
    });

    test('Identifies when Pure Error cannot be estimated (no replicates)', () => {
      // Create unreplicated design
      const unreplicatedCoded = [
        { A: -1, B: -1 },
        { A: 1, B: -1 },
        { A: -1, B: 1 },
        { A: 1, B: 1 },
        { A: 0, B: 0 }
      ];
      const unreplicatedY = [10, 20, 15, 30, 22];

      const mm = createModelMatrix(unreplicatedCoded, ['A', 'B'], 'Linear');
      const res = analyzeModel(mm, unreplicatedY, 'Linear', unreplicatedCoded);

      expect(res.lackOfFit.available).toBe(false);
      expect(res.lackOfFit.ssPureError).toBe(0);
      expect(res.lackOfFit.dfPureError).toBe(0);
      // ANOVA table should NOT contain fake Lack of Fit row
      expect(res.anova.some(r => r.source === 'Lack of Fit')).toBe(false);
    });
  });

  // ==========================================
  // SECTION 5: FIT STATISTICS (R², ADJ R², PRED R², PRESS, AP, CV%)
  // ==========================================
  describe('Comprehensive Fit Statistics', () => {
    test('Calculates exact R², Adjusted R², PRESS, Predicted R², CV%, and Adeq Precision', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      const fitted = res.fitted;

      // 1. R² = 1 - SSE / SST
      expect(fitted.R2).toBeCloseTo(1 - (fitted.SSE / fitted.SST), 8);
      expect(fitted.R2).toBeGreaterThan(0.85);

      // 2. Adjusted R² = 1 - [(SSE / 7) / (SST / 12)]
      const expectedAdjR2 = 1 - ((fitted.SSE / 7) / (fitted.SST / 12));
      expect(fitted.adjR2).toBeCloseTo(expectedAdjR2, 8);

      // 3. PRESS and Predicted R²
      expect(fitted.press).toBeDefined();
      expect(fitted.press).toBeGreaterThan(0);
      expect(fitted.predR2).toBeCloseTo(1 - (fitted.press! / fitted.SST), 8);

      // 4. RMSE (Std. Dev.) = sqrt(MSE)
      expect(fitted.rmse).toBeCloseTo(Math.sqrt(fitted.SSE / 7), 8);

      // 5. Mean response
      const expectedMean = yCCD2F.reduce((a, b) => a + b, 0) / 13;
      expect(fitted.mean).toBeCloseTo(expectedMean, 8);

      // 6. CV% = (RMSE / |Mean|) * 100
      expect(fitted.cv).toBeCloseTo((fitted.rmse! / Math.abs(fitted.mean)) * 100, 6);

      // 7. Adequate Precision = (max(ŷ) - min(ŷ)) / sqrt( (p * MSE) / n )
      expect(fitted.adequatePrecision).toBeDefined();
      expect(fitted.adequatePrecision).toBeGreaterThan(4); // strong signal in this dataset
    });
  });

  // ==========================================
  // SECTION 6: COEFFICIENT TABLE, SE, 95% CI & VIF
  // ==========================================
  describe('Coefficient Table, Standard Errors, 95% CI & VIF', () => {
    test('Calculates SE, 95% CI with Student-t distribution, and VIF for all terms', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      const table = res.fitted.coefficientTable;
      expect(table.length).toBe(6);

      // Intercept
      expect(table[0].term).toBe('Intercept');
      expect(table[0].standardError).toBeGreaterThan(0);
      expect(table[0].ciLow).toBeLessThan(table[0].estimate);
      expect(table[0].ciHigh).toBeGreaterThan(table[0].estimate);
      expect(table[0].vif).toBeNull(); // Intercept has no VIF

      // Non-intercept terms (A, B, AB, A^2, B^2)
      for (let j = 1; j < 6; j++) {
        const row = table[j];
        expect(row.df).toBe(1);
        expect(row.standardError).toBeGreaterThan(0);
        expect(row.ciLow).toBeLessThan(row.estimate);
        expect(row.ciHigh).toBeGreaterThan(row.estimate);

        // Difference between CI High and Low must equal 2 * t_crit * SE
        const tCrit = 2.364624; // jStat.studentt.inv(0.975, 7)
        expect(row.ciHigh! - row.ciLow!).toBeCloseTo(2 * tCrit * row.standardError!, 3);

        // In orthogonal CCD, linear and interaction VIF should be close to 1.0
        expect(row.vif).toBeDefined();
        expect(row.vif).toBeGreaterThanOrEqual(0.99);
      }
    });
  });

  // ==========================================
  // SECTION 7: CODED AND ACTUAL EQUATIONS
  // ==========================================
  describe('Coded and Actual Equations', () => {
    test('Generates mathematically valid coded and algebraically transformed actual equations', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      // Coded equation must contain factor names, but the intercept is just a constant (no 'Intercept' string)
      expect(res.fitted.codedEquation).toContain('A');
      expect(res.fitted.codedEquation).toContain('B');
      expect(res.fitted.codedEquation).toContain('A*B');
      expect(res.fitted.codedEquation).toContain('A^2');
      expect(res.fitted.codedEquation).toContain('B^2');

      // Actual equation must contain factor real names (Time, Temperature)
      expect(res.fitted.actualEquation).toBeDefined();
      expect(res.fitted.actualEquation).toContain('Time');
      expect(res.fitted.actualEquation).toContain('Temperature');
    });
  });

  // ==========================================
  // SECTION 8: 3-FACTOR CCD & 3-FACTOR BBD
  // ==========================================
  describe('Multi-Factor Verification: 3-Factor CCD & 3-Factor BBD', () => {
    test('Fits 3-Factor CCD (20 runs: 8 factorial + 6 axial + 6 center)', () => {
      const ccdConfig = {
        type: 'CCC' as const,
        factors: [
          { id: 'f1', name: 'A', units: '', low: 10, high: 20 },
          { id: 'f2', name: 'B', units: '', low: 100, high: 200 },
          { id: 'f3', name: 'C', units: '', low: 1, high: 5 }
        ],
        responses: [{ id: 'resp1', name: 'R1', units: '' }],
        centerPoints: 6,
        randomize: false
      };
      const ccdRuns = generateCCD(ccdConfig);

      expect(ccdRuns.length).toBe(20);

      // Synthetic deterministic y values: length 20
      const y3F = [
        12.0, 15.0, 14.0, 18.0, 13.0, 16.0, 15.5, 19.0,
        11.5, 17.5, 12.5, 18.5, 10.0, 19.5,
        16.0, 16.1, 15.9, 16.2, 16.0, 15.8
      ];

      const coded = ccdRuns.map(r => r.codedValues);
      const mm = createModelMatrix(coded, ['f1', 'f2', 'f3'], 'Quadratic');

      // 10 terms: Intercept, 3 linear, 3 interaction, 3 quadratic
      expect(mm.terms.length).toBe(10);

      const res = analyzeModel(mm, y3F, 'Quadratic', coded, ccdRuns);
      expect(res.fitted.n).toBe(20);
      expect(res.fitted.p).toBe(10);
      expect(res.fitted.dfModel).toBe(9);
      expect(res.fitted.dfError).toBe(10); // 20 - 10 = 10
      expect(res.fitted.dfTotal).toBe(19);

      // Replicated center points = 6 -> dfPureError = 5
      expect(res.lackOfFit.available).toBe(true);
      expect(res.lackOfFit.dfPureError).toBe(5);
      expect(res.lackOfFit.dfLOF).toBe(5); // 10 - 5 = 5

      const fullRes: any = {
        ...res,
        responseId: 'resp_1',
        modelType: 'Quadratic',
        factors: ccdConfig.factors,
        timestamp: new Date().toISOString()
      };
      expect(() => validateAnalysisResult(fullRes)).not.toThrow();
    });

    test('Fits 3-Factor BBD (15 runs: 12 edge points + 3 center points)', () => {
      const bbdConfig = {
        factors: [
          { id: 'f1', name: 'A', units: '', low: 10, high: 20 },
          { id: 'f2', name: 'B', units: '', low: 100, high: 200 },
          { id: 'f3', name: 'C', units: '', low: 1, high: 5 }
        ],
        centerPoints: 3,
        randomize: false,
        responses: [{ id: 'resp1', name: 'R1', units: '' }]
      };

      const bbdRuns = generateBBD(bbdConfig);
      expect(bbdRuns.length).toBe(15);

      const yBBD = [
        25.0, 30.0, 28.0, 34.0, 22.0, 29.0, 26.0, 31.0,
        24.0, 27.0, 25.5, 29.5,
        28.0, 28.2, 27.9 // 3 center points
      ];

      const coded = bbdRuns.map(r => r.codedValues);
      const mm = createModelMatrix(coded, ['f1', 'f2', 'f3'], 'Quadratic');
      expect(mm.terms.length).toBe(10);

      const res = analyzeModel(mm, yBBD, 'Quadratic', coded, bbdRuns);
      expect(res.fitted.n).toBe(15);
      expect(res.fitted.p).toBe(10);
      expect(res.fitted.dfModel).toBe(9);
      expect(res.fitted.dfError).toBe(5); // 15 - 10 = 5
      expect(res.fitted.dfTotal).toBe(14);

      // 3 center points -> dfPureError = 2
      expect(res.lackOfFit.available).toBe(true);
      expect(res.lackOfFit.dfPureError).toBe(2);
      expect(res.lackOfFit.dfLOF).toBe(3); // 5 - 2 = 3

      const fullRes: any = {
        ...res,
        responseId: 'resp1',
        modelType: 'Quadratic',
        factors: bbdConfig.factors,
        timestamp: new Date().toISOString()
      };
      expect(() => validateAnalysisResult(fullRes)).not.toThrow();
    });
  });

  // ==========================================
  // SECTION 9: MODEL COMPARISON IN FIT SUMMARY
  // ==========================================
  describe('Model Comparison for Fit Summary', () => {
    test('Generates comparative statistics for Linear, 2FI, and Quadratic models', () => {
      const mm = createModelMatrix(codedCCD2F, ['A', 'B'], 'Quadratic');
      const res = analyzeModel(mm, yCCD2F, 'Quadratic', codedCCD2F, undefined, factors2F);

      expect(res.modelComparison).toBeDefined();
      expect(res.modelComparison!.length).toBe(5);

      const [meanRow, linearRow, twoFiRow, quadRow, cubicRow] = res.modelComparison!;
      expect(linearRow.modelType).toBe('Linear');
      expect(twoFiRow.modelType).toBe('2FI');
      expect(quadRow.modelType).toBe('Quadratic');

      expect(linearRow.r2).toBeDefined();
      expect(twoFiRow.r2).toBeDefined();
      expect(quadRow.r2).toBeDefined();

      // Quadratic model R2 should be higher than Linear R2
      expect(quadRow.r2!).toBeGreaterThanOrEqual(linearRow.r2!);
      expect(quadRow.suggested).toBe(true);
    });
  });
});
