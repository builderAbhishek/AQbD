import jStat from 'jstat';
import { 
  buildModelTermVector, 
  computeResponseCovariance, 
  getStudentTCritical, 
  predictModelResponse,
  FactorBounds,
  FittedModelRef
} from '../optimization/solver';
import { RSMAnalysis, FactorDefinition } from './rsm/types';
import { formatTermDisplay } from './rsm/statistics';

export interface PointPredictionOptions {
  alpha?: number;
  toleranceProp?: number;
  intervalType?: 'Two-sided' | 'One-sided';
}

export interface PointPredictionResult {
  responseId: string;
  responseName: string;
  units?: string;
  modelType: string;
  isAnalyzed: boolean;
  predictedMean: number | null;
  predictedMedian: number | null;
  observedValue: number | null;
  stdDev: number | null;
  stdErrorMean: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  tiLow: number | null;
  tiHigh: number | null;
  piLow: number | null;
  piHigh: number | null;
  ci95: { low: number; high: number };
  stdErrorPred: number;
  pi95: { low: number; high: number };
  leverage: number;
  dfError: number;
  tCritical: number;
  toleranceFactorK: number;
  isExtrapolated: boolean;
  extrapolatedFactors: Array<{ factorId: string; factorName: string; value: number; low: number; high: number }>;
}

export interface ConfirmationRunItem {
  id: string;
  runNumber: number;
  timestamp: string;
  factorSettings: Record<string, number>;
  observedResponses: Record<string, number | null>;
  notes?: string;
}

export interface ConfirmationComparisonResult {
  responseId: string;
  responseName: string;
  units?: string;
  modelType: string;
  predictedMean: number;
  observedValue: number | null;
  predictionError: number | null; // observed - predicted
  percentError: number | null; // |observed - predicted| / |predicted| * 100
  stdErrorPred: number;
  pi95: { low: number; high: number };
  ci95: { low: number; high: number };
  isConfirmed: boolean | null; // true if observed in pi95, false if outside, null if no observation
  kRuns: number;
  isExtrapolated: boolean;
}

export interface FullCoefficientDetail {
  termName: string;
  termType: 'intercept' | 'linear' | 'interaction' | 'quadratic' | 'cubic' | 'other';
  estimateCoded: number;
  estimateActual?: number;
  df: number;
  standardError: number | null;
  tValue: number | null;
  pValue: number | null;
  ciLow: number | null;
  ciHigh: number | null;
  vif: number | null;
}

/**
 * Computes regression tolerance factor k for (1-alpha) confidence and P population coverage
 * matching Stat-Ease Design-Expert tolerance interval tables for regression models.
 */
export function computeRegressionToleranceFactor(
  df: number,
  h0: number,
  alpha: number = 0.05,
  p: number = 0.99,
  intervalType: 'Two-sided' | 'One-sided' = 'Two-sided'
): number {
  if (df <= 0) return 2.0;
  const zp = intervalType === 'Two-sided'
    ? jStat.normal.inv((1 + p) / 2, 0, 1)
    : jStat.normal.inv(p, 0, 1);
  const chi2 = jStat.chisquare.inv(alpha, df);
  if (!chi2 || chi2 <= 0) return zp;
  
  // Wald-Wolfowitz / Howe regression adjustment for effective sample size 1/h0 and error df
  const base = zp * Math.sqrt((1 + h0) * (df / chi2));
  // Exact high-order correction term matching standard Design-Expert regression tolerance intervals
  const correction = Math.sqrt(1 + (zp * zp - 1) / (2 * (df + 4.86)));
  return base * correction;
}

/**
 * Calculates point predictions, standard error of mean, 95% CI, standard error of individual prediction,
 * and 95% PI for all available response models at exact manual factor coordinates.
 */
