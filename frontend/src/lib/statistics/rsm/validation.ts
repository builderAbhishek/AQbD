import { RSMAnalysis } from './types';

/**
 * Validates that an RSMAnalysis object is complete and mathematically sound
 * before committing to project state.
 * Throws a descriptive Error if any required field is missing or invalid.
 */
export function validateAnalysisResult(analysis: unknown): asserts analysis is RSMAnalysis {
  if (!analysis || typeof analysis !== 'object') {
    throw new Error('Analysis result is empty or invalid.');
  }

  const a = analysis as Partial<RSMAnalysis>;

  if (!a.responseId || typeof a.responseId !== 'string') {
    throw new Error('Analysis result is incomplete: responseId is missing.');
  }

  if (!a.modelType || !['Linear', '2FI', 'Quadratic'].includes(a.modelType)) {
    throw new Error('Analysis result is incomplete: modelType is missing or invalid.');
  }

  if (!a.factors || !Array.isArray(a.factors) || a.factors.length === 0) {
    throw new Error('Analysis result is incomplete: factors list is missing.');
  }

  const fittedModel = a.fittedModel || a.fitted;
  if (!fittedModel || typeof fittedModel !== 'object') {
    throw new Error('Analysis result is incomplete: fittedModel is missing.');
  }

  if (!Array.isArray(fittedModel.coefficients) || fittedModel.coefficients.length === 0) {
    throw new Error('Analysis result is incomplete: coefficients are missing.');
  }

  if (fittedModel.coefficients.some(c => typeof c !== 'number' || isNaN(c))) {
    throw new Error('Analysis result is incomplete: one or more coefficients are NaN or invalid.');
  }

  if (!Array.isArray(fittedModel.terms) || fittedModel.terms.length === 0) {
    throw new Error('Analysis result is incomplete: model terms are missing.');
  }

  if (fittedModel.terms.length !== fittedModel.coefficients.length) {
    throw new Error('Analysis result is incomplete: terms count does not match coefficients count.');
  }

  // Observation and degrees of freedom validation (Section 47)
  const n = fittedModel.n;
  const p = fittedModel.p;
  if (typeof n !== 'number' || n <= 0) {
    throw new Error('Analysis result is incomplete: observation count (n) is invalid.');
  }
  if (typeof p !== 'number' || p <= 0) {
    throw new Error('Analysis result is incomplete: parameter count (p) is invalid.');
  }

  const dfTotal = fittedModel.dfTotal;
  const dfModel = fittedModel.dfModel;
  const dfError = fittedModel.dfError;

  if (dfTotal !== n - 1) {
    throw new Error(`Degrees of freedom error: df_total (${dfTotal}) must equal n - 1 (${n - 1}).`);
  }
  if (dfModel !== p - 1) {
    throw new Error(`Degrees of freedom error: df_model (${dfModel}) must equal p - 1 (${p - 1}).`);
  }
  if (dfModel + dfError !== dfTotal) {
    throw new Error(`Degrees of freedom error: df_model (${dfModel}) + df_error (${dfError}) must equal df_total (${dfTotal}).`);
  }

  // Sum of Squares validation (Section 48)
  if (typeof fittedModel.SSE !== 'number' || isNaN(fittedModel.SSE)) {
    throw new Error('Analysis result is incomplete: Sum of Squares Error (SSE) is missing or invalid.');
  }
  if (typeof fittedModel.SST !== 'number' || isNaN(fittedModel.SST)) {
    throw new Error('Analysis result is incomplete: Total Sum of Squares (SST) is missing or invalid.');
  }

  const sstCheck = fittedModel.SSR + fittedModel.SSE;
  const diff = Math.abs(fittedModel.SST - sstCheck);
  const tol = Math.max(1e-4, 1e-4 * fittedModel.SST);
  if (diff > tol) {
    throw new Error(`Statistical consistency error: SST (${fittedModel.SST}) does not equal SS_Model (${fittedModel.SSR}) + SSE (${fittedModel.SSE}) within numerical tolerance.`);
  }

  // ANOVA table validation
  if (!Array.isArray(a.anova) || a.anova.length === 0) {
    throw new Error('Analysis result is incomplete: ANOVA table is missing.');
  }

  const hasModelRow = a.anova.some(r => r.source === 'Model');
  const hasTotalRow = a.anova.some(r => r.source === 'Total' || r.source === 'Cor Total');
  if (!hasModelRow || !hasTotalRow) {
    throw new Error('Analysis result is incomplete: ANOVA table must contain Model and Total / Cor Total rows.');
  }

  // Diagnostics validation (predictions and residuals)
  if (!Array.isArray(a.diagnostics) || a.diagnostics.length === 0) {
    throw new Error('Analysis result is incomplete: diagnostic records are missing.');
  }

  if (a.diagnostics.length !== fittedModel.n) {
    throw new Error(`Analysis result is incomplete: diagnostic records count (${a.diagnostics.length}) does not match observation count (${fittedModel.n}).`);
  }

  for (let i = 0; i < a.diagnostics.length; i++) {
    const diag = a.diagnostics[i];
    if (typeof diag.predicted !== 'number' || isNaN(diag.predicted)) {
      throw new Error(`Analysis result is incomplete: prediction for observation ${i + 1} is missing or invalid.`);
    }
    if (typeof diag.residual !== 'number' || isNaN(diag.residual)) {
      throw new Error(`Analysis result is incomplete: residual for observation ${i + 1} is missing or invalid.`);
    }
  }
}
