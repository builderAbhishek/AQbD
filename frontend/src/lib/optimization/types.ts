export type OptimizationGoal = 
  | 'none'
  | 'maximize'
  | 'minimize'
  | 'target'
  | 'in_range'
  | 'equal_to';

export type CriterionType = 'factor' | 'response';

export interface OptimizationCriterion {
  id: string; // factor id or response id
  name: string; // Display name e.g. "Factor A" or "Yield"
  code?: string; // Letter code e.g. "A", "B", "R1"
  type: CriterionType;
  units?: string;
  unitType?: 'coded' | 'actual';
  isCoded?: boolean;
  goal: OptimizationGoal;
  lowerLimit: number;
  upperLimit: number;
  targetValue?: number;
  lowerWeight: number; // default 1.0 (range 0.1 to 10)
  upperWeight: number; // default 1.0 (range 0.1 to 10)
  importance: number; // 1 to 5 (default 3, corresponding to + to +++++)
  hideOnReport?: boolean; // For goal = 'none', hide on report checkbox
  selectedAnalysisId?: string; // For response, selected analysis model id
}

export interface OptimizationOptions {
  randomStartingPoints: number; // default 100
  numberDesignPoints: number; // default 50
  duplicateFilter: number; // default 0.5
  simplexFraction: number; // default 0.1
  maxSolutions: number; // default 100
  includeStdError: boolean; // default false
}

export const DEFAULT_OPTIMIZATION_OPTIONS: OptimizationOptions = {
  randomStartingPoints: 100,
  numberDesignPoints: 50,
  duplicateFilter: 0.5,
  simplexFraction: 0.1,
  maxSolutions: 100,
  includeStdError: false,
};

export interface OptimizationSolution {
  solutionNumber: number;
  factors: Record<string, number>; // factorId -> actual value
  predictions: Record<string, number>; // responseId -> predicted response value
  individualDesirability: Record<string, number>; // criterionId -> d_i (0 to 1)
  desirability: number; // Combined D (0 to 1)
  stdErrors?: Record<string, number>;
  confidenceIntervals?: Record<string, { low: number; high: number }>;
}

export interface StartingPoint {
  pointNumber: number;
  factors: Record<string, number>; // factorId -> actual value
  source?: 'midpoint' | 'design_point' | 'random';
  status?: 'accepted' | 'rejected_bounds' | 'rejected_duplicate';
  rejectionReason?: string;
  desirability?: number;
}

export interface StartingPointsDiagnostic {
  initialDesignCandidates: number;
  rejectedOutOfBounds: number;
  rejectedDuplicates: number;
  acceptedDesignPoints: number;
  randomPointsGenerated: number;
  rejectedInvalidPredictions: number;
  totalStartingPoints: number;
  stageDetails: {
    stage1_initialCandidates: number;
    stage2_rejectedOutOfBounds: number;
    stage3_rejectedDuplicates: number;
    stage4_randomPoints: number;
    stage5_rejectedInvalidPredictions: number;
    stage6_finalStartingPoints: number;
  };
  outOfBoundsCount?: number;
  duplicateCount?: number;
  rejectedDetails?: Array<{
    source: string;
    reason: string;
    factors: Record<string, number>;
  }>;
}

export interface OptimizationRunResult {
  runId: string;
  timestamp: string;
  status: 'optimal' | 'suboptimal' | 'no_feasible_solution' | 'error';
  message?: string;
  options: OptimizationOptions;
  criteria: Record<string, OptimizationCriterion>;
  startingPoints: StartingPoint[];
  solutions: OptimizationSolution[];
  selectedSolutionIndex: number;
  warnings: string[];
  isOutdated?: boolean;
  outdatedReason?: string;
  dataVersion?: string;
  modelsFittedAt?: Record<string, string>;
  startingPointsDiagnostic?: StartingPointsDiagnostic;
}

export interface OptimizationState {
  criteria: Record<string, OptimizationCriterion>;
  options: OptimizationOptions;
  results?: OptimizationRunResult;
  lastUpdated?: string;
}

export interface CriteriaValidationError {
  field: string;
  message: string;
}

/**
 * Converts actual factor value to coded (-1 to +1) value.
 */
export function actualToCoded(actual: number, low: number, high: number): number {
  const center = (high + low) / 2.0;
  const halfRange = (high - low) / 2.0;
  if (halfRange === 0) return 0;
  return (actual - center) / halfRange;
}

/**
 * Converts coded value to actual factor value.
 */
export function codedToActual(coded: number, low: number, high: number): number {
  const center = (high + low) / 2.0;
  const halfRange = (high - low) / 2.0;
  return center + coded * halfRange;
}

/**
 * Determines whether a factor criterion is defined in coded units [-1, +1] or actual factor units.
 */
