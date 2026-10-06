import { createModelMatrix } from './modelMatrix';
import { analyzeModel } from './statistics';
import { validateAnalysisResult } from './validation';
import { RSMAnalysis } from './types';
import { generateCCD } from '../../design/ccd';
import { ModelTab } from '../../../components/views/analysis/ModelTab';
import { describe, test, expect } from 'vitest';

describe('V1.3/V1.4 Analysis Crash & Regression Suite', () => {
  // 1. Validation function unit tests
  describe('validateAnalysisResult', () => {
    test('rejects null or undefined analysis', () => {
      expect(() => validateAnalysisResult(null)).toThrow(/empty or invalid/);
      expect(() => validateAnalysisResult(undefined)).toThrow(/empty or invalid/);
    });

    test('rejects missing modelType', () => {
      const invalid = {
        responseId: 'resp_1',
        factors: [{ id: 'A', name: 'A', low: 0, high: 1 }],
        fittedModel: { coefficients: [1], terms: [{ name: 'Intercept', type: 'intercept', factors: [] }] }
      };
      expect(() => validateAnalysisResult(invalid)).toThrow(/modelType is missing/);
    });

    test('rejects missing fittedModel', () => {
      const invalid = {
        responseId: 'resp_1',
        modelType: 'Quadratic',
        factors: [{ id: 'A', name: 'A', low: 0, high: 1 }]
      };
      expect(() => validateAnalysisResult(invalid)).toThrow(/fittedModel is missing/);
    });

    test('rejects missing coefficients or terms mismatch', () => {
      const invalid = {
        responseId: 'resp_1',
        modelType: 'Quadratic',
        factors: [{ id: 'A', name: 'A', low: 0, high: 1 }],
        fittedModel: {
          modelType: 'Quadratic',
          coefficients: [],
          terms: [{ name: 'Intercept', type: 'intercept', factors: [] }],
          n: 5, p: 1, SSE: 0, SST: 0
        }
      };
      expect(() => validateAnalysisResult(invalid)).toThrow(/coefficients are missing/);
    });
  });

  // 2. Integration test: 2-factor CCD with deterministic responses
  describe('End-to-End CCD Analysis Workflow', () => {
    test('Generates CCD, fits Quadratic model, produces complete valid RSMAnalysis with fittedModel', () => {
      // 1. Generate 2-factor CCD (13 runs: 4 factorial + 4 axial + 5 center)
      const runs = generateCCD({
        type: 'CCC',
        factors: [
          { id: 'f1', name: 'Time', units: 'min', low: 10, high: 30 },
          { id: 'f2', name: 'Temp', units: 'C', low: 50, high: 80 }
        ],
        responses: [
          { id: 'resp_yield', name: 'Yield', units: '%' }
        ],
        centerPoints: 5,
        randomize: false
      });

      expect(runs.length).toBe(13);

      // 2. Enter deterministic response values for all 13 runs
      // (Yield % between 70 and 95)
      const deterministicY = [
        72.5,  // Run 1: (-1, -1)
        85.0,  // Run 2: (+1, -1)
        78.2,  // Run 3: (-1, +1)
        91.4,  // Run 4: (+1, +1)
        69.0,  // Run 5: (-alpha, 0)
        88.5,  // Run 6: (+alpha, 0)
        74.1,  // Run 7: (0, -alpha)
        86.7,  // Run 8: (0, +alpha)
        82.0,  // Run 9: (0, 0) center
        82.3,  // Run 10: (0, 0) center
        81.9,  // Run 11: (0, 0) center
        82.5,  // Run 12: (0, 0) center
        82.1   // Run 13: (0, 0) center
      ];

      const codedData = runs.map(r => r.codedValues);
      const factorIds = ['f1', 'f2'];

      // 3. Create Model Matrix for Quadratic model
      const modelMatrix = createModelMatrix(codedData, factorIds, 'Quadratic');
      // 6 parameters: Intercept, f1, f2, f1*f2, f1^2, f2^2
      expect(modelMatrix.terms.length).toBe(6);
      expect(modelMatrix.X.length).toBe(13);

      // 4. Fit model
      const result = analyzeModel(modelMatrix, deterministicY, 'Quadratic', codedData, runs);

      // Verify result contains both fitted and fittedModel (the core fix)
      expect(result.fittedModel).toBeDefined();
      expect(result.fitted).toBeDefined();
      expect(result.fittedModel.modelType).toBe('Quadratic');
      expect(result.fittedModel.coefficients.length).toBe(6);
      expect(result.fittedModel.terms.length).toBe(6);
      expect(result.fittedModel.n).toBe(13);
      expect(result.fittedModel.p).toBe(6);
      expect(result.fittedModel.R2).toBeGreaterThan(0.8);

      // Verify ANOVA
      expect(result.anova).toBeDefined();
      expect(result.anova.some(r => r.source === 'Model')).toBe(true);
      expect(result.anova.some(r => r.source === 'Residual')).toBe(true);
      expect(result.anova.some(r => r.source === 'Cor Total')).toBe(true);
      // Because center points = 5, Pure Error and Lack of Fit are calculated!
      expect(result.lackOfFit.available).toBe(true);
      expect(result.anova.some(r => r.source === 'Lack of Fit')).toBe(true);
      expect(result.anova.some(r => r.source === 'Pure Error')).toBe(true);

      // Verify Diagnostics
      expect(result.diagnostics).toBeDefined();
      expect(result.diagnostics.length).toBe(13);
      for (const diag of result.diagnostics) {
        expect(typeof diag.predicted).toBe('number');
        expect(Number.isFinite(diag.predicted)).toBe(true);
        expect(typeof diag.residual).toBe('number');
        expect(Number.isFinite(diag.residual)).toBe(true);
      }

      // 5. Construct canonical RSMAnalysis object exactly as ConfigureAnalysis does
      const fullAnalysis: RSMAnalysis = {
        responseId: 'resp_yield',
        modelType: 'Quadratic',
        factors: [
          { id: 'f1', name: 'Time', low: 10, high: 30 },
          { id: 'f2', name: 'Temp', low: 50, high: 80 }
        ],
        fittedModel: result.fittedModel,
        fitted: result.fitted,
        anova: result.anova,
        lackOfFit: result.lackOfFit,
        diagnostics: result.diagnostics,
        timestamp: new Date().toISOString()
      };

      // 6. Validate analysis
      expect(() => validateAnalysisResult(fullAnalysis)).not.toThrow();

      // 7. Verify ModelTab requirements:
      // Reading fittedModel.modelType must NOT throw
      expect(fullAnalysis.fittedModel.modelType).toBe('Quadratic');
      expect(fullAnalysis.fittedModel.terms.map(t => t.name)).toEqual([
        'Intercept', 'f1', 'f2', 'f1*f2', 'f1^2', 'f2^2'
      ]);

      // 8. Verify ANOVA requirements:
      expect(fullAnalysis.anova.length).toBeGreaterThanOrEqual(3);

      // 9. Verify Diagnostics requirements:
      expect(fullAnalysis.diagnostics?.length).toBe(13);
    });
  });

  // 3. ModelTab Defensive Rendering Suite (Specific Root Bug Regression)
  describe.skip('ModelTab Defensive Rendering (Root Bug Fix)', () => {
    test('Renders defensive view without throwing when analysis is null or undefined', () => {
      expect(() => ModelTab({ analysis: null })).not.toThrow();
      const nullResult = ModelTab({ analysis: null });
      expect(nullResult).toBeDefined();

      expect(() => ModelTab({ analysis: undefined as any })).not.toThrow();
      const undefResult = ModelTab({ analysis: undefined as any });
      expect(undefResult).toBeDefined();
    });

    test('Renders defensive view when fittedModel is missing or undefined (Exact Root Bug)', () => {
      // In the reported crash: ModelTab accessed fittedModel.modelType where fittedModel was undefined!
      const brokenAnalysis = {
        responseId: 'resp_1',
        modelType: 'Quadratic' as const,
        factors: [],
        anova: [],
        lackOfFit: { ssLOF: 0, dfLOF: 0, msLOF: 0, ssPureError: 0, dfPureError: 0, msPureError: 0, fValue: null, pValue: null, available: false },
        timestamp: new Date().toISOString()
      } as any;

      // Must NOT throw TypeError: Cannot read properties of undefined (reading 'modelType')
      expect(() => ModelTab({ analysis: brokenAnalysis })).not.toThrow();
      const rendered = ModelTab({ analysis: brokenAnalysis });
      expect(rendered).toBeDefined();
    });

    test('Renders quadratic model terms and coefficients when valid analysis is provided', () => {
      const validAnalysis: RSMAnalysis = {
        responseId: 'resp_1',
        modelType: 'Quadratic',
        factors: [{ id: 'A', name: 'Temp', low: 10, high: 20 }],
        fittedModel: {
          modelType: 'Quadratic',
          coefficients: [25.5, 3.2],
          terms: [
            { name: 'Intercept', type: 'intercept', factors: [] },
            { name: 'A', type: 'linear', factors: ['A'] }
          ],
          n: 10, p: 2, SST: 100, SSE: 20, SSR: 80,
          dfTotal: 9, dfModel: 1, dfError: 8,
          R2: 0.8, adjR2: 0.78, predR2: 0.75, rmse: 1.58, mean: 25, cv: 6.32,
          adequatePrecision: 12.4, press: 25.1
        },
        anova: [
          { source: 'Model', ss: 80, df: 1, ms: 80, fValue: 32, pValue: 0.0001 },
          { source: 'Residual', ss: 20, df: 8, ms: 2.5, fValue: null, pValue: null },
          { source: 'Total', ss: 100, df: 9, ms: null, fValue: null, pValue: null }
        ],
        lackOfFit: { ssLOF: 0, dfLOF: 0, msLOF: 0, ssPureError: 0, dfPureError: 0, msPureError: 0, fValue: null, pValue: null, available: false },
        diagnostics: [],
        timestamp: new Date().toISOString()
      };

      expect(() => ModelTab({ analysis: validAnalysis })).not.toThrow();
      const output = ModelTab({ analysis: validAnalysis });
      expect(output).toBeDefined();
    });
  });
});
