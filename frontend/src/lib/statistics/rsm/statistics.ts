import jStat from 'jstat';
import { Matrix, solve } from 'ml-matrix';
import { 
  FittedModel, 
  ModelMatrixResult, 
  AnovaRow, 
  LackOfFitResult, 
  ObservationDiagnostic,
  CoefficientRow,
  ModelComparisonRow,
  FactorDefinition,
  ModelType 
} from './types';
import { fitModel } from './fitModel';
import { generateCodedEquation, generateActualEquation } from './equations';
import { createModelMatrix } from './modelMatrix';

/**
 * Calculates Variance Inflation Factors (VIF) for non-intercept predictor terms.
 * VIF_j = (R_xx^-1)_jj from standardized predictor correlation matrix.
 */
function calculateVIF(X: number[][]): (number | null)[] {
  const n = X.length;
  const p = X[0].length;
  if (p <= 1) return [null];

  const vifResults: (number | null)[] = [null]; // Intercept has no VIF

  try {
    // Non-intercept columns
    const pNon = p - 1;
    const means: number[] = new Array(pNon).fill(0);
    const sds: number[] = new Array(pNon).fill(0);

    for (let j = 0; j < pNon; j++) {
      let sum = 0;
      for (let i = 0; i < n; i++) sum += X[i][j + 1];
      means[j] = sum / n;

      let sumSq = 0;
      for (let i = 0; i < n; i++) sumSq += Math.pow(X[i][j + 1] - means[j], 2);
      sds[j] = Math.sqrt(sumSq / (n - 1));
    }

    // Check for zero variance predictors
    for (let j = 0; j < pNon; j++) {
      if (sds[j] < 1e-12) {
        for (let k = 0; k < pNon; k++) vifResults.push(null);
        return vifResults;
      }
    }

    // Correlation matrix R (pNon x pNon)
    const R = Array.from({ length: pNon }, () => new Array(pNon).fill(0));
    for (let j1 = 0; j1 < pNon; j1++) {
      R[j1][j1] = 1.0;
      for (let j2 = j1 + 1; j2 < pNon; j2++) {
        let cov = 0;
        for (let i = 0; i < n; i++) {
          cov += (X[i][j1 + 1] - means[j1]) * (X[i][j2 + 1] - means[j2]);
        }
        const r = cov / ((n - 1) * sds[j1] * sds[j2]);
        R[j1][j2] = r;
        R[j2][j1] = r;
      }
    }

    const RMat = new Matrix(R);
    const RInv = solve(RMat, Matrix.eye(pNon));

    for (let j = 0; j < pNon; j++) {
      const val = RInv.get(j, j);
      if (isNaN(val) || !Number.isFinite(val) || val < 0.99) {
        vifResults.push(1.0); // For exact orthogonal predictors
      } else {
        vifResults.push(val);
      }
    }
  } catch {
    for (let j = 0; j < p - 1; j++) {
      vifResults.push(null);
    }
  }

  return vifResults;
}

/**
 * Formats term names with factor definitions for display in ANOVA / Coefficients
 * e.g. 'f1' -> 'A - Temperature', 'f1*f2' -> 'AB', 'f1^2' -> 'A²'
 */
export function formatTermDisplay(termName: string, factors?: FactorDefinition[]): string {
  if (termName === 'Intercept') return 'Intercept';
  if (!factors || factors.length === 0) return termName;

  // Linear term
  const fMatch = factors.find(f => f.id === termName);
  if (fMatch) {
    return `${fMatch.name}`;
  }

  // Quadratic term (e.g. f1^2)
  if (termName.endsWith('^2')) {
    const baseId = termName.slice(0, -2);
    const baseF = factors.find(f => f.id === baseId);
    return baseF ? `${baseF.name}²` : termName;
  }

  // Interaction term (e.g. f1*f2)
  if (termName.includes('*')) {
    const parts = termName.split('*');
    const f1 = factors.find(f => f.id === parts[0]);
    const f2 = factors.find(f => f.id === parts[1]);
    if (f1 && f2) {
      return `${f1.name}${f2.name}`;
    }
  }

  return termName;
}

/**
 * Perform a full analysis returning FittedModel, ANOVA, etc.
 * Uses numerically stable QR decomposition for regression, Type III / Partial SS for terms,
 * leave-one-out leverage for PRESS / Predicted R², and student's t for confidence intervals.
 */
