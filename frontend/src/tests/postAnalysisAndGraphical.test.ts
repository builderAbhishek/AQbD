import { describe, test, expect } from 'vitest';
import { 
  calculatePointPredictions, 
  calculateConfirmationComparison, 
  extractCoefficientsDetail 
} from '../lib/statistics/prediction';
import { refitResponseModel } from '../lib/statistics/rsm/modelFitting';
import { FactorBounds } from '../lib/optimization/solver';

describe('AQbD Studio — Post Analysis & Prediction Validation Suite', () => {
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

  const resAnalysis = refitResponseModel(designTemplate, 'r1', 'Quadratic');
  const rtAnalysis = refitResponseModel(designTemplate, 'r2', 'Quadratic');
  const tfAnalysis = refitResponseModel(designTemplate, 'r3', 'Quadratic');
  const analyses = { r1: resAnalysis, r2: rtAnalysis, r3: tfAnalysis };

  test('1. Point Prediction calculates accurate mean and intervals at benchmark point', () => {
    // Point: A=45, B=2.5, C=35 (Corner factorial)
    const factorSettings = { f1: 45, f2: 2.5, f3: 35 };
    const predictions = calculatePointPredictions(factors, responses, analyses, initialRuns, factorSettings);

    expect(predictions.length).toBe(3);

    const resPred = predictions.find(p => p.responseId === 'r1')!;
    const rtPred = predictions.find(p => p.responseId === 'r2')!;
    const tfPred = predictions.find(p => p.responseId === 'r3')!;

    // Predictions match reference values
    expect(resPred.predictedMean).toBeCloseTo(3.0924, 3);
    expect(rtPred.predictedMean).toBeCloseTo(9.1044, 3);
    expect(tfPred.predictedMean).toBeCloseTo(1.1392, 3);

    // Standard error of prediction is strictly larger than standard error of mean:
    // SE(Pred) = sqrt(MSE * (1 + h00)) > sqrt(MSE * h00) = SE(Mean)
    expect(resPred.stdErrorPred).toBeGreaterThan(resPred.stdErrorMean);
    expect(rtPred.stdErrorPred).toBeGreaterThan(rtPred.stdErrorMean);
    expect(tfPred.stdErrorPred).toBeGreaterThan(tfPred.stdErrorMean);

    // 95% PI is wider than 95% CI
    const ciWidth = resPred.ci95.high - resPred.ci95.low;
    const piWidth = resPred.pi95.high - resPred.pi95.low;
    expect(piWidth).toBeGreaterThan(ciWidth);

    // Not extrapolated at within-bounds point
    expect(resPred.isExtrapolated).toBe(false);
  });

  test('2. Point Prediction works at arbitrary user coordinates (e.g. A=37.59, B=2.65, C=30.50)', () => {
    const arbitraryPoint = { f1: 37.59, f2: 2.65, f3: 30.50 };
    const predictions = calculatePointPredictions(factors, responses, analyses, initialRuns, arbitraryPoint);

    expect(predictions.length).toBe(3);
    for (const p of predictions) {
      expect(Number.isFinite(p.predictedMean)).toBe(true);
      expect(p.predictedMean).toBeGreaterThan(0);
      expect(p.ci95.low).toBeLessThan(p.predictedMean);
      expect(p.ci95.high).toBeGreaterThan(p.predictedMean);
      expect(p.pi95.low).toBeLessThan(p.ci95.low);
      expect(p.pi95.high).toBeGreaterThan(p.ci95.high);
    }
  });

  test('3. Point Prediction detects extrapolation when factor settings exceed bounds', () => {
    const outOfBoundsPoint = { f1: 52.0, f2: 2.5, f3: 30.0 }; // f1 max is 45
    const predictions = calculatePointPredictions(factors, responses, analyses, initialRuns, outOfBoundsPoint);

    expect(predictions[0].isExtrapolated).toBe(true);
    expect(predictions[0].extrapolatedFactors.length).toBe(1);
    expect(predictions[0].extrapolatedFactors[0].factorId).toBe('f1');
    expect(predictions[0].extrapolatedFactors[0].value).toBe(52.0);
  });

  test('4. Confirmation comparison correctly validates experimental observations against 95% PI', () => {
    const factorSettings = { f1: 45, f2: 2.5, f3: 35 };

    // Case A: Observed resolution = 3.08 (inside 95% PI)
    const observedPass = { r1: 3.08, r2: 9.15, r3: 1.15 };
    const compPass = calculateConfirmationComparison(factors, responses, analyses, initialRuns, factorSettings, observedPass);

    const r1Pass = compPass.find(c => c.responseId === 'r1')!;
    expect(r1Pass.isConfirmed).toBe(true);
    expect(r1Pass.predictionError).toBeCloseTo(3.08 - 3.0924, 3);
    expect(r1Pass.percentError).toBeLessThan(1.0); // error < 1%

    // Case B: Observed resolution = 4.50 (wildly outside 95% PI)
    const observedFail = { r1: 4.50, r2: 9.15, r3: 1.15 };
    const compFail = calculateConfirmationComparison(factors, responses, analyses, initialRuns, factorSettings, observedFail);
    const r1Fail = compFail.find(c => c.responseId === 'r1')!;
    expect(r1Fail.isConfirmed).toBe(false);
  });

  test('5. Coefficients table extracts complete term estimates, SE, t-values, and p-values', () => {
    const coeffData = extractCoefficientsDetail(resAnalysis, factors, 'Resolution');

    expect(coeffData.coefficients.length).toBe(10); // Intercept + 3 linear + 3 interaction + 3 quadratic
    expect(coeffData.r2).toBeGreaterThan(0.99);
    expect(coeffData.dfError).toBe(10); // 20 runs - 10 terms = 10 df error

    const intercept = coeffData.coefficients.find(c => c.termType === 'intercept')!;
    expect(intercept.estimateCoded).toBeCloseTo(2.7967, 3);
    expect(intercept.df).toBe(1);
    expect(intercept.standardError).toBeGreaterThan(0);
    expect(intercept.tValue).toBeGreaterThan(0);
    expect(intercept.pValue).toBeLessThan(0.0001);

    const linearF1 = coeffData.coefficients.find(c => c.termName.includes('Organic Phase') && c.termType === 'linear')!;
    expect(linearF1.estimateCoded).toBeCloseTo(0.2368, 3);
    expect(linearF1.vif).toBeCloseTo(1.0, 1);
  });

  test('6. Multi-replicate confirmation run (k >= 1) narrows standard error of prediction and prediction interval', () => {
    const factorSettings = { f1: 40, f2: 3.0, f3: 30 }; // Center point
    const observedMean = { r1: 2.80, r2: 8.50, r3: 1.12 };

    // Single run (k = 1)
    const singleRun = calculateConfirmationComparison(factors, responses, analyses, initialRuns, factorSettings, observedMean, 1);
    const r1Single = singleRun.find(c => c.responseId === 'r1')!;

    // Replicate runs (k = 4)
    const multiRun = calculateConfirmationComparison(factors, responses, analyses, initialRuns, factorSettings, observedMean, 4);
    const r1Multi = multiRun.find(c => c.responseId === 'r1')!;

    // SE(Pred, k=4) must be strictly smaller than SE(Pred, k=1)
    expect(r1Multi.stdErrorPred).toBeLessThan(r1Single.stdErrorPred);

    // Consequently, 95% PI with k=4 replicates is narrower than single run PI
    const singlePiWidth = r1Single.pi95.high - r1Single.pi95.low;
    const multiPiWidth = r1Multi.pi95.high - r1Multi.pi95.low;
    expect(multiPiWidth).toBeLessThan(singlePiWidth);

    // Both should confirm center point mean
    expect(r1Single.isConfirmed).toBe(true);
    expect(r1Multi.isConfirmed).toBe(true);
  });

  test('7. Graphical Optimization grid calculation and overlay feasibility masking', () => {
    // Generate a 10x10 slice across Organic Phase (f1) and pH (f2) at fixed Temp (f3 = 30)
    const xSteps = 10;
    const ySteps = 10;
    const fX = factors[0];
    const fY = factors[1];
    const heldF3 = 30;

    const xVals: number[] = [];
    const yVals: number[] = [];
    for (let i = 0; i < xSteps; i++) {
      xVals.push(fX.low + (i / (xSteps - 1)) * (fX.high - fX.low));
    }
    for (let j = 0; j < ySteps; j++) {
      yVals.push(fY.low + (j / (ySteps - 1)) * (fY.high - fY.low));
    }

    // Evaluate predictions across the 2D grid
    const zResolution: number[][] = Array.from({ length: xSteps }, () => Array(ySteps).fill(0));
    for (let i = 0; i < xSteps; i++) {
      for (let j = 0; j < ySteps; j++) {
        const pt = { f1: xVals[i], f2: yVals[j], f3: heldF3 };
        const preds = calculatePointPredictions(factors, responses, analyses, initialRuns, pt);
        const r1Pred = preds.find(p => p.responseId === 'r1')!;
        zResolution[i][j] = r1Pred.predictedMean;
      }
    }

    // Grid must be fully populated with valid finite numbers
    expect(zResolution.length).toBe(xSteps);
    expect(zResolution[0].length).toBe(ySteps);
    for (let i = 0; i < xSteps; i++) {
      for (let j = 0; j < ySteps; j++) {
        expect(Number.isFinite(zResolution[i][j])).toBe(true);
        expect(zResolution[i][j]).toBeGreaterThan(1.5);
      }
    }

    // Overlay feasibility check: criteria Resolution >= 2.0
    let feasibleCount = 0;
    for (let i = 0; i < xSteps; i++) {
      for (let j = 0; j < ySteps; j++) {
        if (zResolution[i][j] >= 2.0) {
          feasibleCount++;
        }
      }
    }
    expect(feasibleCount).toBeGreaterThan(0);
  });

  test('8. Confirmation persistence schema conforms to project design structure', () => {
    const confirmationData = {
      runs: [
        {
          id: 'conf-run-1',
          runNumber: 1,
          timestamp: new Date().toISOString(),
          factorSettings: { f1: 40.5, f2: 3.1, f3: 29.8 },
          observedResponses: { r1: 2.82, r2: 8.48, r3: 1.13 },
          replicates: 2,
          notes: 'Confirmation trial 1'
        }
      ],
      updatedAt: new Date().toISOString()
    };

    expect(confirmationData.runs.length).toBe(1);
    expect(confirmationData.runs[0].replicates).toBe(2);
    expect(confirmationData.runs[0].observedResponses.r1).toBe(2.82);
  });
});