export function isFactorCriterionCoded(
  criterion: OptimizationCriterion,
  factorBounds?: { low: number; high: number }
): boolean {
  if (criterion.type !== 'factor') {
    return false;
  }

  // 1. Explicit flags
  if (criterion.unitType === 'actual' || criterion.isCoded === false) {
    return false;
  }
  if (criterion.unitType === 'coded' || criterion.isCoded === true) {
    return true;
  }

  // 2. If factor configured bounds are standard coded [-1, 1], then criterion is coded
  if (factorBounds && Math.abs(factorBounds.low - -1) < 1e-4 && Math.abs(factorBounds.high - 1) < 1e-4) {
    return true;
  }

  // 3. Equal To goal: if target value is clearly in coded range [-1.05, 1.05] while factor bounds are outside [-1, 1], it is legacy coded
  if (criterion.goal === 'equal_to' && factorBounds) {
    if (criterion.targetValue !== undefined && criterion.targetValue !== null && !isNaN(criterion.targetValue)) {
      if (
        criterion.targetValue >= -1.05 &&
        criterion.targetValue <= 1.05 &&
        (factorBounds.low > 1.05 || factorBounds.high < -1.05)
      ) {
        return true;
      }
      if (
        (criterion.targetValue > 1.05 || criterion.targetValue < -1.05) &&
        criterion.targetValue >= factorBounds.low - 1e-4 &&
        criterion.targetValue <= factorBounds.high + 1e-4
      ) {
        return false;
      }
    }
  }

  // 4. If limits match actual factor bounds
  if (factorBounds) {
    const matchesActualLimits = 
      Math.abs(criterion.lowerLimit - factorBounds.low) < 1e-4 &&
      Math.abs(criterion.upperLimit - factorBounds.high) < 1e-4;
    if (matchesActualLimits) {
      return false;
    }
  }

  // 5. If limits fall strictly within [-1.05, 1.05] while factor bounds are outside [-1, 1], it is legacy coded
  if (
    typeof criterion.lowerLimit === 'number' &&
    typeof criterion.upperLimit === 'number' &&
    criterion.lowerLimit >= -1.05 &&
    criterion.upperLimit <= 1.05 &&
    factorBounds &&
    (factorBounds.low < -1.1 || factorBounds.high > 1.1)
  ) {
    return true;
  }

  if (!factorBounds) {
    return (
      typeof criterion.lowerLimit === 'number' &&
      typeof criterion.upperLimit === 'number' &&
      criterion.lowerLimit >= -1.05 &&
      criterion.upperLimit <= 1.05
    );
  }

  return false;
}

/**
 * Validates a single criterion's numeric limits and goals.
 */
