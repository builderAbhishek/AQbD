import { RSMAnalysis, ModelType } from './types';
import { createModelMatrix } from './modelMatrix';
import { analyzeModel } from './statistics';
import { actualToCoded } from '../../optimization/types';

export interface CompletenessCheckResult {
  isComplete: boolean;
  missingRuns: string[];
}

/**
 * Validates that every run in the design has a valid, finite numerical observation for the given response.
 */
export function validateResponseObservationsComplete(
  runs: any[],
  respId: string,
  _respName?: string
): CompletenessCheckResult {
  const missingRuns: string[] = [];

  if (!runs || runs.length === 0) {
    return {
      isComplete: false,
      missingRuns: ['No experimental runs defined in design'],
    };
  }

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    const val = run.responses?.[respId];
    if (val === null || val === undefined || typeof val !== 'number' || !Number.isFinite(val)) {
      const runIdentifier = `Run ${run.runOrder || (i + 1)} (Std ${run.stdOrder || (i + 1)})`;
      missingRuns.push(runIdentifier);
    }
  }

  return {
    isComplete: missingRuns.length === 0,
    missingRuns,
  };
}

/**
 * Automatically fits (or refits) the regression model for a given response using current runs in the design.
 * Throws a user-friendly error if response observations are incomplete or missing.
 */
export function refitResponseModel(
  design: any,
  respId: string,
  requestedModelType?: ModelType
): RSMAnalysis {
  if (!design || !design.config || !design.runs) {
    throw new Error('Invalid design structure: missing design config or runs.');
  }

  const factors = design.config.factors || [];
  const responses = design.config.responses || [];
  const runs = design.runs || [];

  const respDef = responses.find((r: any) => r.id === respId);
  const respName = respDef?.name || respId;

  const completeness = validateResponseObservationsComplete(runs, respId, respName);
  if (!completeness.isComplete) {
    throw new Error(
      `Cannot run optimization: Response "${respName}" has missing or non-numeric values in run(s) [${completeness.missingRuns.join(', ')}]. All runs must have valid numerical response observations before running optimization.`
    );
  }

  const existingAnalysis = design.analyses?.[respId];
  const modelType: ModelType = requestedModelType || existingAnalysis?.modelType || 'Quadratic';
  const factorIds = factors.map((f: any) => f.id);

  const codedData: Record<string, number>[] = [];
  const y: number[] = [];
  const rawRuns: any[] = [];

  for (let i = 0; i < runs.length; i++) {
    const run = runs[i];
    let coded = run.codedValues;

    // Fallback: derive coded from actual values if codedValues missing
    if (!coded) {
      coded = {};
      for (const f of factors) {
        const act = run.actualValues?.[f.id] ?? (f.low + f.high) / 2;
        coded[f.id] = actualToCoded(act, f.low, f.high);
      }
    }

    codedData.push(coded);
    y.push(Number(run.responses[respId]));
    rawRuns.push(run);
  }

  const k = factors.length;
  const requiredParams = 1 + (2 * k) + (k * (k - 1) / 2);
  if (modelType === 'Quadratic' && runs.length < requiredParams) {
    throw new Error(
      `Cannot fit Quadratic model: Design has ${runs.length} runs, but a Quadratic model requires at least ${requiredParams} runs.`
    );
  }

  const modelMatrix = createModelMatrix(codedData, factorIds, modelType);
  const analysisResult = analyzeModel(modelMatrix, y, modelType, codedData, rawRuns, factors);

  const fittedModel = analysisResult.fittedModel || analysisResult.fitted;

  const fullAnalysis: RSMAnalysis = {
    responseId: respId,
    modelType,
    factors,
    fittedModel,
    fitted: fittedModel,
    anova: analysisResult.anova,
    lackOfFit: analysisResult.lackOfFit,
    diagnostics: analysisResult.diagnostics,
    modelComparison: analysisResult.modelComparison,
    timestamp: new Date().toISOString(),
    isOutdated: false,
  };

  return fullAnalysis;
}

/**
 * Checks all active or modeled responses in the design and refits any response
 * whose data has changed, is marked outdated, or has missing model coefficients.
 */
export function ensureAllResponseModelsCurrent(
  design: any,
  criteria?: Record<string, any>
): { updatedAnalyses: Record<string, RSMAnalysis>; didRefit: boolean } {
  const updatedAnalyses: Record<string, RSMAnalysis> = { ...(design.analyses || {}) };
  let didRefit = false;

  const responses = design.config?.responses || [];
  const runsModifiedAt = design.runsModifiedAt ? new Date(design.runsModifiedAt).getTime() : 0;

  for (const r of responses) {
    const crit = criteria?.[r.id];
    const isResponseActive = crit && crit.goal !== 'none';
    const analysis = updatedAnalyses[r.id];

    const hasFittedCoeffs = Boolean(
      analysis?.fittedModel?.coefficients && analysis.fittedModel.coefficients.length > 0
    );
    const isExplicitlyOutdated = Boolean(analysis?.isOutdated);
    const modelTimestamp = analysis?.timestamp ? new Date(analysis.timestamp).getTime() : 0;
    const isDataNewerThanModel = runsModifiedAt > 0 && modelTimestamp > 0 && runsModifiedAt > modelTimestamp;

    const needsRefit = !hasFittedCoeffs || isExplicitlyOutdated || isDataNewerThanModel;

    if (needsRefit) {
      // If it is active, or already had an analysis, refit it!
      if (isResponseActive || analysis) {
        const freshAnalysis = refitResponseModel(design, r.id, analysis?.modelType || 'Quadratic');
        updatedAnalyses[r.id] = freshAnalysis;
        didRefit = true;
      }
    }
  }

  return { updatedAnalyses, didRefit };
}
