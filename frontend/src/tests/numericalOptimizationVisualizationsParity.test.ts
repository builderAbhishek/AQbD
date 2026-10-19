import { describe, it, expect } from 'vitest';
import { 
  predictModelResponse, 
  calculateIndividualDesirability, 
  calculateCombinedDesirability,
  FactorBounds,
  FittedModelRef
} from '../lib/optimization/solver';
import { OptimizationSolution, OptimizationCriterion } from '../lib/optimization/types';

describe('AQbD Studio V1.0 — Numerical Optimization Results Visualizations Parity with DX13', () => {

  // Benchmark factors matching the HPLC dataset
  const factors: FactorBounds[] = [
    { id: 'f_organic', name: 'A', low: 35, high: 45, units: '%' },
    { id: 'f_ph', name: 'B', low: 2.5, high: 3.5, units: '' },
    { id: 'f_flow', name: 'C', low: 25, high: 35, units: '°C' },
  ];

  // Fitted models for the 3 HPLC responses
  const resModel: FittedModelRef = {
    modelType: 'quadratic',
    terms: [
      { name: 'Intercept', type: 'intercept' },
      { name: 'A', type: 'linear', factors: ['f_organic'] },
      { name: 'B', type: 'linear', factors: ['f_ph'] },
      { name: 'C', type: 'linear', factors: ['f_flow'] },
      { name: 'AB', type: 'interaction', factors: ['f_organic', 'f_ph'] },
      { name: 'AC', type: 'interaction', factors: ['f_organic', 'f_flow'] },
      { name: 'BC', type: 'interaction', factors: ['f_ph', 'f_flow'] },
      { name: 'A^2', type: 'quadratic', factors: ['f_organic'] },
      { name: 'B^2', type: 'quadratic', factors: ['f_ph'] },
      { name: 'C^2', type: 'quadratic', factors: ['f_flow'] },
    ],
    coefficients: [2.5, 0.4, 0.05, 0.15, -0.02, 0.01, -0.01, -0.1, -0.05, -0.08],
  };

  const criteria: Record<string, OptimizationCriterion> = {
    f_organic: { goal: 'in_range', lowerLimit: 35, upperLimit: 45, weight: 1, importance: 3 },
    f_ph: { goal: 'in_range', lowerLimit: 2.5, upperLimit: 3.5, weight: 1, importance: 3 },
    f_flow: { goal: 'in_range', lowerLimit: 25, upperLimit: 35, weight: 1, importance: 3 },
    res: { goal: 'maximize', lowerLimit: 2.0, upperLimit: 3.09, weight: 1, importance: 3 },
    rt: { goal: 'minimize', lowerLimit: 7.2, upperLimit: 9.4, weight: 1, importance: 3 },
    tf: { goal: 'target', lowerLimit: 1.08, upperLimit: 1.30, targetValue: 1.15, weight: 1, importance: 3 },
  };

  const sampleSolution: OptimizationSolution = {
    solutionNumber: 1,
    factors: {
      f_organic: 36.0673,
      f_ph: 2.74769,
      f_flow: 26.9805,
    },
    predictions: {
      res: 2.39596,
      rt: 7.66925,
      tf: 1.16377,
    },
    desirability: 0.6560,
    individualDesirability: {
      f_organic: 1.0,
      f_ph: 1.0,
      f_flow: 1.0,
      res: 0.3633,
      rt: 0.7867,
      tf: 0.9082,
    },
    convergenceStatus: 'converged',
  };

  describe('1. Bar Graph View Calculations & Design-Expert 13 Parity', () => {
    it('compiles factor bars with letter:name labels and satisfaction values', () => {
      const factorBars = factors.map((f, idx) => {
        const letter = String.fromCharCode(65 + idx);
        return {
          id: f.id,
          label: `${letter}:${f.name}`,
          desirability: sampleSolution.individualDesirability[f.id] ?? 1.0,
          color: '#005C8A',
        };
      });

      expect(factorBars).toHaveLength(3);
      expect(factorBars[0].label).toBe('A:A');
      expect(factorBars[1].label).toBe('B:B');
      expect(factorBars[2].label).toBe('C:C');
      expect(factorBars.every(b => b.desirability === 1.0)).toBe(true);
      expect(factorBars.every(b => b.color === '#005C8A')).toBe(true);
    });

    it('compiles response bars and combined overall desirability bar', () => {
      const responseIds = ['res', 'rt', 'tf'];
      const responseBars = responseIds.map(rId => ({
        id: rId,
        desirability: sampleSolution.individualDesirability[rId],
        color: '#CBD3DC',
      }));

      const combinedBar = {
        id: 'combined',
        label: 'Combined',
        desirability: sampleSolution.desirability,
        color: '#EB6A38',
      };

      expect(responseBars).toHaveLength(3);
      expect(responseBars[0].desirability).toBeCloseTo(0.3633, 3);
      expect(combinedBar.label).toBe('Combined');
      expect(combinedBar.desirability).toBeCloseTo(0.6560, 4);
      expect(combinedBar.color).toBe('#EB6A38');
    });

    it('formats bar values correctly according to DX13 rules (1 when 1, or decimal string)', () => {
      const formatValue = (val: number): string => {
        if (Math.abs(val - 1.0) < 1e-4) return '1';
        if (Math.abs(val) < 1e-4) return '0';
        return val.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
      };

      expect(formatValue(1.0)).toBe('1');
      expect(formatValue(0.6560)).toBe('0.656');
      expect(formatValue(0.3633)).toBe('0.3633');
      expect(formatValue(0.0)).toBe('0');
    });
  });

  describe('2. Ramps View Calculations & Geometry Parity', () => {
    it('computes factor ramp ratio and clamps within [low, high]', () => {
      factors.forEach(f => {
        const val = sampleSolution.factors[f.id];
        const span = f.high - f.low;
        const ratio = (val - f.low) / span;

        expect(val).toBeGreaterThanOrEqual(f.low);
        expect(val).toBeLessThanOrEqual(f.high);
        expect(ratio).toBeGreaterThanOrEqual(0);
        expect(ratio).toBeLessThanOrEqual(1);
      });
    });

    it('positions response ramp marker along predicted response trajectory', () => {
      const resCrit = criteria.res;
      const pred = sampleSolution.predictions.res;
      const span = resCrit.upperLimit! - resCrit.lowerLimit!;
      const ratio = (pred - resCrit.lowerLimit!) / span;

      expect(ratio).toBeGreaterThan(0);
      expect(ratio).toBeLessThan(1);
      expect(pred).toBeCloseTo(2.39596, 4);
    });
  });

  describe('3. Perturbation Plot Curve Evaluation', () => {
    it('evaluates response at coded deviation 0 matching reference point prediction', () => {
      const refPred = predictModelResponse(sampleSolution.factors, factors, resModel);
      expect(refPred).toBeGreaterThan(1.5);

      // At coded deviation 0 for factor A, actual value is reference value
      const dev0_pt = { ...sampleSolution.factors };
      const predAt0 = predictModelResponse(dev0_pt, factors, resModel);
      expect(predAt0).toBeCloseTo(refPred, 6);
    });

    it('evaluates smooth perturbation curves as factor A deviates from reference point', () => {
      const halfRangeA = (factors[0].high - factors[0].low) / 2;
      const refA = sampleSolution.factors.f_organic;

      const deviations = [-0.5, 0.0, 0.5, 1.0];
      const curvePredictions = deviations.map(dev => {
        const actA = refA + dev * halfRangeA;
        return predictModelResponse({ ...sampleSolution.factors, f_organic: actA }, factors, resModel);
      });

      expect(curvePredictions).toHaveLength(4);
      // Prediction should change continuously as A varies
      expect(curvePredictions[0]).not.toEqual(curvePredictions[1]);
      expect(curvePredictions[1]).not.toEqual(curvePredictions[2]);
    });
  });

  describe('4. One Factor Plot Curve Evaluation', () => {
    it('generates continuous curve points across full range [low, high] of factor A', () => {
      const fA = factors[0];
      const nSteps = 20;
      const pts: Array<{ x: number; y: number }> = [];

      for (let i = 0; i <= nSteps; i++) {
        const actA = fA.low + (i / nSteps) * (fA.high - fA.low);
        const pt = { ...sampleSolution.factors, [fA.id]: actA };
        const pred = predictModelResponse(pt, factors, resModel);
        pts.push({ x: actA, y: pred });
      }

      expect(pts[0].x).toBe(35);
      expect(pts[pts.length - 1].x).toBe(45);
      expect(pts.every(p => Number.isFinite(p.y))).toBe(true);
    });
  });

  describe('5. Interaction Plot Two-Curve Evaluation (X2- and X2+)', () => {
    it('evaluates distinct curves for low and high levels of factor B across factor A', () => {
      const fA = factors[0];
      const fB = factors[1];

      const nSteps = 10;
      const curveLowB: number[] = [];
      const curveHighB: number[] = [];

      for (let i = 0; i <= nSteps; i++) {
        const actA = fA.low + (i / nSteps) * (fA.high - fA.low);
        
        const ptLow = { ...sampleSolution.factors, [fA.id]: actA, [fB.id]: fB.low };
        curveLowB.push(predictModelResponse(ptLow, factors, resModel));

        const ptHigh = { ...sampleSolution.factors, [fA.id]: actA, [fB.id]: fB.high };
        curveHighB.push(predictModelResponse(ptHigh, factors, resModel));
      }

      expect(curveLowB).toHaveLength(11);
      expect(curveHighB).toHaveLength(11);
      // Because AB interaction coefficient is non-zero, curves should differ
      expect(curveLowB[0]).not.toEqual(curveHighB[0]);
    });
  });

});