export function validateCriterion(
  criterion: OptimizationCriterion,
  factorBounds?: { low: number; high: number }
): CriteriaValidationError[] {
  const errors: CriteriaValidationError[] = [];

  if (criterion.goal === 'none') {
    return errors;
  }

  // Weight validation: Maximize uses lowerWeight (s), Minimize uses upperWeight (t), Target uses both
  if (['maximize', 'target'].includes(criterion.goal)) {
    if (typeof criterion.lowerWeight !== 'number' || isNaN(criterion.lowerWeight) || criterion.lowerWeight < 0.1 || criterion.lowerWeight > 10) {
      errors.push({ field: 'lowerWeight', message: 'Lower weight must be between 0.1 and 10.' });
    }
  }

  if (['minimize', 'target'].includes(criterion.goal)) {
    if (typeof criterion.upperWeight !== 'number' || isNaN(criterion.upperWeight) || criterion.upperWeight < 0.1 || criterion.upperWeight > 10) {
      errors.push({ field: 'upperWeight', message: 'Upper weight must be between 0.1 and 10.' });
    }
  }

  // Importance validation
  if (typeof criterion.importance !== 'number' || criterion.importance < 1 || criterion.importance > 5) {
    errors.push({ field: 'importance', message: 'Importance must be an integer between 1 and 5.' });
  }

  // Equal To validation
  if (criterion.goal === 'equal_to') {
    if (criterion.targetValue === undefined || criterion.targetValue === null || isNaN(criterion.targetValue)) {
      errors.push({ field: 'targetValue', message: 'Target value is required for "Equal to" goal.' });
    } else if (factorBounds) {
      const isCoded = isFactorCriterionCoded(criterion, factorBounds);
      if (isCoded) {
        // Convert coded target to actual value before comparing against configured factor bounds
        const actualTarget = codedToActual(criterion.targetValue, factorBounds.low, factorBounds.high);
        if (actualTarget < factorBounds.low - 1e-4 || actualTarget > factorBounds.high + 1e-4) {
          errors.push({ 
            field: 'targetValue', 
            message: `Target value must be within coded factor range [-1, +1] (corresponds to [${factorBounds.low}, ${factorBounds.high}]).` 
          });
        }
      } else {
        if (criterion.targetValue < factorBounds.low - 1e-4 || criterion.targetValue > factorBounds.high + 1e-4) {
          errors.push({ 
            field: 'targetValue', 
            message: `Target value must be within configured factor range [${factorBounds.low}, ${factorBounds.high}].` 
          });
        }
      }
    }
    return errors;
  }

  // Limit validations for Maximize, Minimize, Target, In Range
  if (typeof criterion.lowerLimit !== 'number' || isNaN(criterion.lowerLimit)) {
    errors.push({ field: 'lowerLimit', message: 'Lower limit must be a valid number.' });
  }

  if (typeof criterion.upperLimit !== 'number' || isNaN(criterion.upperLimit)) {
    errors.push({ field: 'upperLimit', message: 'Upper limit must be a valid number.' });
  }

  if (
    typeof criterion.lowerLimit === 'number' &&
    typeof criterion.upperLimit === 'number' &&
    !isNaN(criterion.lowerLimit) &&
    !isNaN(criterion.upperLimit)
  ) {
    if (criterion.lowerLimit >= criterion.upperLimit) {
      errors.push({ field: 'lowerLimit', message: 'Lower limit must be strictly less than upper limit.' });
    }

    if (factorBounds) {
      // Allow coded factor criteria [-1, 1] or actual factor range [low, high]
      const isCodedRange = criterion.type === 'factor' && isFactorCriterionCoded(criterion, factorBounds);
      if (isCodedRange) {
        if (criterion.lowerLimit < -1 - 1e-4) {
          errors.push({ 
            field: 'lowerLimit', 
            message: 'Lower limit cannot be less than coded minimum (-1).' 
          });
        }
        if (criterion.upperLimit > 1 + 1e-4) {
          errors.push({ 
            field: 'upperLimit', 
            message: 'Upper limit cannot exceed coded maximum (+1).' 
          });
        }
      } else {
        if (criterion.lowerLimit < factorBounds.low - 1e-4) {
          errors.push({ 
            field: 'lowerLimit', 
            message: `Lower limit cannot be less than factor configured minimum (${factorBounds.low}).` 
          });
        }
        if (criterion.upperLimit > factorBounds.high + 1e-4) {
          errors.push({ 
            field: 'upperLimit', 
            message: `Upper limit cannot exceed factor configured maximum (${factorBounds.high}).` 
          });
        }
      }
    }
  }

  // Target value validation for Target goal
  if (criterion.goal === 'target') {
    if (criterion.targetValue === undefined || criterion.targetValue === null || isNaN(criterion.targetValue)) {
      errors.push({ field: 'targetValue', message: 'Target value is required for "Target" goal.' });
    } else if (
      typeof criterion.lowerLimit === 'number' &&
      typeof criterion.upperLimit === 'number' &&
      !isNaN(criterion.lowerLimit) &&
      !isNaN(criterion.upperLimit)
    ) {
      if (criterion.targetValue < criterion.lowerLimit || criterion.targetValue > criterion.upperLimit) {
        errors.push({ 
          field: 'targetValue', 
          message: 'Target value must lie between the lower and upper limits.' 
        });
      }
    }
  }

  return errors;
}

/**
 * Validates the options modal settings.
 */
export function validateOptimizationOptions(options: OptimizationOptions): Record<string, string> {
  const errors: Record<string, string> = {};

  if (typeof options.randomStartingPoints !== 'number' || isNaN(options.randomStartingPoints) || !Number.isInteger(options.randomStartingPoints) || options.randomStartingPoints < 0) {
    errors.randomStartingPoints = 'Random starting points must be an integer ≥ 0.';
  }

  if (typeof options.numberDesignPoints !== 'number' || isNaN(options.numberDesignPoints) || !Number.isInteger(options.numberDesignPoints) || options.numberDesignPoints < 0) {
    errors.numberDesignPoints = 'Number of design points must be an integer ≥ 0.';
  }

  if (
    Number.isInteger(options.randomStartingPoints) &&
    Number.isInteger(options.numberDesignPoints) &&
    options.randomStartingPoints === 0 &&
    options.numberDesignPoints === 0
  ) {
    errors.randomStartingPoints = 'At least one starting point must be selected (random starting points or design points).';
  }

  if (typeof options.duplicateFilter !== 'number' || isNaN(options.duplicateFilter) || !Number.isFinite(options.duplicateFilter) || options.duplicateFilter <= 0) {
    errors.duplicateFilter = 'Duplicate solution filter must be a positive number > 0.';
  }

  if (typeof options.simplexFraction !== 'number' || isNaN(options.simplexFraction) || !Number.isFinite(options.simplexFraction) || options.simplexFraction <= 0 || options.simplexFraction > 1) {
    errors.simplexFraction = 'Simplex fraction must be between 0 and 1 (0 < fraction ≤ 1).';
  }

  if (typeof options.maxSolutions !== 'number' || isNaN(options.maxSolutions) || !Number.isInteger(options.maxSolutions) || options.maxSolutions < 1) {
    errors.maxSolutions = 'Maximum number of solutions must be an integer ≥ 1.';
  }

  return errors;
}