export function analyzeModel(
  modelMatrix: ModelMatrixResult,
  y: number[],
  modelType: ModelType,
  codedData: Record<string, number>[],
  rawRuns?: any[],
  factors?: FactorDefinition[],
  skipComparison: boolean = false
) {
  // 1. Fit the coefficients using QR-based OLS
  const { coefficients, terms } = fitModel(modelMatrix, y);

  const n = y.length;
  const p = terms.length;

  const X = modelMatrix.X;
  const XMat = new Matrix(X);
  
  // Calculate predictions (ŷ) and residuals (e)
  const bMat = Matrix.columnVector(coefficients);
  const yHatMat = XMat.mmul(bMat);
  const yHat = yHatMat.to1DArray();
  
  let SSE = 0;
  let SST = 0;
  
  const meanY = y.reduce((sum, val) => sum + val, 0) / n;

  for (let i = 0; i < n; i++) {
    const error = y[i] - yHat[i];
    SSE += error * error;
    SST += Math.pow(y[i] - meanY, 2);
  }

  const SSR = Math.max(0, SST - SSE);
  
  const dfTotal = n - 1;
  const dfModel = p - 1;
  const dfError = n - p;

  if (dfError <= 0) {
    throw new Error(`Insufficient residual degrees of freedom (Runs=${n}, Terms=${p}, df_error=${dfError}). Model cannot be tested.`);
  }

  // Mean Squares
  const msModel = dfModel > 0 ? SSR / dfModel : null;
  const msError = dfError > 0 ? SSE / dfError : null;

  // Overall Model F-statistic and p-value
  let fModel: number | null = null;
  let pModel: number | null = null;
  if (msModel !== null && msError !== null && msError > 0) {
    fModel = msModel / msError;
    pModel = 1 - jStat.centralF.cdf(fModel, dfModel, dfError);
  }

  // Calculate (X^T X)^-1 and Hat Matrix for PRESS, SE, and Type III Partial SS
  const Xt = XMat.transpose();
  const XtX = Xt.mmul(XMat);
  let XtX_inv: Matrix;
  let H_matrix: Matrix | null = null;

  try {
    XtX_inv = solve(XtX, Matrix.eye(p));
    H_matrix = XMat.mmul(XtX_inv).mmul(Xt);
  } catch (err: any) {
    throw new Error(`Covariance inversion failed. The design matrix might be singular. (${err.message})`);
  }

  // Calculate PRESS and Predicted R²
  // PRESS = sum( (y_i - ŷ_i) / (1 - h_ii) )^2
  let press: number | null = null;
  let predR2: number | null = null;
  
  try {
    let pressSum = 0;
    let hasHighLeverage = false;

    for (let i = 0; i < n; i++) {
      const h_ii = H_matrix.get(i, i);
      if (h_ii >= 1 - 1e-6) {
        hasHighLeverage = true;
        break;
      }
      const e_i = y[i] - yHat[i];
      pressSum += Math.pow(e_i / (1 - h_ii), 2);
    }

    if (!hasHighLeverage) {
      press = pressSum;
      if (SST > 0) {
        predR2 = 1 - (press / SST);
      }
    }
  } catch {
    press = null;
    predR2 = null;
  }

  // R² and Adjusted R²
  const R2 = SST === 0 ? null : 1 - (SSE / SST);
  
  let adjR2: number | null = null;
  if (SST !== 0 && dfError > 0 && dfTotal > 0) {
    adjR2 = 1 - ((SSE / dfError) / (SST / dfTotal));
  }

  // Root Mean Square Error (Std. Dev.)
  const rmse = dfError > 0 ? Math.sqrt(SSE / dfError) : null;

  // Coefficient of Variation (C.V. %)
  const cv = (rmse !== null && Math.abs(meanY) > 1e-10) ? (rmse / Math.abs(meanY)) * 100 : null;

  // Adequate Precision (Signal to Noise Ratio):
  // Formula: (max(ŷ) - min(ŷ)) / sqrt( (p * MSE) / n )
  let adequatePrecision: number | null = null;
  if (rmse !== null && rmse > 0 && n > 0 && msError !== null) {
    const maxYHat = Math.max(...yHat);
    const minYHat = Math.min(...yHat);
    const signal = maxYHat - minYHat;
    const noise = Math.sqrt((p * msError) / n);
    if (noise > 1e-12) {
      adequatePrecision = signal / noise;
    }
  }

  // Calculate VIF for non-intercept predictors
  const vifs = calculateVIF(X);

  // Student's t critical value for 95% CI
  const tCrit = dfError > 0 ? jStat.studentt.inv(0.975, dfError) : null;

  // Build Coefficient Table & Type III Partial SS for Terms
  const coefficientTable: CoefficientRow[] = [];
  const termAnovaRows: AnovaRow[] = [];

  for (let j = 0; j < p; j++) {
    const term = terms[j];
    const cjj = XtX_inv.get(j, j);
    const se = (msError !== null && cjj >= 0) ? Math.sqrt(msError * cjj) : null;
    
    let ciLow: number | null = null;
    let ciHigh: number | null = null;
    if (se !== null && tCrit !== null) {
      ciLow = coefficients[j] - tCrit * se;
      ciHigh = coefficients[j] + tCrit * se;
    }

    const termDisplayName = formatTermDisplay(term.name, factors);

    coefficientTable.push({
      term: termDisplayName,
      type: term.type,
      estimate: coefficients[j],
      df: 1,
      standardError: se,
      ciLow,
      ciHigh,
      vif: vifs[j] ?? null
    });

    // Term-Level Type III Partial Sum of Squares for non-intercept terms:
    // SS_term = b_j^2 / (X'X)^-1_jj
    if (term.type !== 'intercept') {
      let ssTerm = 0;
      if (cjj > 1e-12) {
        ssTerm = (coefficients[j] * coefficients[j]) / cjj;
      }
      const msTerm = ssTerm; // df = 1
      let fTerm: number | null = null;
      let pTerm: number | null = null;

      if (msError !== null && msError > 0) {
        fTerm = msTerm / msError;
        pTerm = 1 - jStat.centralF.cdf(fTerm, 1, dfError);
      }

      termAnovaRows.push({
        source: termDisplayName,
        ss: ssTerm,
        df: 1,
        ms: msTerm,
        fValue: fTerm,
        pValue: pTerm,
        isTerm: true
      });
    }
  }

  // Lack of Fit & Pure Error Calculation
  let ssPureError = 0;
  let dfPureError = 0;
  
  // Replicate grouping based on coded factor coordinates
  const designPoints = new Map<string, number[]>();
  const factorIds = factors ? factors.map(f => f.id) : (terms[1] ? terms.slice(1).map(t => t.name) : []);

  for (let i = 0; i < n; i++) {
    // Round coded coordinates to 5 decimals to group identical replicate design points reliably
    const key = factorIds.map(f => {
      const v = codedData[i] ? codedData[i][f] : undefined;
      return v !== undefined && typeof v === 'number' ? v.toFixed(5) : '0';
    }).join(',');

    if (!designPoints.has(key)) designPoints.set(key, []);
    designPoints.get(key)!.push(y[i]);
  }

  let hasReplicates = false;
  for (const [_, vals] of designPoints.entries()) {
    if (vals.length > 1) {
      hasReplicates = true;
      const m = vals.reduce((sum, v) => sum + v, 0) / vals.length;
      let ssGroup = 0;
      for (const v of vals) ssGroup += (v - m) ** 2;
      ssPureError += ssGroup;
      dfPureError += (vals.length - 1);
    }
  }

  const ssLOF = Math.max(0, SSE - ssPureError);
  const dfLOF = dfError - dfPureError;
  
  let lofResult: LackOfFitResult;

  if (hasReplicates && dfPureError > 0 && dfLOF > 0) {
    const msLOF = ssLOF / dfLOF;
    const msPure = ssPureError / dfPureError;
    
    let fLOF: number | null = null;
    let pLOF: number | null = null;
    if (msPure > 0) {
      fLOF = msLOF / msPure;
      pLOF = 1 - jStat.centralF.cdf(fLOF, dfLOF, dfPureError);
    }
    
    lofResult = {
      ssLOF,
      dfLOF,
      msLOF,
      ssPureError,
      dfPureError,
      msPureError: msPure,
      fValue: fLOF,
      pValue: pLOF,
      available: true
    };
  } else {
    lofResult = {
      ssLOF: 0,
      dfLOF: 0,
      msLOF: 0,
      ssPureError: 0,
      dfPureError: 0,
      msPureError: 0,
      fValue: null,
      pValue: null,
      available: false,
      message: 'Lack of Fit cannot be estimated because pure error cannot be determined from the current data (no replicated points).'
    };
  }

  // Assemble Canonical ANOVA Table
  const anova: AnovaRow[] = [];
  
  // 1. Overall Model Row
  anova.push({
    source: 'Model',
    ss: SSR,
    df: dfModel,
    ms: msModel,
    fValue: fModel,
    pValue: pModel
  });

  // 2. Term-Level Partial Rows
  for (const termRow of termAnovaRows) {
    anova.push(termRow);
  }

  // 3. Residual Error Row
  anova.push({
    source: 'Residual',
    ss: SSE,
    df: dfError,
    ms: msError,
    fValue: null,
    pValue: null
  });

  // 4. Lack of Fit and Pure Error Rows (only if estimable)
  if (lofResult.available) {
    anova.push({
      source: 'Lack of Fit',
      ss: lofResult.ssLOF,
      df: lofResult.dfLOF,
      ms: lofResult.msLOF,
      fValue: lofResult.fValue,
      pValue: lofResult.pValue
    });

    anova.push({
      source: 'Pure Error',
      ss: lofResult.ssPureError,
      df: lofResult.dfPureError,
      ms: lofResult.msPureError,
      fValue: null,
      pValue: null
    });
  }

  // 5. Total (Corrected Total)
  anova.push({
    source: 'Cor Total',
    ss: SST,
    df: dfTotal,
    ms: null,
    fValue: null,
    pValue: null
  });

  // Generate equations
  const fittedDummy: FittedModel = {
    modelType,
    coefficients,
    terms,
    coefficientTable,
    n,
    p,
    SST,
    SSE,
    SSR,
    dfTotal,
    dfModel,
    dfError,
    msModel,
    msError,
    fModel,
    pModel,
    R2,
    adjR2,
    predR2,
    rmse,
    mean: meanY,
    cv,
    adequatePrecision,
    press,
    codedEquation: ''
  };

  const codedEquation = generateCodedEquation(fittedDummy);
  const actualEquation = factors && factors.length > 0 ? generateActualEquation(fittedDummy, factors) : undefined;

  const fitted: FittedModel = {
    ...fittedDummy,
    codedEquation,
    actualEquation
  };

  // Diagnostics
  const diagnostics: ObservationDiagnostic[] = [];
  for (let i = 0; i < n; i++) {
    const rawRun = rawRuns ? rawRuns[i] : null;
    diagnostics.push({
      runId: rawRun?.id ?? null,
      standardOrder: rawRun?.stdOrder ?? rawRun?.std ?? rawRun?.standardOrder ?? (i + 1),
      runOrder: rawRun?.runOrder ?? rawRun?.run ?? (i + 1),
      observed: y[i],
      predicted: yHat[i],
      residual: y[i] - yHat[i],
      leverage: H_matrix ? H_matrix.get(i, i) : null
    });
  }

  // Model Comparison for Fit Summary
  const modelComparison = skipComparison 
    ? [] 
    : generateModelComparison(codedData, factors ? factors.map(f => f.id) : [], y, rawRuns, factors, modelType);

  return { 
    fitted, 
    fittedModel: fitted, 
    anova, 
    lackOfFit: lofResult, 
    diagnostics,
    modelComparison
  };
}