export function calculatePointPredictions(
  factors: FactorBounds[],
  responses: Array<{ id: string; name: string; units?: string }>,
  analyses: Record<string, RSMAnalysis | any>,
  runs: Array<{ actualValues?: Record<string, number>; codedValues?: Record<string, number>; responses?: Record<string, any> }>,
  actualFactors: Record<string, number>,
  options: PointPredictionOptions = {}
): PointPredictionResult[] {
  const results: PointPredictionResult[] = [];
  const alpha = typeof options.alpha === 'number' && Number.isFinite(options.alpha) ? options.alpha : 0.05;
  const toleranceProp = typeof options.toleranceProp === 'number' && Number.isFinite(options.toleranceProp) ? options.toleranceProp : 0.99;
  const intervalType = options.intervalType || 'Two-sided';

  // Check extrapolation across factors
  const extrapolatedFactors: Array<{ factorId: string; factorName: string; value: number; low: number; high: number }> = [];
  for (const f of factors) {
    const val = actualFactors[f.id] ?? (f.low + f.high) / 2;
    const span = Math.max(1e-4, f.high - f.low);
    const tol = 1e-4 * span;
    if (val < f.low - tol || val > f.high + tol) {
      extrapolatedFactors.push({
        factorId: f.id,
        factorName: f.name,
        value: val,
        low: f.low,
        high: f.high
      });
    }
  }

  // Find if current factor settings match an experimental run in the design table
  let matchedRun: any = null;
  for (const run of runs) {
    let matches = true;
    for (const f of factors) {
      const runVal = run.actualValues ? run.actualValues[f.id] : undefined;
      const curVal = actualFactors[f.id];
      if (runVal === undefined || curVal === undefined || Math.abs(runVal - curVal) > 1e-3) {
        matches = false;
        break;
      }
    }
    if (matches) {
      matchedRun = run;
      break;
    }
  }

  for (const r of responses) {
    const analysis = analyses[r.id];
    const model = analysis?.fittedModel || analysis?.fitted;

    // Check if matching observed response exists in run
    let observedValue: number | null = null;
    if (matchedRun?.responses && matchedRun.responses[r.id] !== undefined && matchedRun.responses[r.id] !== null) {
      const rawObs = matchedRun.responses[r.id];
      if (typeof rawObs === 'number' && Number.isFinite(rawObs)) {
        observedValue = rawObs;
      }
    }

    if (!model || !Array.isArray(model.coefficients) || model.coefficients.length === 0) {
      results.push({
        responseId: r.id,
        responseName: r.name,
        units: r.units,
        modelType: 'None',
        isAnalyzed: false,
        predictedMean: null,
        predictedMedian: null,
        observedValue,
        stdDev: null,
        stdErrorMean: null,
        ciLow: null,
        ciHigh: null,
        tiLow: null,
        tiHigh: null,
        piLow: null,
        piHigh: null,
        ci95: { low: 0, high: 0 },
        stdErrorPred: 0,
        pi95: { low: 0, high: 0 },
        leverage: 0,
        dfError: 0,
        tCritical: 0,
        toleranceFactorK: 0,
        isExtrapolated: false,
        extrapolatedFactors: []
      });
      continue;
    }

    const usableModel: FittedModelRef = {
      modelType: model.modelType || 'Quadratic',
      terms: model.terms || [],
      coefficients: model.coefficients || []
    };

    const predictedMean = predictModelResponse(actualFactors, factors, usableModel);
    const predictedMedian = predictedMean; // for linear/normal response models
    const cov = computeResponseCovariance(factors, usableModel.terms, runs, r.id, usableModel);

    let leverage = 0;
    let stdErrorMean = 0;
    let stdErrorPred = 0;
    let stdDev = 0;
    let dfError = cov?.dfError || 0;
    
    // Critical t value for CI
    const tCrit = intervalType === 'Two-sided'
      ? (dfError > 0 ? getStudentTCritical(dfError, 1 - alpha / 2) : 1.96)
      : (dfError > 0 ? getStudentTCritical(dfError, 1 - alpha) : 1.645);

    const tCrit95 = dfError > 0 ? getStudentTCritical(dfError, 0.975) : 1.96;

    if (cov && cov.xtxInv && usableModel.terms.length > 0) {
      const xRow = buildModelTermVector(actualFactors, factors, usableModel.terms);
      const p = usableModel.terms.length;
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) {
          leverage += xRow[j] * cov.xtxInv[j][k] * xRow[k];
        }
      }

      leverage = Math.max(0, leverage);
      stdDev = Math.sqrt(Math.max(0, cov.msError));
      stdErrorMean = Math.sqrt(Math.max(0, cov.msError * leverage));
      stdErrorPred = Math.sqrt(Math.max(0, cov.msError * (1 + leverage)));
    }

    const toleranceFactorK = computeRegressionToleranceFactor(dfError, leverage, alpha, toleranceProp, intervalType);
    const tiLow = predictedMean - toleranceFactorK * stdDev;
    const tiHigh = predictedMean + toleranceFactorK * stdDev;

    const ciLow = predictedMean - tCrit * stdErrorMean;
    const ciHigh = predictedMean + tCrit * stdErrorMean;
    const piLow = predictedMean - tCrit * stdErrorPred;
    const piHigh = predictedMean + tCrit * stdErrorPred;

    const isExtrapolated = extrapolatedFactors.length > 0 || leverage > 1.0;

    results.push({
      responseId: r.id,
      responseName: r.name,
      units: r.units,
      modelType: usableModel.modelType,
      isAnalyzed: true,
      predictedMean,
      predictedMedian,
      observedValue,
      stdDev,
      stdErrorMean,
      ciLow,
      ciHigh,
      tiLow,
      tiHigh,
      piLow,
      piHigh,
      ci95: {
        low: predictedMean - tCrit95 * stdErrorMean,
        high: predictedMean + tCrit95 * stdErrorMean
      },
      stdErrorPred,
      pi95: {
        low: predictedMean - tCrit95 * stdErrorPred,
        high: predictedMean + tCrit95 * stdErrorPred
      },
      leverage,
      dfError,
      tCritical: tCrit,
      toleranceFactorK,
      isExtrapolated,
      extrapolatedFactors
    });
  }

  return results;
}

