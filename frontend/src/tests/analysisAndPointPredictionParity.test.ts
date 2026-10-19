import { describe, it, expect } from 'vitest';
import { calculatePointPredictions, computeRegressionToleranceFactor } from '../lib/statistics/prediction';
import { createModelMatrix } from '../lib/statistics/rsm/modelMatrix';
import { analyzeModel } from '../lib/statistics/rsm/statistics';
import { FactorBounds } from '../lib/optimization/solver';

describe('AQbD Studio V1.0 — Analysis, Point Prediction & Tolerance Intervals Parity with Design-Expert 13', () => {

  // 3-factor CCD benchmark setup
  const factors: FactorBounds[] = [
    { id: 'f1', name: 'A', low: 35.0, high: 45.0, units: 'min' },
    { id: 'f2', name: 'B', low: 2.50, high: 3.50, units: 'pH' },
    { id: 'f3', name: 'C', low: 25.0, high: 35.0, units: 'C' }
  ];

  const responses = [
    { id: 'r1', name: 'Resolution', units: '' },
    { id: 'r2', name: 'Retention Time', units: 'min' },
    { id: 'r3', name: 'Tailing Factor', units: '' }
  ];

  // 20-run Central Composite Design (CCD) benchmark data
  const rawRuns = [
    { id: '1', stdOrder: 1, runOrder: 1, actualValues: { f1: 35, f2: 2.5, f3: 25 }, codedValues: { f1: -1, f2: -1, f3: -1 }, responses: { r1: 1.82, r2: 6.2, r3: 1.05 } },
    { id: '2', stdOrder: 2, runOrder: 2, actualValues: { f1: 45, f2: 2.5, f3: 25 }, codedValues: { f1: 1, f2: -1, f3: -1 }, responses: { r1: 2.45, r2: 7.1, r3: 1.12 } },
    { id: '3', stdOrder: 3, runOrder: 3, actualValues: { f1: 35, f2: 3.5, f3: 25 }, codedValues: { f1: -1, f2: 1, f3: -1 }, responses: { r1: 2.10, r2: 8.4, r3: 1.08 } },
    { id: '4', stdOrder: 4, runOrder: 4, actualValues: { f1: 45, f2: 3.5, f3: 25 }, codedValues: { f1: 1, f2: 1, f3: -1 }, responses: { r1: 3.05, r2: 9.8, r3: 1.25 } },
    { id: '5', stdOrder: 5, runOrder: 5, actualValues: { f1: 35, f2: 2.5, f3: 35 }, codedValues: { f1: -1, f2: -1, f3: 1 }, responses: { r1: 2.30, r2: 7.0, r3: 1.10 } },
    { id: '6', stdOrder: 6, runOrder: 6, actualValues: { f1: 45, f2: 2.5, f3: 35 }, codedValues: { f1: 1, f2: -1, f3: 1 }, responses: { r1: 3.12, r2: 8.2, r3: 1.22 } },
    { id: '7', stdOrder: 7, runOrder: 7, actualValues: { f1: 35, f2: 3.5, f3: 35 }, codedValues: { f1: -1, f2: 1, f3: 1 }, responses: { r1: 2.68, r2: 9.5, r3: 1.18 } },
    { id: '8', stdOrder: 8, runOrder: 8, actualValues: { f1: 45, f2: 3.5, f3: 35 }, codedValues: { f1: 1, f2: 1, f3: 1 }, responses: { r1: 3.85, r2: 11.2, r3: 1.35 } },
    { id: '9', stdOrder: 9, runOrder: 9, actualValues: { f1: 31.59, f2: 3.0, f3: 30 }, codedValues: { f1: -1.682, f2: 0, f3: 0 }, responses: { r1: 1.65, r2: 6.8, r3: 1.02 } },
    { id: '10', stdOrder: 10, runOrder: 10, actualValues: { f1: 48.41, f2: 3.0, f3: 30 }, codedValues: { f1: 1.682, f2: 0, f3: 0 }, responses: { r1: 3.42, r2: 10.1, r3: 1.30 } },
    { id: '11', stdOrder: 11, runOrder: 11, actualValues: { f1: 40, f2: 2.16, f3: 30 }, codedValues: { f1: 0, f2: -1.682, f3: 0 }, responses: { r1: 2.05, r2: 6.5, r3: 1.06 } },
    { id: '12', stdOrder: 12, runOrder: 12, actualValues: { f1: 40, f2: 3.84, f3: 30 }, codedValues: { f1: 0, f2: 1.682, f3: 0 }, responses: { r1: 3.25, r2: 10.5, r3: 1.28 } },
    { id: '13', stdOrder: 13, runOrder: 13, actualValues: { f1: 40, f2: 3.0, f3: 21.59 }, codedValues: { f1: 0, f2: 0, f3: -1.682 }, responses: { r1: 2.15, r2: 7.2, r3: 1.07 } },
    { id: '14', stdOrder: 14, runOrder: 14, actualValues: { f1: 40, f2: 3.0, f3: 38.41 }, codedValues: { f1: 0, f2: 0, f3: 1.682 }, responses: { r1: 3.35, r2: 9.9, r3: 1.26 } },
    // Center points
    { id: '15', stdOrder: 15, runOrder: 15, actualValues: { f1: 40, f2: 3.0, f3: 30 }, codedValues: { f1: 0, f2: 0, f3: 0 }, responses: { r1: 2.80, r2: 8.4, r3: 1.15 } },
    { id: '16', stdOrder: 16, runOrder: 16, actualValues: { f1: 40, f2: 3.0, f3: 30 }, codedValues: { f1: 0, f2: 0, f3: 0 }, responses: { r1: 2.75, r2: 8.3, r3: 1.13 } },
    { id: '17', stdOrder: 17, runOrder: 17, actualValues: { f1: 40, f2: 3.0, f3: 30 }, codedValues: { f1: 0, f2: 0, f3: 0 }, responses: { r1: 2.82, r2: 8.5, r3: 1.14 } },
    { id: '18', stdOrder: 18, runOrder: 18, actualValues: { f1: 40, f2: 3.0, f3: 30 }, codedValues: { f1: 0, f2: 0, f3: 0 }, responses: { r1: 2.76, r2: 8.4, r3: 1.14 } },
    { id: '19', stdOrder: 19, runOrder: 19, actualValues: { f1: 40, f2: 3.0, f3: 30 }, codedValues: { f1: 0, f2: 0, f3: 0 }, responses: { r1: 2.79, r2: 8.4, r3: 1.15 } },
    { id: '20', stdOrder: 20, runOrder: 20, actualValues: { f1: 40, f2: 3.0, f3: 30 }, codedValues: { f1: 0, f2: 0, f3: 0 }, responses: { r1: 2.77, r2: 8.4, r3: 1.13 } },
  ];

  // Helper to fit quadratic model for a response
  const fitQuadratic = (respId: string) => {
    const factorIds = factors.map(f => f.id);
    const codedData = rawRuns.map(r => r.codedValues);
    const y = rawRuns.map(r => r.responses[respId as keyof typeof r.responses] as number);
    const modelMatrix = createModelMatrix(codedData, factorIds, 'Quadratic');
    const result = analyzeModel(modelMatrix, y, 'Quadratic', codedData, rawRuns, factors as any);
    return {
      fittedModel: result.fittedModel || result.fitted,
      fitted: result.fittedModel || result.fitted,
      anova: result.anova
    };
  };

  const analyses: Record<string, any> = {
    r1: fitQuadratic('r1'),
    r2: fitQuadratic('r2'),
    r3: fitQuadratic('r3'),
  };

  it('1. Computes regression tolerance factor k closely matching Design-Expert 13', () => {
    // Center point leverage for 20-run CCD: h0 ≈ 0.16634, df = 10
    const h0 = 0.1663403;
    const df = 10;
    const k = computeRegressionToleranceFactor(df, h0, 0.05, 0.99, 'Two-sided');

    // Design-Expert 13 tolerance factor for df=10, P=0.99, alpha=0.05 is ~4.8427
    expect(k).toBeGreaterThan(4.80);
    expect(k).toBeLessThan(4.88);
    expect(Math.abs(k - 4.8427)).toBeLessThan(0.02);
  });

  it('2. Computes Point Prediction values with exact SE Mean and interval bounds', () => {
    // Evaluate at center point: A=40.0, B=3.0, C=30.0
    const centerPoint = { f1: 40.0, f2: 3.0, f3: 30.0 };
    const predictions = calculatePointPredictions(
      factors,
      responses,
      analyses,
      rawRuns,
      centerPoint,
      { alpha: 0.05, toleranceProp: 0.99, intervalType: 'Two-sided' }
    );

    expect(predictions).toHaveLength(3);

    // Resolution (r1)
    const r1Pred = predictions.find(p => p.responseId === 'r1')!;
    expect(r1Pred).toBeDefined();
    expect(r1Pred.isAnalyzed).toBe(true);
    expect(r1Pred.predictedMean).toBeCloseTo(2.782, 2);
    expect(r1Pred.predictedMedian).toBeCloseTo(2.782, 2);
    expect(r1Pred.stdDev).toBeCloseTo(0.081, 2);
    expect(r1Pred.stdErrorMean).toBeCloseTo(0.033, 2);
    expect(r1Pred.ciLow).toBeLessThan(r1Pred.predictedMean!);
    expect(r1Pred.ciHigh).toBeGreaterThan(r1Pred.predictedMean!);
    expect(r1Pred.tiLow).toBeLessThan(r1Pred.ciLow!);
    expect(r1Pred.tiHigh).toBeGreaterThan(r1Pred.ciHigh!);

    // Retention Time (r2)
    const r2Pred = predictions.find(p => p.responseId === 'r2')!;
    expect(r2Pred).toBeDefined();
    expect(r2Pred.predictedMean).toBeGreaterThan(0);
    expect(r2Pred.stdDev).toBeGreaterThan(0);
    expect(r2Pred.stdErrorMean).toBeCloseTo(r2Pred.stdDev! * Math.sqrt(0.16634), 2);

    // Tailing Factor (r3)
    const r3Pred = predictions.find(p => p.responseId === 'r3')!;
    expect(r3Pred).toBeDefined();
    expect(r3Pred.predictedMean).toBeGreaterThan(0);
    expect(r3Pred.stdDev).toBeGreaterThan(0);
    expect(r3Pred.stdErrorMean).toBeCloseTo(r3Pred.stdDev! * Math.sqrt(0.16634), 2);
  });

  it('3. Displays matching Observed values when coordinates align with experimental runs', () => {
    // Run 1 in CCD table has: f1=35, f2=2.5, f3=25 with r1=1.82, r2=6.2, r3=1.05
    const run1Point = { f1: 35.0, f2: 2.5, f3: 25.0 };
    const predictions = calculatePointPredictions(
      factors,
      responses,
      analyses,
      rawRuns,
      run1Point
    );

    const r1Pred = predictions.find(p => p.responseId === 'r1')!;
    const r2Pred = predictions.find(p => p.responseId === 'r2')!;
    const r3Pred = predictions.find(p => p.responseId === 'r3')!;

    expect(r1Pred.observedValue).toBe(1.82);
    expect(r2Pred.observedValue).toBe(6.2);
    expect(r3Pred.observedValue).toBe(1.05);

    // Non-experimental coordinate should have null observedValue
    const nonExpPoint = { f1: 38.25, f2: 2.85, f3: 28.5 };
    const nonExpPreds = calculatePointPredictions(
      factors,
      responses,
      analyses,
      rawRuns,
      nonExpPoint
    );
    expect(nonExpPreds[0].observedValue).toBeNull();
  });

  it('4. Handles unanalyzed responses gracefully in prediction tables', () => {
    // Only r1 is analyzed; r2 and r3 are empty
    const partialAnalyses = { r1: analyses.r1 };
    const centerPoint = { f1: 40.0, f2: 3.0, f3: 30.0 };

    const predictions = calculatePointPredictions(
      factors,
      responses,
      partialAnalyses,
      rawRuns,
      centerPoint
    );

    expect(predictions).toHaveLength(3);
    expect(predictions[0].isAnalyzed).toBe(true);
    expect(predictions[0].predictedMean).not.toBeNull();

    expect(predictions[1].isAnalyzed).toBe(false);
    expect(predictions[1].predictedMean).toBeNull();
    expect(predictions[1].ciLow).toBeNull();

    expect(predictions[2].isAnalyzed).toBe(false);
    expect(predictions[2].predictedMean).toBeNull();
    expect(predictions[2].ciLow).toBeNull();
  });

  it('5. Adjusts critical multiplier when switching between Two-sided and One-sided intervals', () => {
    const centerPoint = { f1: 40.0, f2: 3.0, f3: 30.0 };
    
    const twoSided = calculatePointPredictions(
      factors,
      responses,
      analyses,
      rawRuns,
      centerPoint,
      { alpha: 0.05, toleranceProp: 0.99, intervalType: 'Two-sided' }
    );

    const oneSided = calculatePointPredictions(
      factors,
      responses,
      analyses,
      rawRuns,
      centerPoint,
      { alpha: 0.05, toleranceProp: 0.99, intervalType: 'One-sided' }
    );

    // One-sided critical multiplier is t(1-alpha) which is narrower than t(1-alpha/2)
    const ciWidthTwo = twoSided[0].ciHigh! - twoSided[0].ciLow!;
    const ciWidthOne = oneSided[0].ciHigh! - oneSided[0].ciLow!;
    expect(ciWidthOne).toBeLessThan(ciWidthTwo);
  });

});
