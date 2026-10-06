import { describe, test, expect } from 'vitest';
import { createModelMatrix } from './modelMatrix';
import { analyzeModel } from './statistics';
import { generateActualEquation } from './equations';
import { FactorDefinition } from './types';

describe('RSM Statistical Engine', () => {
  const factors: FactorDefinition[] = [
    { id: 'A', name: 'Temperature', low: 50, high: 100 },
    { id: 'B', name: 'Pressure', low: 1, high: 5 }
  ];

  // A 2^2 full factorial design + 1 center point
  const codedData = [
    { A: -1, B: -1 },
    { A: 1, B: -1 },
    { A: -1, B: 1 },
    { A: 1, B: 1 },
    { A: 0, B: 0 } // Center point
  ];

  // Dummy response
  const y = [10, 20, 15, 30, 22]; // length 5

  test('Model Matrix creation - Linear', () => {
    const { X, terms } = createModelMatrix(codedData, ['A', 'B'], 'Linear');
    expect(terms.length).toBe(3); // Intercept, A, B
    expect(X.length).toBe(5);
    expect(X[0]).toEqual([1, -1, -1]);
    expect(X[4]).toEqual([1, 0, 0]);
  });

  test('Model Matrix creation - 2FI', () => {
    const { X, terms } = createModelMatrix(codedData, ['A', 'B'], '2FI');
    expect(terms.length).toBe(4); // Intercept, A, B, A*B
    expect(X[0]).toEqual([1, -1, -1, 1]); // -1 * -1 = 1
  });

  test('Model Fitting & Statistics - Linear', () => {
    const mm = createModelMatrix(codedData, ['A', 'B'], 'Linear');
    const result = analyzeModel(mm, y, 'Linear', codedData);
    
    expect(result.fitted.modelType).toBe('Linear');
    expect(result.fitted.p).toBe(3);
    expect(result.fitted.n).toBe(5);
    
    // Check R2
    expect(result.fitted.R2).toBeGreaterThan(0.5);
    
    // ANOVA table should have 3 rows + LOF/Pure error if available (which it isn't, no pure replicates)
    expect(result.anova.some(r => r.source === 'Model')).toBe(true);
    expect(result.anova.some(r => r.source === 'Residual')).toBe(true);
    
    expect(result.lackOfFit.available).toBe(false);
  });

  test('Model Fitting & Statistics - Rank deficiency', () => {
    // If we try to fit Quadratic (6 terms) with 5 data points, it should fail
    const mm = createModelMatrix(codedData, ['A', 'B'], 'Quadratic');
    expect(() => {
      analyzeModel(mm, y, 'Quadratic', codedData);
    }).toThrow(/estimated from the available data/);
  });

  test('Missing Data block test', () => {
    // This logic isn't in fitModel directly, but the UI should prevent passing missing data
  });
  
  test('Actual equation expansion', () => {
    // For a Linear model
    // Y = 20 + 5A_coded + 2.5B_coded
    // A_coded = (A - 75) / 25
    // B_coded = (B - 3) / 2
    // Y = 20 + 5(A - 75)/25 + 2.5(B - 3)/2 = 20 + A/5 - 15 + 1.25B - 3.75 = 1.25 + 0.2A + 1.25B
    
    const fitted = {
      modelType: 'Linear' as const,
      coefficients: [20, 5, 2.5],
      terms: [
        { name: 'Intercept', type: 'intercept' as const, factors: [] },
        { name: 'A', type: 'linear' as const, factors: ['A'] },
        { name: 'B', type: 'linear' as const, factors: ['B'] }
      ],
      n: 5, p: 3, SST: 0, SSE: 0, SSR: 0, dfTotal: 4, dfModel: 2, dfError: 2,
      R2: 1, adjR2: 1, predR2: 1, rmse: 0, mean: 20, cv: 0, adequatePrecision: 10, press: 0
    };
    
    const eq = generateActualEquation(fitted, factors);
    expect(eq).toContain('1.25000');
    expect(eq).toContain('+ 0.20000 * Temperature');
    expect(eq).toContain('+ 1.25000 * Pressure');
  });
});