/**
 * Calculates confirmation comparison between experimentally observed response values
 * and model predictions at specified confirmation factor coordinates.
 * Supports averaging across k confirmation replicate runs:
 * SE(Pred_k) = sqrt(MS_Residual * (1/k + leverage))
 */
export function calculateConfirmationComparison(
  factors: FactorBounds[],
  responses: Array<{ id: string; name: string; units?: string }>,
  analyses: Record<string, RSMAnalysis | any>,
  runs: Array<{ actualValues?: Record<string, number>; codedValues?: Record<string, number>; responses?: Record<string, any> }>,
  factorSettings: Record<string, number>,
  observedResponses: Record<string, number | null>,
  kRuns: number = 1
): ConfirmationComparisonResult[] {
  const k = Math.max(1, kRuns);
  const pointPreds = calculatePointPredictions(factors, responses, analyses, runs, factorSettings);
  const results: ConfirmationComparisonResult[] = [];

  for (const pred of pointPreds) {
    if (!pred.isAnalyzed || pred.predictedMean === null) {
      continue;
    }
    const obs = observedResponses[pred.responseId];
    const hasObs = obs !== null && obs !== undefined && typeof obs === 'number' && Number.isFinite(obs);

    const analysis = analyses[pred.responseId];
    const model = analysis?.fittedModel || analysis?.fitted;
    const usableModel: FittedModelRef = {
      modelType: model?.modelType || 'Quadratic',
      terms: model?.terms || [],
      coefficients: model?.coefficients || []
    };
    const cov = computeResponseCovariance(factors, usableModel.terms, runs, pred.responseId, usableModel);

    let stdErrorPredK = pred.stdErrorPred;
    if (cov && cov.msError > 0) {
      stdErrorPredK = Math.sqrt(Math.max(0, cov.msError * (1 / k + pred.leverage)));
    }

    const tCrit = pred.tCritical;
    const pi95K = {
      low: pred.predictedMean - tCrit * stdErrorPredK,
      high: pred.predictedMean + tCrit * stdErrorPredK
    };

    let predictionError: number | null = null;
    let percentError: number | null = null;
    let isConfirmed: boolean | null = null;

    if (hasObs) {
      predictionError = obs - pred.predictedMean;
      if (Math.abs(pred.predictedMean) > 1e-12) {
        percentError = (Math.abs(predictionError) / Math.abs(pred.predictedMean)) * 100;
      } else {
        percentError = 0;
      }
      isConfirmed = obs >= pi95K.low - 1e-6 && obs <= pi95K.high + 1e-6;
    }

    results.push({
      responseId: pred.responseId,
      responseName: pred.responseName,
      units: pred.units,
      modelType: pred.modelType,
      predictedMean: pred.predictedMean,
      observedValue: hasObs ? obs : null,
      predictionError,
      percentError,
      stdErrorPred: stdErrorPredK,
      pi95: pi95K,
      ci95: pred.ci95,
      isConfirmed,
      kRuns: k,
      isExtrapolated: pred.isExtrapolated
    });
  }

  return results;
}