/**
 * Fits Linear, 2FI, and Quadratic candidate models to compare their fit statistics
 * for the Fit Summary screen.
 */
export function generateModelComparison(
  codedData: Record<string, number>[],
  factorIds: string[],
  y: number[],
  rawRuns?: any[],
  factors?: FactorDefinition[],
  selectedModel: ModelType = 'Quadratic'
): ModelComparisonRow[] {
  const modelsToCompare: ModelType[] = ['Mean', 'Linear', '2FI', 'Quadratic', 'Cubic'] as any[];
  const comparisonRows: ModelComparisonRow[] = [];

  let prevSSR = 0;
  let prevDfModel = 0;

  for (const mType of modelsToCompare) {
    try {
      const mm = createModelMatrix(codedData, factorIds, mType);
      const res = analyzeModel(mm, y, mType, codedData, rawRuns, factors, true);

      // Sequential F-test for extra sum of squares added by this order
      let seqPValue: number | null = null;
      if (mType === 'Linear') {
        seqPValue = res.fitted.pModel;
      } else {
        const extraSS = Math.max(0, res.fitted.SSR - prevSSR);
        const extraDf = res.fitted.dfModel - prevDfModel;
        if (extraDf > 0 && res.fitted.msError !== null && res.fitted.msError > 0) {
          const extraMS = extraSS / extraDf;
          const fSeq = extraMS / res.fitted.msError;
          seqPValue = 1 - jStat.centralF.cdf(fSeq, extraDf, res.fitted.dfError);
        }
      }

      prevSSR = res.fitted.SSR;
      prevDfModel = res.fitted.dfModel;

      comparisonRows.push({
        modelType: mType,
        df: res.fitted.dfModel,
        p: res.fitted.p,
        r2: res.fitted.R2,
        adjR2: res.fitted.adjR2,
        predR2: res.fitted.predR2,
        rmse: res.fitted.rmse,
        press: res.fitted.press,
        sequentialPValue: seqPValue,
        lackOfFitPValue: res.lackOfFit.available ? res.lackOfFit.pValue : null,
        adequatePrecision: res.fitted.adequatePrecision,
        suggested: mType === selectedModel,
        status: mType === selectedModel ? 'Suggested' : 'Alternative'
      });
    } catch {
      comparisonRows.push({
        modelType: mType,
        df: 0,
        p: 0,
        r2: null,
        adjR2: null,
        predR2: null,
        rmse: null,
        press: null,
        sequentialPValue: null,
        lackOfFitPValue: null,
        adequatePrecision: null,
        status: 'Aliased'
      });
    }
  }

  return comparisonRows;
}