/**
 * Derives initial default criteria for a design.
 */
export function initializeDesignCriteria(
  factors: Array<{ id: string; name: string; low: number; high: number; units?: string }>,
  responses: Array<{ id: string; name: string; units?: string }>,
  runs?: Array<{ responses?: Record<string, number | null> }>,
  existingCriteria?: Record<string, OptimizationCriterion>,
  analyses?: Record<string, any>
): Record<string, OptimizationCriterion> {
  const result: Record<string, OptimizationCriterion> = {};

  // Letters for factors: A, B, C...
  factors.forEach((f, idx) => {
    const letter = String.fromCharCode(65 + idx);
    const existing = existingCriteria?.[f.id];

    if (existing) {
      const isCoded = isFactorCriterionCoded(existing, f);
      const isEq = existing.goal === 'equal_to' || (existing.goal as string) === 'equal' || (existing.goal as string) === 'is equal to';

      let lower = existing.lowerLimit;
      let upper = existing.upperLimit;
      let target = existing.targetValue;

      // Backward compatibility: If existing criterion was stored in coded units [-1, 1] on a factor with actual bounds, convert to actual factor bounds
      if (isCoded && (Math.abs(f.low - -1) > 1e-4 || Math.abs(f.high - 1) > 1e-4)) {
        lower = typeof existing.lowerLimit === 'number' ? codedToActual(existing.lowerLimit, f.low, f.high) : f.low;
        upper = typeof existing.upperLimit === 'number' ? codedToActual(existing.upperLimit, f.low, f.high) : f.high;
        if (typeof existing.targetValue === 'number') {
          target = codedToActual(existing.targetValue, f.low, f.high);
        }
      }

      if (typeof lower !== 'number' || isNaN(lower)) lower = f.low;
      if (typeof upper !== 'number' || isNaN(upper)) upper = f.high;

      if (isEq) {
        lower = f.low;
        upper = f.high;
        if (target === undefined || target === null || typeof target !== 'number' || isNaN(target)) {
          target = (f.low + f.high) / 2;
        }
      }

      result[f.id] = {
        ...existing,
        name: f.name,
        code: letter,
        units: f.units || '',
        unitType: 'actual',
        isCoded: false,
        lowerLimit: lower,
        upperLimit: upper,
        targetValue: target ?? (lower + upper) / 2,
      };
    } else {
      result[f.id] = {
        id: f.id,
        name: f.name,
        code: letter,
        type: 'factor',
        units: f.units || '',
        goal: 'in_range',
        lowerLimit: f.low,
        upperLimit: f.high,
        targetValue: (f.low + f.high) / 2,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
        unitType: 'actual',
        isCoded: false,
      };
    }
  });

  // Numbers for responses: R1, R2, R3...
  responses.forEach((r, idx) => {
    const code = `R${idx + 1}`;
    const existing = existingCriteria?.[r.id];

    // Compute observed bounds
    let minObserved = 0;
    let maxObserved = 100;
    if (runs && runs.length > 0) {
      const vals = runs
        .map(run => run.responses?.[r.id])
        .filter((v): v is number => typeof v === 'number' && Number.isFinite(v));
      if (vals.length > 0) {
        minObserved = Math.min(...vals);
        maxObserved = Math.max(...vals);
      }
    }

    if (minObserved === maxObserved) {
      maxObserved = minObserved + 10;
    }

    const defaultAnalysisId = analyses?.[r.id]?.fittedModel || analyses?.[r.id]?.fitted ? r.id : undefined;

    if (existing) {
      result[r.id] = {
        ...existing,
        name: r.name,
        code,
        units: r.units || '',
        hideOnReport: existing.hideOnReport ?? false,
        selectedAnalysisId: existing.selectedAnalysisId ?? defaultAnalysisId,
      };
    } else {
      result[r.id] = {
        id: r.id,
        name: r.name,
        code,
        type: 'response',
        units: r.units || '',
        goal: 'none',
        lowerLimit: minObserved,
        upperLimit: maxObserved,
        targetValue: (minObserved + maxObserved) / 2,
        lowerWeight: 1.0,
        upperWeight: 1.0,
        importance: 3,
        hideOnReport: false,
        selectedAnalysisId: defaultAnalysisId,
      };
    }
  });

  return result;
}