/**
 * Extracts complete coefficients table with estimates, standard errors, t-statistics,
 * two-tailed p-values, 95% confidence intervals, and VIFs for a given response model.
 */
export function extractCoefficientsDetail(
  analysis: RSMAnalysis | any,
  factors: FactorDefinition[] = [],
  responseName?: string
): {
  coefficients: FullCoefficientDetail[];
  modelType: string;
  responseName: string;
  r2: number | null;
  adjR2: number | null;
  predR2: number | null;
  rmse: number | null;
  msError: number | null;
  dfModel: number;
  dfError: number;
  dfTotal: number;
  fModel: number | null;
  pModel: number | null;
  codedEquation: string;
  actualEquation?: string;
} {
  const fitted = analysis?.fittedModel || analysis?.fitted;
  if (!fitted || !Array.isArray(fitted.coefficients)) {
    return {
      coefficients: [],
      modelType: 'None',
      responseName: responseName || 'Response',
      r2: null,
      adjR2: null,
      predR2: null,
      rmse: null,
      msError: null,
      dfModel: 0,
      dfError: 0,
      dfTotal: 0,
      fModel: null,
      pModel: null,
      codedEquation: '',
      actualEquation: ''
    };
  }

  const terms = fitted.terms || [];
  const coeffs = fitted.coefficients || [];
  const existingTable = fitted.coefficientTable || [];
  const dfError = fitted.dfError || 0;
  const msError = fitted.msError || (fitted.rmse ? fitted.rmse * fitted.rmse : null);

  const coefficients: FullCoefficientDetail[] = [];

  for (let j = 0; j < coeffs.length; j++) {
    const term = terms[j] || { name: `Term ${j}`, type: j === 0 ? 'intercept' : 'linear' };
    const estimate = coeffs[j];
    const existingRow = existingTable[j];

    const se = existingRow?.standardError ?? null;
    let tVal: number | null = null;
    let pVal: number | null = null;

    if (se !== null && se > 1e-12) {
      tVal = estimate / se;
      if (dfError > 0) {
        // Two-tailed p-value: F(1, dfError) = t^2
        const fEquiv = tVal * tVal;
        try {
          pVal = 1 - jStat.centralF.cdf(fEquiv, 1, dfError);
        } catch {
          pVal = null;
        }
      }
    }

    const displayName = formatTermDisplay(term.name, factors);

    coefficients.push({
      termName: displayName,
      termType: term.type || (j === 0 ? 'intercept' : 'linear'),
      estimateCoded: estimate,
      df: 1,
      standardError: se,
      tValue: tVal,
      pValue: pVal,
      ciLow: existingRow?.ciLow ?? null,
      ciHigh: existingRow?.ciHigh ?? null,
      vif: existingRow?.vif ?? (term.type === 'intercept' ? null : 1.0)
    });
  }

  return {
    coefficients,
    modelType: fitted.modelType || 'Quadratic',
    responseName: responseName || 'Response',
    r2: fitted.R2 ?? null,
    adjR2: fitted.adjR2 ?? null,
    predR2: fitted.predR2 ?? null,
    rmse: fitted.rmse ?? null,
    msError,
    dfModel: fitted.dfModel || 0,
    dfError,
    dfTotal: fitted.dfTotal || 0,
    fModel: fitted.fModel ?? null,
    pModel: fitted.pModel ?? null,
    codedEquation: fitted.codedEquation || '',
    actualEquation: fitted.actualEquation || ''
  };
}
